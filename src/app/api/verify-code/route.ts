import { NextRequest, NextResponse } from "next/server";

const ACCESS_CODE = process.env.ACCESS_CODE || "";

export async function POST(request: NextRequest) {
  // If no access code is configured, always allow
  if (!ACCESS_CODE) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { accessCode } = await request.json();
    if (accessCode === ACCESS_CODE) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "密码错误" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "请求无效" }, { status: 400 });
  }
}
