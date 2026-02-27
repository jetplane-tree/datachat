import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getDatasetById } from "@/lib/dataset-registry";
import { buildAnalysisPrompt } from "@/lib/llm-prompt";
import { executeQuery, getDatasetSchema, buildSchemaPrompt } from "@/lib/turso";
import { Message } from "@/types";

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY || "",
  baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
});

const model = process.env.LLM_MODEL || "gpt-4o-mini";
const ACCESS_CODE = process.env.ACCESS_CODE || "";

/* ── Simple in-memory rate limiter ── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // max requests per window per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }
  return text.trim();
}

function normalizeInsight(insight: unknown): { summary: string; highlights: { type: string; text: string }[] } {
  if (typeof insight === "string") {
    return { summary: insight, highlights: [] };
  }
  if (insight && typeof insight === "object" && "summary" in insight) {
    return insight as { summary: string; highlights: { type: string; text: string }[] };
  }
  return { summary: String(insight || ""), highlights: [] };
}

export async function POST(request: NextRequest) {
  try {
    // ── Access code check ──
    const body = await request.json();
    if (ACCESS_CODE && body.accessCode !== ACCESS_CODE) {
      return NextResponse.json(
        { error: "访问密码错误" },
        { status: 403 }
      );
    }

    // ── Rate limit check ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const { allowed, remaining } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试（每小时限 10 次）" },
        { status: 429 }
      );
    }

    const {
      question,
      datasetId,
      schemaInfo: customSchemaInfo,
      conversationHistory = [],
      customInstructions,
    }: {
      question: string;
      datasetId: string;
      schemaInfo?: string;
      conversationHistory: Message[];
      customInstructions?: string;
    } = body;

    if (!question || !datasetId) {
      return NextResponse.json(
        { error: "缺少必要参数: question 和 datasetId" },
        { status: 400 }
      );
    }

    let schemaInfo: string;

    if (customSchemaInfo) {
      // Custom uploaded dataset — schema provided directly by client
      schemaInfo = customSchemaInfo;
    } else {
      const dataset = getDatasetById(datasetId);
      if (!dataset) {
        return NextResponse.json(
          { error: `未找到数据集: ${datasetId}` },
          { status: 404 }
        );
      }
      const tables = await getDatasetSchema(dataset.tableNames);
      schemaInfo = buildSchemaPrompt(dataset.name, tables);
    }
    const prompt = buildAnalysisPrompt(schemaInfo, question, conversationHistory, customInstructions);

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "你是一个资深数据分析师，精通 SQLite SQL 和数据可视化。你的任务是根据用户问题生成准确的 SQL、选择最佳图表类型、并给出有洞察力的分析。严格只返回 JSON，不要包含任何其他文本。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";
    const jsonStr = extractJSON(rawResponse);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        {
          error: "LLM 返回格式异常，无法解析",
          raw: rawResponse,
        },
        { status: 500 }
      );
    }

    const { sql, chart, insight, followUpQuestions, analysisStage } = parsed;
    const normalizedInsight = normalizeInsight(insight);

    if (!sql || !chart || !normalizedInsight.summary) {
      return NextResponse.json(
        {
          error: "LLM 返回结果不完整，缺少必要字段",
          raw: rawResponse,
        },
        { status: 500 }
      );
    }

    // Execute SQL via Turso
    let queryResult;
    try {
      queryResult = await executeQuery(sql);
    } catch (sqlErr) {
      const sqlErrMsg = sqlErr instanceof Error ? sqlErr.message : "未知错误";

      // Auto-retry: ask LLM to fix the SQL
      try {
        const retryPrompt = buildAnalysisPrompt(
          schemaInfo,
          `之前生成的 SQL 执行失败，错误信息: "${sqlErrMsg}"。原始SQL: ${sql}。请修正 SQL 并重新回答原始问题: ${question}`,
          conversationHistory,
          customInstructions
        );

        const retryCompletion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "你是一个资深数据分析师，精通 SQLite SQL 和数据可视化。你的任务是根据用户问题生成准确的 SQL、选择最佳图表类型、并给出有洞察力的分析。严格只返回 JSON，不要包含任何其他文本。" },
            { role: "user", content: retryPrompt },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        });

        const retryRaw = retryCompletion.choices[0]?.message?.content || "";
        const retryJson = extractJSON(retryRaw);
        const retryParsed = JSON.parse(retryJson);

        if (retryParsed.sql) {
          queryResult = await executeQuery(retryParsed.sql);
          return NextResponse.json({
            sql: retryParsed.sql,
            chart: retryParsed.chart || chart,
            insight: normalizeInsight(retryParsed.insight || insight),
            followUpQuestions: retryParsed.followUpQuestions || followUpQuestions || [],
            analysisStage: retryParsed.analysisStage || analysisStage || "overview",
            queryResult,
          }, {
            headers: { "X-RateLimit-Remaining": String(remaining) },
          });
        }
      } catch {
        // Retry also failed
      }

      return NextResponse.json({ error: `SQL 执行失败: ${sqlErrMsg}` }, { status: 500 });
    }

    return NextResponse.json({
      sql,
      chart,
      insight: normalizedInsight,
      followUpQuestions: followUpQuestions || [],
      analysisStage: analysisStage || "overview",
      queryResult,
    }, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (error: unknown) {
    console.error("Analysis API error:", error);
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
