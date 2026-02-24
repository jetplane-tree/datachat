import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getDatasetById, getSchemaPrompt } from "@/lib/dataset-registry";
import { buildAnalysisPrompt } from "@/lib/llm-prompt";
import { Message } from "@/types";

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY || "",
  baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
});

const model = process.env.LLM_MODEL || "gpt-4o-mini";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      datasetId,
      conversationHistory = [],
    }: {
      question: string;
      datasetId: string;
      conversationHistory: Message[];
    } = body;

    if (!question || !datasetId) {
      return NextResponse.json(
        { error: "缺少必要参数: question 和 datasetId" },
        { status: 400 }
      );
    }

    const dataset = getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: `未找到数据集: ${datasetId}` },
        { status: 404 }
      );
    }

    const schemaInfo = getSchemaPrompt(dataset);
    const prompt = buildAnalysisPrompt(schemaInfo, question, conversationHistory);

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "你是一个专业的数据分析助手，只返回 JSON 格式的分析结果。",
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

    const { sql, chart, insight } = parsed;

    if (!sql || !chart || !insight) {
      return NextResponse.json(
        {
          error: "LLM 返回结果不完整，缺少必要字段",
          raw: rawResponse,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ sql, chart, insight });
  } catch (error: unknown) {
    console.error("Analysis API error:", error);
    const message =
      error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
