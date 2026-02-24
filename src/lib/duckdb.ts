import * as duckdb from "@duckdb/duckdb-wasm";

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );

  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);

  return db;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const database = await initDuckDB();
  conn = await database.connect();
  return conn;
}

export async function executeQuery(
  sql: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const connection = await getConnection();
  const result = await connection.query(sql);
  const columns = result.schema.fields.map((f) => f.name);
  const rows = result.toArray().map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col) => {
      obj[col] = row[col];
    });
    return obj;
  });
  return { columns, rows };
}

export async function loadJsonData(
  tableName: string,
  url: string
): Promise<void> {
  const database = await initDuckDB();
  const connection = await getConnection();

  const response = await fetch(url);
  const text = await response.text();
  const fileName = `${tableName}.json`;
  await database.registerFileText(fileName, text);
  await connection.query(
    `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${fileName}')`
  );
}
