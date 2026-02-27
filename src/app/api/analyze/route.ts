import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getDatasetById } from "@/lib/dataset-registry";
import { buildSqlPrompt, buildInsightPrompt } from "@/lib/llm-prompt";
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
    const systemMsg = "你是一个资深数据分析师，精通 SQLite SQL 和数据可视化。严格只返回 JSON，不要包含任何其他文本。";

    // ── Step 1: LLM generates SQL + chart config ──
    const sqlPrompt = buildSqlPrompt(schemaInfo, question, conversationHistory, customInstructions);

    const sqlCompletion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: sqlPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const sqlRaw = sqlCompletion.choices[0]?.message?.content || "";
    const sqlJsonStr = extractJSON(sqlRaw);

    let sqlParsed;
    try {
      sqlParsed = JSON.parse(sqlJsonStr);
    } catch {
      return NextResponse.json(
        { error: "LLM 返回格式异常，无法解析", raw: sqlRaw },
        { status: 500 }
      );
    }

    let { sql, chart } = sqlParsed;

    if (!sql || !chart) {
      return NextResponse.json(
        { error: "LLM 返回结果不完整，缺少 sql 或 chart", raw: sqlRaw },
        { status: 500 }
      );
    }

    // ── Step 2: Execute SQL via Turso ──
    let queryResult;
    try {
      queryResult = await executeQuery(sql);
    } catch (sqlErr) {
      const sqlErrMsg = sqlErr instanceof Error ? sqlErr.message : "未知错误";

      // Auto-retry: ask LLM to fix the SQL
      try {
        const retryPrompt = buildSqlPrompt(
          schemaInfo,
          `之前生成的 SQL 执行失败，错误信息: "${sqlErrMsg}"。原始SQL: ${sql}。请修正 SQL 并重新回答原始问题: ${question}`,
          conversationHistory,
          customInstructions
        );

        const retryCompletion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: retryPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        });

        const retryRaw = retryCompletion.choices[0]?.message?.content || "";
        const retryJson = extractJSON(retryRaw);
        const retryParsed = JSON.parse(retryJson);

        if (retryParsed.sql) {
          sql = retryParsed.sql;
          chart = retryParsed.chart || chart;
          queryResult = await executeQuery(sql);
        }
      } catch {
        // Retry also failed
      }

      if (!queryResult) {
        return NextResponse.json({ error: `SQL 执行失败: ${sqlErrMsg}` }, { status: 500 });
      }
    }

    // ── Step 3: LLM generates insight based on ACTUAL query results ──
    const insightPrompt = buildInsightPrompt(
      question, sql, queryResult.rows, conversationHistory, customInstructions
    );

    let insightData = { summary: "", highlights: [] as { type: string; text: string }[] };
    let followUpQuestions: { text: string; stage: string }[] = [];
    let analysisStage = "overview";

    try {
      const insightCompletion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: insightPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const insightRaw = insightCompletion.choices[0]?.message?.content || "";
      const insightJsonStr = extractJSON(insightRaw);
      const insightParsed = JSON.parse(insightJsonStr);

      insightData = normalizeInsight(insightParsed.insight);
      followUpQuestions = insightParsed.followUpQuestions || [];
      analysisStage = insightParsed.analysisStage || "overview";
    } catch {
      // Insight generation failed — return results with a fallback insight
      insightData = { summary: "数据已查询成功，洞察生成失败，请查看表格数据。", highlights: [] };
    }

    return NextResponse.json({
      sql,
      chart,
      insight: insightData,
      followUpQuestions,
      analysisStage,
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
