# Batch 1: Turso Migration + Analysis UX Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace DuckDB WASM with Turso (cloud SQLite), then add data table preview, SQL editing, and chart type switching to the analysis results.

**Architecture:** Move SQL execution from browser-side DuckDB WASM to server-side Turso (libSQL). The API endpoint `/api/analyze` will both generate SQL via LLM and execute it server-side, returning `queryResult` directly. A new `/api/query` endpoint handles ad-hoc SQL execution for the SQL edit feature. Custom file uploads go through a new `/api/upload` endpoint.

**Tech Stack:** `@libsql/client` for Turso, Next.js API routes, shadcn/ui Table for data display, existing ECharts for charts.

---

## Phase 1: Turso Setup

### Task 1: Install Turso client and configure environment

**Files:**
- Modify: `package.json` (add @libsql/client)
- Modify: `.env.example` (add Turso env vars)
- Create: `.env.local` (if not exists, user must fill in)

**Step 1: Install @libsql/client**

Run: `npm install @libsql/client`

**Step 2: Update .env.example**

Add to `.env.example`:

```
# Turso Database
TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

**Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add @libsql/client dependency and Turso env config"
```

---

### Task 2: Create Turso client library

**Files:**
- Create: `src/lib/turso.ts`

**Step 1: Create Turso client singleton**

```typescript
// src/lib/turso.ts
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
```

**Step 2: Commit**

```bash
git add src/lib/turso.ts
git commit -m "feat: add Turso client library with query execution"
```

---

### Task 3: Create seed script for sample data

**Files:**
- Create: `scripts/seed-turso.ts`

**Context:** The existing `scripts/generate-datasets.ts` generates data and writes Parquet files using DuckDB node bindings. We need a new script that generates the same data but writes it to Turso as SQLite tables.

**Step 1: Create seed script**

The script should:
1. Reuse the data generation logic from `generate-datasets.ts` (the PRNG, date utilities, Chinese data constants, product definitions, and the generate functions)
2. Instead of writing Parquet files, execute `CREATE TABLE` + `INSERT` statements against Turso
3. Use the `@libsql/client` package directly (not the app's `turso.ts`)

The script must import dotenv or read `.env.local` to get Turso credentials. Since this project uses Next.js, we can use `dotenv` to load `.env.local`.

```bash
npm install --save-dev dotenv
```

Create `scripts/seed-turso.ts` that:
- Copies the data generation functions from `generate-datasets.ts` (Mulberry32 PRNG, date helpers, Chinese constants, product definitions, and the 3 generate functions)
- Creates tables with `CREATE TABLE IF NOT EXISTS` using SQLite types (TEXT, INTEGER, REAL)
- Inserts data in batches of 100 rows using multi-value INSERT
- Type mapping: VARCHAR→TEXT, INTEGER→INTEGER, DOUBLE→REAL, DATE→TEXT, BOOLEAN→INTEGER

Key table schemas (SQLite):

```sql
-- ecommerce
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT, customer_id TEXT, product_id TEXT, order_date TEXT,
  quantity INTEGER, unit_price REAL, total_amount REAL,
  category TEXT, region TEXT, payment_method TEXT
);
CREATE TABLE IF NOT EXISTS products (
  product_id TEXT, product_name TEXT, category TEXT, brand TEXT,
  cost_price REAL, list_price REAL
);
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT, customer_name TEXT, gender TEXT, age_group TEXT,
  city TEXT, register_date TEXT, membership TEXT
);

-- user-behavior
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT, register_date TEXT, register_channel TEXT,
  device_type TEXT, city TEXT
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT, user_id TEXT, event_type TEXT, event_date TEXT,
  page TEXT, duration_sec INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT, user_id TEXT, session_date TEXT,
  session_duration INTEGER, page_count INTEGER, has_conversion INTEGER
);

-- marketing
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id TEXT, campaign_name TEXT, start_date TEXT,
  end_date TEXT, budget REAL, campaign_type TEXT
);
CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT, campaign_id TEXT, channel_name TEXT,
  spend REAL, impressions INTEGER, clicks INTEGER, report_date TEXT
);
CREATE TABLE IF NOT EXISTS conversions (
  conversion_id TEXT, campaign_id TEXT, channel_name TEXT,
  conversion_date TEXT, conversion_type TEXT, revenue REAL
);
```

**Step 2: Add seed script to package.json**

Add to `scripts` in `package.json`:
```json
"seed-turso": "tsx scripts/seed-turso.ts"
```

**Step 3: Run the seed script**

Run: `npm run seed-turso`
Expected: Tables created and populated in Turso with ~76,800 total rows across 9 tables.

**Step 4: Commit**

```bash
git add scripts/seed-turso.ts package.json
git commit -m "feat: add Turso seed script for sample datasets"
```

---

## Phase 2: Server-side Query Execution

### Task 4: Create /api/query endpoint

**Files:**
- Create: `src/app/api/query/route.ts`

**Step 1: Create query endpoint**

This endpoint accepts raw SQL and executes it against Turso. Used by the SQL edit feature.

```typescript
// src/app/api/query/route.ts
import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/turso";

const ACCESS_CODE = process.env.ACCESS_CODE || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Access code check
    if (ACCESS_CODE && body.accessCode !== ACCESS_CODE) {
      return NextResponse.json({ error: "访问密码错误" }, { status: 403 });
    }

    const { sql } = body;
    if (!sql) {
      return NextResponse.json(
        { error: "缺少必要参数: sql" },
        { status: 400 }
      );
    }

    // Only allow SELECT statements for safety
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      return NextResponse.json(
        { error: "只允许执行 SELECT 查询" },
        { status: 400 }
      );
    }

    const result = await executeQuery(sql);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Query API error:", error);
    const message =
      error instanceof Error ? error.message : "查询执行失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/query/route.ts
git commit -m "feat: add /api/query endpoint for ad-hoc SQL execution"
```

---

### Task 5: Update /api/analyze to execute SQL server-side

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Context:** Currently this endpoint returns `{ sql, chart, insight }` and the client executes SQL via DuckDB. We need it to also execute the SQL via Turso and return `{ sql, chart, insight, queryResult }`. Also add SQL auto-retry server-side.

**Step 1: Add Turso import and execution**

In `src/app/api/analyze/route.ts`:

1. Add import: `import { executeQuery } from "@/lib/turso";`
2. After line 153 (after validating `sql`, `chart`, `insight`), add SQL execution:

```typescript
    // Execute SQL via Turso
    let queryResult;
    try {
      queryResult = await executeQuery(sql);
    } catch (sqlErr) {
      const sqlErrMsg = sqlErr instanceof Error ? sqlErr.message : "未知错误";

      // Auto-retry: ask LLM to fix the SQL
      try {
        const retryPrompt = buildAnalysisPrompt(
          schemaInfo,
          `之前生成的 SQL 执行失败，错误信息: "${sqlErrMsg}"。原始SQL: ${sql}。请修正 SQL 并重新回答原始问题: ${question}`,
          conversationHistory
        );

        const retryCompletion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "你是一个专业的数据分析助手，只返回 JSON 格式的分析结果。" },
            { role: "user", content: retryPrompt },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        });

        const retryRaw = retryCompletion.choices[0]?.message?.content || "";
        const retryJson = extractJSON(retryRaw);
        const retryParsed = JSON.parse(retryJson);

        if (retryParsed.sql) {
          queryResult = await executeQuery(retryParsed.sql);
          return NextResponse.json({
            sql: retryParsed.sql,
            chart: retryParsed.chart || chart,
            insight: retryParsed.insight || insight,
            queryResult,
          }, {
            headers: { "X-RateLimit-Remaining": String(remaining) },
          });
        }
      } catch {
        // Retry also failed
      }

      return NextResponse.json({
        error: `SQL 执行失败: ${sqlErrMsg}`,
      }, { status: 500 });
    }

    return NextResponse.json({ sql, chart, insight, queryResult }, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
```

3. Remove the old `return NextResponse.json({ sql, chart, insight }, ...)` at line 155.

**Step 2: Verify dev server starts**

Run: `npm run dev`
Expected: No build errors.

**Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: execute SQL server-side via Turso in /api/analyze"
```

---

### Task 6: Update LLM prompt for SQLite dialect

**Files:**
- Modify: `src/lib/llm-prompt.ts`

**Step 1: Change SQL dialect**

Replace the DuckDB SQL section (lines 23-29) with SQLite:

```typescript
## SQL 方言
使用 SQLite SQL 语法。注意：
- 日期函数使用 SQLite 语法 (如 strftime('%Y-%m', date_col), date(), julianday())
- 字符串使用单引号
- 支持 CTE (WITH 子句)
- 支持窗口函数 (ROW_NUMBER, RANK, LAG, LEAD 等)
- 布尔值存储为 INTEGER (0/1)，使用 WHERE col = 1 而非 WHERE col = true
- 不支持 DATE_TRUNC，使用 strftime 替代
- 不支持 EXTRACT，使用 strftime 替代，例如 strftime('%Y', date_col) 取年份
```

**Step 2: Commit**

```bash
git add src/lib/llm-prompt.ts
git commit -m "feat: update LLM prompt from DuckDB to SQLite dialect"
```

---

### Task 7: Create /api/upload endpoint for custom file uploads

**Files:**
- Create: `src/app/api/upload/route.ts`

**Context:** Custom file uploads currently parse the file client-side and load into browser DuckDB. Now we need to send the parsed data to the server, which creates a temp table in Turso.

**Step 1: Create upload endpoint**

```typescript
// src/app/api/upload/route.ts
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

    // Sanitize table name
    const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, "_");

    const db = getTursoClient();

    // Drop existing table if any
    await db.execute(`DROP TABLE IF EXISTS ${safeName}`);

    // Create table
    const colDefs = columns
      .map((col) => `"${col.name}" ${mapColumnType(col.type)}`)
      .join(", ");
    await db.execute(`CREATE TABLE ${safeName} (${colDefs})`);

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const colNames = columns.map((c) => `"${c.name}"`).join(", ");
      const valuePlaceholders = batch
        .map((_, idx) => {
          const placeholders = columns
            .map((_, ci) => `?${idx * columns.length + ci + 1}`)
            .join(", ");
          return `(${placeholders})`;
        })
        .join(", ");

      // Note: libsql positional params use ?N syntax
      // Flatten all values
      const args = batch.flatMap((row) =>
        columns.map((col) => {
          const val = row[col.name];
          if (val === null || val === undefined) return null;
          if (col.type === "BOOLEAN") return val ? 1 : 0;
          return val;
        })
      );

      await db.execute({
        sql: `INSERT INTO ${safeName} (${colNames}) VALUES ${valuePlaceholders}`,
        args,
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
```

**Step 2: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: add /api/upload endpoint for custom file data"
```

---

## Phase 3: Client Migration — Remove DuckDB

### Task 8: Update [datasetId] analysis page

**Files:**
- Modify: `src/app/analyze/[datasetId]/page.tsx`

**Context:** Remove all DuckDB usage. The page no longer needs to initialize DuckDB or run queries client-side. The `/api/analyze` endpoint now returns `queryResult` directly.

**Step 1: Remove DuckDB imports and hook**

Remove:
- Line 6: `import { useDuckDB } from "@/hooks/use-duckdb";`
- Line 20: `const { isLoading, isReady, error, loadingStage, loadDataset, runQuery } = useDuckDB();`
- Line 26-32: The `useEffect` that calls `loadDataset(dataset)`

Replace with simple state:
```typescript
const [isReady, setIsReady] = useState(true); // No loading needed
```

**Step 2: Simplify handleSubmit**

The `handleSubmit` function (lines 38-156) currently:
1. Calls `/api/analyze` to get `{ sql, chart, insight }`
2. Runs SQL client-side via `runQuery()`
3. Has auto-retry logic that calls LLM again then retries SQL

Now it should:
1. Call `/api/analyze` to get `{ sql, chart, insight, queryResult }` — everything comes from server
2. No client-side SQL execution
3. No auto-retry (server handles it)

Simplified handleSubmit:
```typescript
const handleSubmit = useCallback(
  async (question: string) => {
    if (!dataset || isAnalyzing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: Date.now(),
    };

    const assistantId = `msg-${Date.now() + 1}`;
    const placeholderMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMessage, placeholderMessage]);
    setIsAnalyzing(true);
    setAnalyzeStage("AI 正在分析你的问题...");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          datasetId: dataset.id,
          conversationHistory: messages.slice(-6),
          accessCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          clearCode();
          throw new Error("访问密码已失效，请重新输入");
        }
        throw new Error(data.error || "分析请求失败");
      }

      const analysis: AnalysisResult = {
        sql: data.sql,
        chart: data.chart,
        insight: data.insight,
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: analysis.insight, analysis, queryResult: data.queryResult }
            : m
        )
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "分析失败，请重试";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: errMsg, error: errMsg } : m
        )
      );
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStage("");
    }
  },
  [dataset, isAnalyzing, messages, accessCode, clearCode]
);
```

**Step 3: Remove loading/error states for DuckDB**

Remove the DuckDB loading state (lines 200-220) and the `isLoading` / `loadingStage` conditional rendering. Keep the `isReady` checks for backward compatibility (it's just always true now). Remove `Database` import from lucide if no longer used.

**Step 4: Verify dev server renders page**

Run: `npm run dev`, navigate to `/analyze/ecommerce`
Expected: Page loads without DuckDB initialization.

**Step 5: Commit**

```bash
git add src/app/analyze/[datasetId]/page.tsx
git commit -m "refactor: remove DuckDB from dataset analysis page, use server-side execution"
```

---

### Task 9: Update custom upload page

**Files:**
- Modify: `src/app/analyze/custom/page.tsx`

**Context:** Remove DuckDB. After parsing the file client-side, POST the data to `/api/upload`, then use the same analysis flow as dataset pages.

**Step 1: Remove DuckDB imports and hook**

Remove:
- Line 4: `import { useDuckDB } from "@/hooks/use-duckdb";`
- Line 26: `const { isLoading, isReady, error, loadCustomData, runQuery } = useDuckDB();`

Replace with:
```typescript
const [isReady, setIsReady] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Step 2: Update handleFile to upload to server**

Replace the DuckDB loading (line 61: `await loadCustomData(TABLE_NAME, rows, columns)`) with:

```typescript
// Upload data to server
setIsLoading(true);
const uploadRes = await fetch("/api/upload", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tableName: TABLE_NAME,
    columns,
    rows,
    accessCode,
  }),
});

const uploadData = await uploadRes.json();
if (!uploadRes.ok) {
  throw new Error(uploadData.error || "数据上传失败");
}

setIsReady(true);
setIsLoading(false);
```

**Step 3: Simplify handleSubmit (same as Task 8)**

Remove client-side `runQuery()` calls and auto-retry logic. Use the same simplified pattern: call `/api/analyze` and get `queryResult` from server.

**Step 4: Remove DuckDB-specific loading/error states**

Keep file parsing state, remove DuckDB engine loading references.

**Step 5: Commit**

```bash
git add src/app/analyze/custom/page.tsx
git commit -m "refactor: remove DuckDB from custom upload page, use server-side upload"
```

---

### Task 10: Remove DuckDB from homepage and clean up

**Files:**
- Modify: `src/app/page.tsx` (remove DuckDBPreloader)
- Delete: `src/components/duckdb-preloader.tsx`
- Delete: `src/hooks/use-duckdb.ts`
- Delete: `src/lib/duckdb.ts`

**Step 1: Remove DuckDBPreloader from homepage**

In `src/app/page.tsx`:
- Remove line 3: `import { DuckDBPreloader } from "@/components/duckdb-preloader";`
- Remove line 10: `<DuckDBPreloader />`

**Step 2: Delete DuckDB files**

```bash
rm src/components/duckdb-preloader.tsx
rm src/hooks/use-duckdb.ts
rm src/lib/duckdb.ts
```

**Step 3: Uninstall DuckDB packages**

```bash
npm uninstall @duckdb/duckdb-wasm
```

Also remove optional dependencies from `package.json`:
- `@duckdb/node-bindings`
- `@duckdb/node-bindings-darwin-arm64`

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no DuckDB references.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove DuckDB WASM and all related files"
```

---

## Phase 4: New Features

### Task 11: Create DataTable component

**Files:**
- Create: `src/components/analyze/data-table.tsx`

**Step 1: Create the data table component**

```typescript
// src/components/analyze/data-table.tsx
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Copy, Check, TableIcon } from "lucide-react";
import { QueryResult } from "@/types";

interface DataTableProps {
  queryResult: QueryResult;
}

const PAGE_SIZE = 10;
const MAX_ROWS = 100;

export function DataTable({ queryResult }: DataTableProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);

  const { columns, rows } = queryResult;
  const displayRows = rows.slice(0, MAX_ROWS);
  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const pageRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleCopyCSV = async () => {
    const header = columns.join(",");
    const body = displayRows
      .map((row) =>
        columns
          .map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      )
      .join("\n");
    await navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNumeric = (col: string) => {
    const sample = rows.slice(0, 5).map((r) => r[col]);
    return sample.every((v) => v === null || v === undefined || typeof v === "number");
  };

  return (
    <div className="mx-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <TableIcon className="h-3 w-3" />
        查看数据 ({rows.length} 行)
        <span className="text-[10px]">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col}
                      className={`text-xs whitespace-nowrap ${isNumeric(col) ? "text-right" : ""}`}
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        className={`text-xs whitespace-nowrap ${isNumeric(col) ? "text-right tabular-nums" : ""}`}
                      >
                        {row[col] === null || row[col] === undefined
                          ? "—"
                          : String(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer: pagination + copy */}
          <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-6 w-6 p-0"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-6 w-6 p-0"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCSV}
              className="h-6 gap-1 text-[10px] text-muted-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "已复制" : "复制 CSV"}
            </Button>
          </div>

          {rows.length > MAX_ROWS && (
            <div className="border-t border-border/30 px-3 py-1.5 text-center">
              <span className="text-[10px] text-muted-foreground">
                仅显示前 {MAX_ROWS} 行（共 {rows.length} 行）
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Ensure shadcn/ui Table is installed**

Run: `npx shadcn@latest add table` (if not already present)
Check: `src/components/ui/table.tsx` exists.

**Step 3: Commit**

```bash
git add src/components/analyze/data-table.tsx src/components/ui/table.tsx
git commit -m "feat: add DataTable component with pagination and CSV copy"
```

---

### Task 12: Integrate DataTable into AnalysisCard

**Files:**
- Modify: `src/components/analyze/analysis-card.tsx`

**Step 1: Add DataTable import**

Add at the top of `analysis-card.tsx`:
```typescript
import { DataTable } from "@/components/analyze/data-table";
```

**Step 2: Insert DataTable between chart and insight**

In the `{/* Analysis results */}` section (line 143-202), insert after the chart section (after line 161, before the insight section):

```tsx
{/* Data table */}
{queryResult && queryResult.rows.length > 0 && (
  <div className="pt-2 pb-1">
    <DataTable queryResult={queryResult} />
  </div>
)}
```

**Step 3: Verify**

Run: `npm run dev`, ask a question, expand data table.
Expected: Table shows with pagination.

**Step 4: Commit**

```bash
git add src/components/analyze/analysis-card.tsx
git commit -m "feat: integrate DataTable into analysis results"
```

---

### Task 13: Add SQL edit and re-execute to AnalysisCard

**Files:**
- Modify: `src/components/analyze/analysis-card.tsx`

**Context:** Currently the SQL section shows a readonly `<pre>` with copy button. We need to add an "edit" mode with a `<textarea>` and an "execute" button. On execute, call `/api/query`, then update `queryResult` and re-render the chart.

**Step 1: Add state and handler**

Add new props to `AnalysisCardProps`:
```typescript
interface AnalysisCardProps {
  userMessage: Message;
  assistantMessage: Message;
  isFollowUp?: boolean;
  onRetry?: (question: string) => void;
  onUpdateResult?: (messageId: string, queryResult: QueryResult, sql: string) => void;
  analyzeStage?: string;
  accessCode?: string;
}
```

Add state inside the component:
```typescript
const [editingSQL, setEditingSQL] = useState(false);
const [editedSQL, setEditedSQL] = useState("");
const [executing, setExecuting] = useState(false);
const [executeError, setExecuteError] = useState<string | null>(null);
```

Add handler:
```typescript
const handleEditSQL = () => {
  setEditedSQL(analysis?.sql || "");
  setEditingSQL(true);
  setExecuteError(null);
};

const handleCancelEdit = () => {
  setEditingSQL(false);
  setEditedSQL("");
  setExecuteError(null);
};

const handleExecuteSQL = async () => {
  if (!editedSQL.trim() || !onUpdateResult) return;
  setExecuting(true);
  setExecuteError(null);

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: editedSQL, accessCode }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "查询失败");

    onUpdateResult(assistantMessage.id, data, editedSQL);
    setEditingSQL(false);
  } catch (err) {
    setExecuteError(err instanceof Error ? err.message : "执行失败");
  } finally {
    setExecuting(false);
  }
};
```

**Step 2: Update SQL section JSX**

Replace the SQL section (lines 171-200) with:

```tsx
{/* SQL section */}
<div className="px-5 pb-4 pt-2">
  <div className="flex items-center gap-2">
    <button
      onClick={() => setSqlExpanded(!sqlExpanded)}
      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {sqlExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      查看 SQL
    </button>
    {sqlExpanded && !editingSQL && (
      <div className="flex items-center gap-1">
        <button
          onClick={handleEditSQL}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          编辑
        </button>
        <button
          onClick={handleCopySQL}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    )}
  </div>

  {sqlExpanded && (
    <div className="mt-2">
      {editingSQL ? (
        <div className="space-y-2">
          <textarea
            value={editedSQL}
            onChange={(e) => setEditedSQL(e.target.value)}
            className="w-full rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500/50"
            rows={Math.min(editedSQL.split("\n").length + 2, 12)}
          />
          {executeError && (
            <p className="text-xs text-destructive">{executeError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 text-xs">
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteSQL}
              disabled={executing || !editedSQL.trim()}
              className="h-7 gap-1 text-xs"
            >
              {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              执行查询
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg bg-zinc-950 p-3">
          <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-300">
            <code>{analysis?.sql}</code>
          </pre>
        </div>
      )}
    </div>
  )}
</div>
```

**Step 3: Add Play and Loader2 imports**

Add to lucide imports: `Play, Loader2`

**Step 4: Update AnalysisList and parent pages**

In `analysis-list.tsx`, add `onUpdateResult` and `accessCode` props, pass them through to `AnalysisCard`.

In `[datasetId]/page.tsx` and `custom/page.tsx`, add the `onUpdateResult` handler:
```typescript
const handleUpdateResult = useCallback(
  (messageId: string, queryResult: QueryResult, sql: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              queryResult,
              analysis: m.analysis ? { ...m.analysis, sql } : m.analysis,
            }
          : m
      )
    );
  },
  []
);
```

Pass it to `<AnalysisList onUpdateResult={handleUpdateResult} accessCode={accessCode} ... />`.

**Step 5: Commit**

```bash
git add src/components/analyze/analysis-card.tsx src/components/analyze/analysis-list.tsx src/app/analyze/[datasetId]/page.tsx src/app/analyze/custom/page.tsx
git commit -m "feat: add SQL editing and re-execution in analysis cards"
```

---

### Task 14: Add chart type switcher

**Files:**
- Modify: `src/components/analyze/analysis-card.tsx`
- Modify: `src/components/analyze/chart-renderer.tsx`

**Step 1: Add chart type state to AnalysisCard**

Add state:
```typescript
const [overrideChartType, setOverrideChartType] = useState<string | null>(null);
```

Reset when SQL is re-executed (in `handleExecuteSQL` success):
```typescript
setOverrideChartType(null);
```

**Step 2: Add chart type dropdown in chart area**

In the chart section of AnalysisCard, wrap the ChartRenderer with a container that has the dropdown:

```tsx
{/* Chart */}
<div className="px-5 pt-4 pb-2">
  {queryResult && queryResult.rows.length > 0 ? (
    <div className="relative">
      {/* Chart type switcher */}
      <div className="absolute right-0 top-0 z-10">
        <select
          value={overrideChartType || analysis.chart.type}
          onChange={(e) => setOverrideChartType(e.target.value)}
          className="rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] text-muted-foreground outline-none hover:border-border focus:ring-1 focus:ring-indigo-500/50"
        >
          <option value="bar">柱状图</option>
          <option value="line">折线图</option>
          <option value="pie">饼图</option>
          <option value="scatter">散点图</option>
          <option value="funnel">漏斗图</option>
        </select>
      </div>
      <ChartRenderer
        chartConfig={{
          ...analysis.chart,
          type: (overrideChartType || analysis.chart.type) as ChartConfig["type"],
        }}
        queryResult={queryResult}
      />
    </div>
  ) : (
    /* ... empty state ... */
  )}
</div>
```

**Step 3: Add ChartConfig import**

Add to imports in `analysis-card.tsx`:
```typescript
import { ChartConfig } from "@/types";
```

**Step 4: Verify**

Run: `npm run dev`, ask a question, switch chart types via dropdown.
Expected: Chart re-renders with the selected type.

**Step 5: Commit**

```bash
git add src/components/analyze/analysis-card.tsx
git commit -m "feat: add chart type switcher dropdown"
```

---

## Phase 5: Final Cleanup

### Task 15: Update dataset-registry to remove dataFiles references

**Files:**
- Modify: `src/lib/dataset-registry.ts`

**Step 1: Clean up dataFiles**

The `dataFiles` field pointed to Parquet files in `/public/data/`. Since we now use Turso, these references are no longer needed. Set them to empty objects or remove the field entirely.

For each dataset, change `dataFiles` to `{}`:

```typescript
dataFiles: {},
```

**Step 2: Optionally delete Parquet files**

```bash
rm -rf public/data/
```

**Step 3: Commit**

```bash
git add src/lib/dataset-registry.ts
git rm -r public/data/
git commit -m "chore: remove Parquet files and dataFiles references after Turso migration"
```

---

### Task 16: Update README and environment docs

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Update README**

Update the tech stack section to mention Turso instead of DuckDB WASM. Update setup instructions to include Turso setup steps:
1. Create Turso account and database
2. Get database URL and auth token
3. Run `npm run seed-turso` to populate sample data

**Step 2: Update .env.example**

Ensure it includes all current env vars.

**Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: update README and env config for Turso migration"
```

---

### Task 17: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds.

**Step 2: Start production server**

Run: `npm run start`
Expected: All pages load correctly.

**Step 3: Test all features**

- Navigate to `/` — homepage loads without DuckDB preloader
- Navigate to `/analyze/ecommerce` — analysis works, results show chart + data table + SQL
- Try SQL edit → execute → chart updates
- Try chart type switching
- Navigate to `/analyze/custom` — upload a CSV → analysis works
- Try preset questions for all 3 datasets

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments after Turso migration"
```
