import { createClient, Client } from "@libsql/client";
import { DatasetTable } from "@/types";

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL environment variable is not set");
    }

    client = createClient({
      url,
      authToken: authToken || undefined,
    });
  }
  return client;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export async function executeQuery(sql: string): Promise<QueryResult> {
  const db = getTursoClient();
  const result = await db.execute(sql);

  const columns = result.columns;
  const rows = result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  return { columns, rows };
}

// --- Dynamic schema ---

const schemaCache = new Map<string, DatasetTable>();

export async function getTableSchema(tableName: string): Promise<DatasetTable> {
  const cached = schemaCache.get(tableName);
  if (cached) return cached;

  const db = getTursoClient();

  // Get column info
  const pragmaResult = await db.execute(`PRAGMA table_info(${tableName})`);
  const columns = pragmaResult.rows.map((row) => ({
    name: String(row[1]),
    type: String(row[2] || "TEXT"),
    description: "",
    sample: "",
  }));

  // Get sample values (first 3 rows)
  const sampleResult = await db.execute(`SELECT * FROM ${tableName} LIMIT 3`);
  if (sampleResult.rows.length > 0) {
    const firstRow = sampleResult.rows[0];
    columns.forEach((col, i) => {
      const val = firstRow[i];
      col.sample = val != null ? String(val) : "";
    });
  }

  // Get row count
  const countResult = await db.execute(`SELECT COUNT(*) FROM ${tableName}`);
  const rowCount = Number(countResult.rows[0]?.[0] ?? 0);

  const table: DatasetTable = {
    name: tableName,
    description: tableName,
    columns,
    rowCount,
  };

  schemaCache.set(tableName, table);
  return table;
}

export async function getDatasetSchema(tableNames: string[]): Promise<DatasetTable[]> {
  return Promise.all(tableNames.map((name) => getTableSchema(name)));
}

export { buildSchemaPrompt } from "@/lib/schema-prompt";
