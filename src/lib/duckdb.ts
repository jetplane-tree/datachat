/* eslint-disable @typescript-eslint/no-explicit-any */
type DuckDBModule = typeof import("@duckdb/duckdb-wasm");

let duckdb: DuckDBModule | null = null;
let db: any = null;
let conn: any = null;
let initPromise: Promise<any> | null = null;

async function getDuckDB(): Promise<DuckDBModule> {
  if (duckdb) return duckdb;
  duckdb = await import("@duckdb/duckdb-wasm");
  return duckdb;
}

export async function initDuckDB() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await getDuckDB();
      const JSDELIVR_BUNDLES = mod.getJsDelivrBundles();
      const bundle = await mod.selectBundle(JSDELIVR_BUNDLES);
      (bundle as any).pthreadWorker = undefined;

      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        })
      );

      const worker = new Worker(worker_url);
      const logger = new mod.ConsoleLogger();
      db = new mod.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule);
      URL.revokeObjectURL(worker_url);

      return db;
    } catch (err) {
      initPromise = null; // allow retry on failure
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Preload DuckDB WASM in the background (call from homepage).
 */
export function preloadDuckDB(): void {
  if (typeof window === "undefined") return;
  if (db || initPromise) return;
  initDuckDB().catch(() => {});
}

export async function getConnection() {
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
  const columns = result.schema.fields.map((f: any) => f.name);
  const rows = result.toArray().map((row: any) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col: string) => {
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

export async function loadParquetData(
  tableName: string,
  url: string
): Promise<void> {
  const database = await initDuckDB();
  const connection = await getConnection();

  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const fileName = `${tableName}.parquet`;
  await database.registerFileBuffer(fileName, new Uint8Array(buffer));
  await connection.query(
    `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${fileName}')`
  );
}

export async function loadData(
  tableName: string,
  url: string
): Promise<void> {
  if (url.endsWith(".parquet")) {
    await loadParquetData(tableName, url);
  } else {
    await loadJsonData(tableName, url);
  }
}

export async function loadInMemoryData(
  tableName: string,
  rows: Record<string, unknown>[],
  columnTypes?: { name: string; type: string }[]
): Promise<void> {
  const database = await initDuckDB();
  const connection = await getConnection();

  const jsonStr = JSON.stringify(rows);
  const fileName = `${tableName}_upload.json`;
  await database.registerFileText(fileName, jsonStr);

  if (columnTypes && columnTypes.length > 0) {
    const castExpressions = columnTypes.map((col) => {
      if (col.type === "INTEGER") {
        return `CAST("${col.name}" AS INTEGER) AS "${col.name}"`;
      } else if (col.type === "DOUBLE") {
        return `CAST("${col.name}" AS DOUBLE) AS "${col.name}"`;
      } else if (col.type === "DATE") {
        return `CAST("${col.name}" AS DATE) AS "${col.name}"`;
      } else {
        return `CAST("${col.name}" AS VARCHAR) AS "${col.name}"`;
      }
    });

    await connection.query(
      `CREATE OR REPLACE TABLE ${tableName} AS SELECT ${castExpressions.join(", ")} FROM read_json_auto('${fileName}')`
    );
  } else {
    await connection.query(
      `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${fileName}')`
    );
  }
}
