import { NextRequest, NextResponse } from "next/server";
import { getDatasetById } from "@/lib/dataset-registry";
import { getDatasetSchema } from "@/lib/turso";

export async function GET(request: NextRequest) {
  const datasetId = request.nextUrl.searchParams.get("datasetId");

  if (!datasetId) {
    return NextResponse.json(
      { error: "缺少参数: datasetId" },
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

  try {
    const tables = await getDatasetSchema(dataset.tableNames);
    return NextResponse.json({ tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取表结构失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
