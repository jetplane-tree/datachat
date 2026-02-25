import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/turso";

const ACCESS_CODE = process.env.ACCESS_CODE || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (ACCESS_CODE && body.accessCode !== ACCESS_CODE) {
      return NextResponse.json({ error: "访问密码错误" }, { status: 403 });
    }

    const { sql } = body;
    if (!sql) {
      return NextResponse.json({ error: "缺少必要参数: sql" }, { status: 400 });
    }

    // Only allow SELECT statements for safety
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      return NextResponse.json({ error: "只允许执行 SELECT 查询" }, { status: 400 });
    }

    const result = await executeQuery(sql);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Query API error:", error);
    const message = error instanceof Error ? error.message : "查询执行失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
