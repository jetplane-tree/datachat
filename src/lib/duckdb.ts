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

/**
 * Load in-memory row data (from file upload) into a DuckDB table.
 * Creates a table via JSON registration.
 */
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

  // Build column type casts if provided to ensure correct types
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
