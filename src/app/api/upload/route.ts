import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import { ColumnInfo } from "@/types";

const ACCESS_CODE = process.env.ACCESS_CODE || "";

function mapColumnType(type: string): string {
  switch (type) {
    case "INTEGER": return "INTEGER";
    case "DOUBLE": return "REAL";
    case "BOOLEAN": return "INTEGER";
    default: return "TEXT";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (ACCESS_CODE && body.accessCode !== ACCESS_CODE) {
      return NextResponse.json({ error: "访问密码错误" }, { status: 403 });
    }

    const { tableName, columns, rows } = body as {
      tableName: string;
      columns: ColumnInfo[];
      rows: Record<string, unknown>[];
    };

    if (!tableName || !columns || !rows) {
      return NextResponse.json(
        { error: "缺少必要参数: tableName, columns, rows" },
        { status: 400 }
      );
    }

    const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, "_");
    const db = getTursoClient();

    await db.execute(`DROP TABLE IF EXISTS ${safeName}`);

    const colDefs = columns
      .map((col) => `"${col.name}" ${mapColumnType(col.type)}`)
      .join(", ");
    await db.execute(`CREATE TABLE ${safeName} (${colDefs})`);

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const colNames = columns.map((c) => `"${c.name}"`).join(", ");

      // Build VALUES clause with positional parameters
      const placeholders = batch
        .map((_, rowIdx) => {
          const rowPlaceholders = columns
            .map((_, colIdx) => `?`)
            .join(", ");
          return `(${rowPlaceholders})`;
        })
        .join(", ");

      const args = batch.flatMap((row) =>
        columns.map((col) => {
          const val = row[col.name];
          if (val === null || val === undefined) return null;
          if (col.type === "BOOLEAN") return val ? 1 : 0;
          return val;
        })
      );

      await db.execute({
        sql: `INSERT INTO ${safeName} (${colNames}) VALUES ${placeholders}`,
        args: args as any[],
      });
    }

    return NextResponse.json({
      success: true,
      tableName: safeName,
      rowCount: rows.length,
    });
  } catch (error: unknown) {
    console.error("Upload API error:", error);
    const message = error instanceof Error ? error.message : "数据上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
