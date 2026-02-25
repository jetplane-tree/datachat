import { createClient, Client } from "@libsql/client";

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
