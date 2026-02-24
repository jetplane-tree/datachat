# DataChat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a natural-language-driven data analysis platform where users query built-in datasets (or upload their own) in Chinese, and AI returns SQL + charts + insights.

**Architecture:** Next.js App Router full-stack app. Frontend runs DuckDB WASM to execute SQL queries against pre-bundled Parquet datasets. Backend API Routes call LLM (DeepSeek/OpenAI) to translate natural language into structured JSON (SQL + chart config + insight text). ECharts renders charts on the frontend.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, DuckDB WASM, ECharts, Apache Parquet, DeepSeek/OpenAI API, Vercel

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.env.local`, `.env.example`, `.gitignore`

**Step 1: Initialize Next.js project**

```bash
cd /Users/hewantong/kamook/ai-learning/easyvibe-task5
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full Next.js + Tailwind + TypeScript scaffold.

**Step 2: Install core dependencies**

```bash
npm install @duckdb/duckdb-wasm echarts echarts-for-react @apache-arrow/ts apache-arrow
npm install openai
npm install xlsx
npm install lucide-react
```

**Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables = yes.

Then add components:

```bash
npx shadcn@latest add button card input textarea tabs badge dialog scroll-area separator skeleton tooltip
```

**Step 4: Create environment files**

Create `.env.example`:
```
# LLM API Configuration
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

Create `.env.local` with actual values (gitignored).

**Step 5: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with Tailwind, shadcn/ui, DuckDB, ECharts"
```

---

## Task 2: DuckDB WASM Integration

**Files:**
- Create: `src/lib/duckdb.ts` — DuckDB WASM singleton, init, query execution
- Create: `src/lib/dataset-registry.ts` — dataset metadata + schema definitions
- Create: `src/types/index.ts` — shared TypeScript types

**Step 1: Define shared types**

Create `src/types/index.ts`:

```typescript
// Dataset metadata
export interface DatasetTable {
  name: string;
  description: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string; // VARCHAR, INTEGER, DOUBLE, DATE, etc.
  description: string;
  sample: string; // example value
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  tables: DatasetTable[];
  presetQuestions: string[];
  parquetFiles: Record<string, string>; // tableName -> public path to parquet file
}

// LLM response
export interface AnalysisResult {
  sql: string;
  chart: ChartConfig;
  insight: string;
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "scatter" | "heatmap" | "funnel";
  xField?: string;
  yField?: string;
  seriesField?: string;
  title: string;
}

// Query results
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

// Conversation
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisResult;
  queryResult?: QueryResult;
  error?: string;
  timestamp: number;
}
```

**Step 2: Create DuckDB WASM singleton**

Create `src/lib/duckdb.ts`:

```typescript
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

export async function executeQuery(sql: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
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

export async function loadParquetFromUrl(tableName: string, url: string): Promise<void> {
  const database = await initDuckDB();
  const connection = await getConnection();

  // Fetch the parquet file and register it
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await database.registerFileBuffer(`${tableName}.parquet`, new Uint8Array(buffer));
  await connection.query(
    `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${tableName}.parquet')`
  );
}
```

**Step 3: Create dataset registry**

Create `src/lib/dataset-registry.ts` — defines the 3 built-in datasets with full schema, preset questions, and file paths. (Detailed data definitions will be created in Task 3.)

```typescript
import { Dataset } from "@/types";

export const datasets: Dataset[] = [
  {
    id: "ecommerce",
    name: "电商销售数据",
    description: "包含订单、商品、客户数据，适合销售趋势分析、品类分析、客户价值分析",
    icon: "ShoppingCart",
    tables: [
      {
        name: "orders",
        description: "订单表",
        rowCount: 5000,
        columns: [
          { name: "order_id", type: "VARCHAR", description: "订单ID", sample: "ORD-20240101-001" },
          { name: "customer_id", type: "VARCHAR", description: "客户ID", sample: "CUST-001" },
          { name: "product_id", type: "VARCHAR", description: "商品ID", sample: "PROD-001" },
          { name: "order_date", type: "DATE", description: "下单日期", sample: "2024-01-15" },
          { name: "quantity", type: "INTEGER", description: "购买数量", sample: "2" },
          { name: "unit_price", type: "DOUBLE", description: "单价（元）", sample: "299.00" },
          { name: "total_amount", type: "DOUBLE", description: "总金额（元）", sample: "598.00" },
          { name: "category", type: "VARCHAR", description: "商品类目", sample: "数码配件" },
          { name: "region", type: "VARCHAR", description: "地区", sample: "华东" },
          { name: "payment_method", type: "VARCHAR", description: "支付方式", sample: "支付宝" },
        ],
      },
      {
        name: "products",
        description: "商品表",
        rowCount: 200,
        columns: [
          { name: "product_id", type: "VARCHAR", description: "商品ID", sample: "PROD-001" },
          { name: "product_name", type: "VARCHAR", description: "商品名称", sample: "无线蓝牙耳机" },
          { name: "category", type: "VARCHAR", description: "类目", sample: "数码配件" },
          { name: "brand", type: "VARCHAR", description: "品牌", sample: "索尼" },
          { name: "cost_price", type: "DOUBLE", description: "成本价", sample: "150.00" },
          { name: "list_price", type: "DOUBLE", description: "标价", sample: "299.00" },
        ],
      },
      {
        name: "customers",
        description: "客户表",
        rowCount: 1000,
        columns: [
          { name: "customer_id", type: "VARCHAR", description: "客户ID", sample: "CUST-001" },
          { name: "customer_name", type: "VARCHAR", description: "客户名称", sample: "张三" },
          { name: "gender", type: "VARCHAR", description: "性别", sample: "男" },
          { name: "age_group", type: "VARCHAR", description: "年龄段", sample: "25-34" },
          { name: "city", type: "VARCHAR", description: "城市", sample: "上海" },
          { name: "register_date", type: "DATE", description: "注册日期", sample: "2023-06-15" },
          { name: "membership", type: "VARCHAR", description: "会员等级", sample: "金卡" },
        ],
      },
    ],
    presetQuestions: [
      "各月销售额趋势是怎样的？",
      "哪个商品类目的销售额最高？",
      "各地区的销售额对比如何？",
      "不同支付方式的使用占比是多少？",
      "客单价最高的前10个客户是谁？",
    ],
    parquetFiles: {
      orders: "/data/ecommerce/orders.parquet",
      products: "/data/ecommerce/products.parquet",
      customers: "/data/ecommerce/customers.parquet",
    },
  },
  {
    id: "user-behavior",
    name: "用户行为数据",
    description: "包含用户注册、行为事件、会话数据，适合留存分析、转化漏斗、活跃趋势",
    icon: "Users",
    tables: [
      {
        name: "users",
        description: "用户表",
        rowCount: 2000,
        columns: [
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "register_date", type: "DATE", description: "注册日期", sample: "2024-01-05" },
          { name: "register_channel", type: "VARCHAR", description: "注册渠道", sample: "微信" },
          { name: "device_type", type: "VARCHAR", description: "设备类型", sample: "iOS" },
          { name: "city", type: "VARCHAR", description: "城市", sample: "北京" },
        ],
      },
      {
        name: "events",
        description: "用户行为事件表",
        rowCount: 50000,
        columns: [
          { name: "event_id", type: "VARCHAR", description: "事件ID", sample: "EVT-00001" },
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "event_type", type: "VARCHAR", description: "事件类型", sample: "page_view" },
          { name: "event_date", type: "DATE", description: "事件日期", sample: "2024-01-05" },
          { name: "page", type: "VARCHAR", description: "页面", sample: "首页" },
          { name: "duration_sec", type: "INTEGER", description: "停留时长（秒）", sample: "45" },
        ],
      },
      {
        name: "sessions",
        description: "会话表",
        rowCount: 15000,
        columns: [
          { name: "session_id", type: "VARCHAR", description: "会话ID", sample: "SES-00001" },
          { name: "user_id", type: "VARCHAR", description: "用户ID", sample: "U-10001" },
          { name: "session_date", type: "DATE", description: "会话日期", sample: "2024-01-05" },
          { name: "session_duration", type: "INTEGER", description: "会话时长（秒）", sample: "320" },
          { name: "page_count", type: "INTEGER", description: "浏览页数", sample: "8" },
          { name: "has_conversion", type: "BOOLEAN", description: "是否转化", sample: "true" },
        ],
      },
    ],
    presetQuestions: [
      "每日活跃用户数（DAU）趋势如何？",
      "用户注册后7日留存率是多少？",
      "各注册渠道的用户数量对比？",
      "页面浏览的转化漏斗是怎样的？",
      "iOS和Android用户的行为有什么差异？",
    ],
    parquetFiles: {
      users: "/data/user-behavior/users.parquet",
      events: "/data/user-behavior/events.parquet",
      sessions: "/data/user-behavior/sessions.parquet",
    },
  },
  {
    id: "marketing",
    name: "营销活动数据",
    description: "包含营销活动、投放渠道、转化数据，适合ROI分析、渠道对比、归因分析",
    icon: "Megaphone",
    tables: [
      {
        name: "campaigns",
        description: "营销活动表",
        rowCount: 100,
        columns: [
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "campaign_name", type: "VARCHAR", description: "活动名称", sample: "春节大促" },
          { name: "start_date", type: "DATE", description: "开始日期", sample: "2024-01-20" },
          { name: "end_date", type: "DATE", description: "结束日期", sample: "2024-02-10" },
          { name: "budget", type: "DOUBLE", description: "预算（元）", sample: "50000.00" },
          { name: "campaign_type", type: "VARCHAR", description: "活动类型", sample: "促销" },
        ],
      },
      {
        name: "channels",
        description: "投放渠道表",
        rowCount: 500,
        columns: [
          { name: "channel_id", type: "VARCHAR", description: "渠道记录ID", sample: "CH-001" },
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "channel_name", type: "VARCHAR", description: "渠道名称", sample: "抖音" },
          { name: "spend", type: "DOUBLE", description: "花费（元）", sample: "12000.00" },
          { name: "impressions", type: "INTEGER", description: "曝光量", sample: "500000" },
          { name: "clicks", type: "INTEGER", description: "点击量", sample: "15000" },
          { name: "report_date", type: "DATE", description: "报告日期", sample: "2024-01-25" },
        ],
      },
      {
        name: "conversions",
        description: "转化数据表",
        rowCount: 3000,
        columns: [
          { name: "conversion_id", type: "VARCHAR", description: "转化ID", sample: "CONV-001" },
          { name: "campaign_id", type: "VARCHAR", description: "活动ID", sample: "CMP-001" },
          { name: "channel_name", type: "VARCHAR", description: "渠道名称", sample: "抖音" },
          { name: "conversion_date", type: "DATE", description: "转化日期", sample: "2024-01-26" },
          { name: "conversion_type", type: "VARCHAR", description: "转化类型", sample: "下单" },
          { name: "revenue", type: "DOUBLE", description: "转化金额（元）", sample: "399.00" },
        ],
      },
    ],
    presetQuestions: [
      "各营销活动的ROI（投入产出比）排名？",
      "哪个投放渠道的转化率最高？",
      "各渠道的花费与转化金额对比？",
      "春节大促期间每日的转化趋势？",
      "不同活动类型的平均获客成本是多少？",
    ],
    parquetFiles: {
      campaigns: "/data/marketing/campaigns.parquet",
      channels: "/data/marketing/channels.parquet",
      conversions: "/data/marketing/conversions.parquet",
    },
  },
];

export function getDatasetById(id: string): Dataset | undefined {
  return datasets.find((d) => d.id === id);
}

export function getSchemaPrompt(dataset: Dataset): string {
  let prompt = `数据集: ${dataset.name}\n\n`;
  for (const table of dataset.tables) {
    prompt += `表名: ${table.name} (${table.description}, 约${table.rowCount}行)\n`;
    prompt += `字段:\n`;
    for (const col of table.columns) {
      prompt += `  - ${col.name} (${col.type}): ${col.description}, 示例: ${col.sample}\n`;
    }
    prompt += `\n`;
  }
  return prompt;
}
```

**Step 4: Run the dev server to verify**

```bash
npm run dev
```

Expected: App loads at http://localhost:3000 without errors.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add DuckDB WASM integration, types, and dataset registry"
```

---

## Task 3: Generate Demo Datasets

**Files:**
- Create: `scripts/generate-datasets.ts` — Node.js script that generates realistic demo data and writes Parquet files
- Create: `public/data/ecommerce/*.parquet`
- Create: `public/data/user-behavior/*.parquet`
- Create: `public/data/marketing/*.parquet`

**Step 1: Install script dependencies**

```bash
npm install --save-dev tsx parquetjs-lite
```

**Step 2: Create dataset generation script**

Create `scripts/generate-datasets.ts`:

This script generates realistic Chinese business data:
- **Ecommerce**: 5000 orders across 12 months, 200 products in 8 categories, 1000 customers in 5 regions. Includes seasonality (Q4 peak for Double 11/12).
- **User Behavior**: 2000 users, 50000 events (page_view, click, add_to_cart, purchase), 15000 sessions. Includes realistic retention decay.
- **Marketing**: 100 campaigns across 6 types, 500 channel records across 5 channels (抖音/微信/小红书/百度/微博), 3000 conversions with varying ROI.

Use `parquetjs-lite` to write Parquet files to `public/data/` directory.

Key data generation logic:
- Use seeded random for reproducibility
- Chinese names, cities, product names
- Realistic distributions (not uniform random)
- Date ranges: 2024-01-01 to 2024-12-31

**Step 3: Run the generation script**

```bash
npx tsx scripts/generate-datasets.ts
```

Expected: Parquet files created in `public/data/` directories.

**Step 4: Verify data loads in DuckDB**

Create a quick test: load one parquet file in the browser and run `SELECT COUNT(*) FROM orders`.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: generate demo datasets (ecommerce, user-behavior, marketing) as Parquet files"
```

---

## Task 4: LLM API Route

**Files:**
- Create: `src/app/api/analyze/route.ts` — API route that calls LLM
- Create: `src/lib/llm-prompt.ts` — prompt template construction

**Step 1: Create prompt template**

Create `src/lib/llm-prompt.ts`:

```typescript
import { Message } from "@/types";

export function buildAnalysisPrompt(
  schemaInfo: string,
  question: string,
  conversationHistory: Message[]
): string {
  const historyContext = conversationHistory
    .slice(-6) // last 3 pairs of messages
    .map((m) => {
      if (m.role === "user") return `用户: ${m.content}`;
      if (m.analysis) return `分析结果: SQL=${m.analysis.sql}, 洞察=${m.analysis.insight}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return `你是一个专业的数据分析师。根据用户的问题，生成 SQL 查询语句、图表配置和数据洞察。

## 数据库信息
${schemaInfo}

## SQL 方言
使用 DuckDB SQL 语法。注意：
- 日期函数使用 DuckDB 语法 (如 DATE_TRUNC, EXTRACT, DATE_PART)
- 字符串使用单引号
- 支持 CTE (WITH 子句)
- 支持窗口函数

${historyContext ? `## 对话上下文\n${historyContext}\n` : ""}

## 用户问题
${question}

## 输出要求
返回严格的 JSON 格式，不要包含任何其他文本或 markdown 标记：
{
  "sql": "完整的 SQL 查询语句",
  "chart": {
    "type": "line | bar | pie | scatter | heatmap | funnel",
    "xField": "X轴字段名",
    "yField": "Y轴字段名（聚合值）",
    "seriesField": "系列字段名（可选，用于多系列图表）",
    "title": "图表标题"
  },
  "insight": "2-3句话的数据洞察，包含关键数字和业务建议"
}

注意事项:
- SQL 必须只使用上面列出的表和字段
- 饼图的 type 使用 "pie"，xField 是分类字段，yField 是数值字段
- 根据问题选择最合适的图表类型
- 洞察要具体，包含数字，给出业务意义的解读
- 只返回 JSON，不要返回其他任何内容`;
}
```

**Step 2: Create API route**

Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAnalysisPrompt } from "@/lib/llm-prompt";
import { getDatasetById, getSchemaPrompt } from "@/lib/dataset-registry";
import { Message } from "@/types";

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, datasetId, conversationHistory = [] } = body as {
      question: string;
      datasetId: string;
      conversationHistory: Message[];
    };

    if (!question || !datasetId) {
      return NextResponse.json(
        { error: "question and datasetId are required" },
        { status: 400 }
      );
    }

    const dataset = getDatasetById(datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: `Dataset "${datasetId}" not found` },
        { status: 404 }
      );
    }

    const schemaInfo = getSchemaPrompt(dataset);
    const prompt = buildAnalysisPrompt(schemaInfo, question, conversationHistory);

    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "LLM returned empty response" },
        { status: 500 }
      );
    }

    // Parse JSON from LLM response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analysis API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 3: Test API route with curl**

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"question":"各月销售额趋势","datasetId":"ecommerce"}'
```

Expected: JSON response with `sql`, `chart`, and `insight` fields.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add LLM API route for natural language to SQL+chart analysis"
```

---

## Task 5: Homepage

**Files:**
- Create: `src/app/page.tsx` — homepage with dataset cards
- Create: `src/components/layout/header.tsx` — shared header/nav
- Create: `src/components/home/dataset-card.tsx` — dataset selection card
- Create: `src/components/home/upload-card.tsx` — upload data card

**Step 1: Create header component**

`src/components/layout/header.tsx`: App header with logo text "DataChat", navigation links (首页, 关于).

**Step 2: Create dataset card component**

`src/components/home/dataset-card.tsx`: A card showing dataset name, description, icon, table count, row count. Clickable, navigates to `/analyze/[datasetId]`.

**Step 3: Create upload card component**

`src/components/home/upload-card.tsx`: A card with upload icon, "上传你的数据" text, accepts CSV/Excel. On upload, navigates to `/analyze/custom`.

**Step 4: Build homepage**

`src/app/page.tsx`:
- Hero section: "DataChat" title + "用自然语言和数据对话" subtitle
- 3 dataset cards in a grid
- Upload card as the 4th card
- Clean, minimal design

**Step 5: Verify in browser**

```bash
npm run dev
```

Visit http://localhost:3000, verify all cards render, clicking navigates correctly.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: build homepage with dataset selection cards and upload entry"
```

---

## Task 6: Analysis Workspace — Layout & Data Preview

**Files:**
- Create: `src/app/analyze/[datasetId]/page.tsx` — analysis workspace page
- Create: `src/components/analyze/data-sidebar.tsx` — left sidebar with schema + data preview
- Create: `src/components/analyze/query-input.tsx` — bottom input bar + preset questions
- Create: `src/hooks/use-duckdb.ts` — React hook for DuckDB operations

**Step 1: Create DuckDB React hook**

`src/hooks/use-duckdb.ts`:

```typescript
// Hook that manages DuckDB lifecycle:
// - initDb(): loads DuckDB WASM
// - loadDataset(datasetId): fetches and registers all parquet files for a dataset
// - executeQuery(sql): runs SQL and returns { columns, rows }
// - isLoading: boolean
// - error: string | null
```

**Step 2: Create data sidebar**

`src/components/analyze/data-sidebar.tsx`:
- Shows dataset name and description
- Accordion/tabs for each table in the dataset
- Each table shows column name, type, description
- "数据预览" tab: runs `SELECT * FROM table LIMIT 5` and shows as mini table

**Step 3: Create query input bar**

`src/components/analyze/query-input.tsx`:
- Text input with send button at bottom of page
- Above input: preset question chips (from dataset.presetQuestions)
- Clicking a chip fills the input and submits

**Step 4: Create workspace page layout**

`src/app/analyze/[datasetId]/page.tsx`:
- On mount: load DuckDB, load dataset parquet files
- Layout: header | sidebar (left, collapsible) | main area | input bar (bottom)
- Main area: empty state with "选择一个问题开始分析" + preset questions

**Step 5: Verify data loading**

Visit http://localhost:3000/analyze/ecommerce, verify:
- DuckDB loads successfully
- Parquet files load
- Sidebar shows table schemas
- Data preview shows sample rows

**Step 6: Commit**

```bash
git add .
git commit -m "feat: build analysis workspace layout with data sidebar and query input"
```

---

## Task 7: Analysis Flow — Query → LLM → SQL → Chart

**Files:**
- Create: `src/components/analyze/analysis-card.tsx` — single analysis result card
- Create: `src/components/analyze/analysis-list.tsx` — scrollable list of analysis cards
- Modify: `src/app/analyze/[datasetId]/page.tsx` — wire up full query flow

**Step 1: Create analysis card component**

`src/components/analyze/analysis-card.tsx`:
- Card layout with 3 sections:
  1. **Chart area**: ECharts chart (rendered in next task, placeholder for now)
  2. **Insight text**: the `insight` string from LLM, styled as a callout
  3. **SQL collapsible**: expandable section showing the SQL query, with copy button
- User's question shown as card header

**Step 2: Create analysis list**

`src/components/analyze/analysis-list.tsx`:
- Scrollable container of analysis cards
- Auto-scrolls to latest card on new result
- Loading skeleton while waiting for response

**Step 3: Wire up the full flow in workspace page**

In `src/app/analyze/[datasetId]/page.tsx`:

```
User submits question
  → Set loading state, add user message to conversation
  → POST /api/analyze { question, datasetId, conversationHistory }
  → Receive { sql, chart, insight }
  → Execute sql via DuckDB WASM → get { columns, rows }
  → If SQL fails: retry once with error message sent back to LLM
  → Add analysis card to the list with chart config + query result + insight
  → Clear loading state
```

**Step 4: Test full flow**

- Click preset question "各月销售额趋势是怎样的？"
- Verify: API call succeeds, SQL executes in DuckDB, card appears with insight text
- (Chart rendering will be a placeholder until Task 8)

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement full analysis flow - question → LLM → SQL → result cards"
```

---

## Task 8: ECharts Chart Rendering

**Files:**
- Create: `src/components/analyze/chart-renderer.tsx` — maps ChartConfig + QueryResult to ECharts options
- Create: `src/lib/chart-theme.ts` — custom ECharts theme (去 AI 味, professional)

**Step 1: Create custom ECharts theme**

`src/lib/chart-theme.ts`:
- Define a professional color palette (not the default ECharts blue)
- Consistent font styling
- Clean grid, subtle axis lines
- Colors that work for all chart types

**Step 2: Create chart renderer component**

`src/components/analyze/chart-renderer.tsx`:

Maps `ChartConfig` + `QueryResult` → ECharts `option` object:

- **line**: xAxis from xField, series data from yField, smooth curves
- **bar**: similar to line but bar series
- **pie**: data array from xField (name) + yField (value)
- **scatter**: xAxis + yAxis from respective fields
- **funnel**: data array from xField (name) + yField (value)
- **heatmap**: x, y from respective fields, value from yField

Handle edge cases:
- Multiple series (when seriesField is present): group data by seriesField
- Empty data: show "暂无数据" placeholder
- Large datasets: auto-enable dataZoom for line/bar charts

**Step 3: Integrate into analysis card**

Update `src/components/analyze/analysis-card.tsx` to render `<ChartRenderer>` instead of placeholder.

**Step 4: Test all chart types**

Use preset questions to trigger different chart types:
- "各月销售额趋势" → line chart
- "哪个类目销售额最高" → bar chart
- "支付方式占比" → pie chart

Verify charts render correctly with custom theme.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add ECharts chart rendering with custom theme for all chart types"
```

---

## Task 9: File Upload (CSV/Excel)

**Files:**
- Create: `src/app/analyze/custom/page.tsx` — custom data analysis page
- Create: `src/lib/file-parser.ts` — CSV/Excel file parsing utility
- Create: `src/components/home/upload-dialog.tsx` — upload dialog with preview

**Step 1: Create file parser**

`src/lib/file-parser.ts`:
- Parse CSV using built-in FileReader + simple CSV parser
- Parse Excel (.xlsx) using `xlsx` library
- Return: `{ columns: ColumnInfo[], sampleRows: Record<string, unknown>[], allRows: Record<string, unknown>[] }`
- Auto-detect column types (VARCHAR, INTEGER, DOUBLE, DATE)

**Step 2: Create upload flow**

When user uploads a file:
1. Parse file → get columns and rows
2. Create a temporary DuckDB table from the parsed data
3. Auto-generate schema info for the LLM
4. Navigate to analysis workspace with custom dataset
5. LLM can now query this table

**Step 3: Create custom analysis page**

`src/app/analyze/custom/page.tsx`:
- Reuses the same workspace layout as built-in datasets
- Shows upload area if no data loaded
- After upload: shows same sidebar + query input + analysis cards
- Auto-generate 3-4 preset questions based on detected column types

**Step 4: Test upload flow**

Create a test CSV file, upload it, verify:
- File parses correctly
- Table created in DuckDB
- Can query with natural language

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add CSV/Excel file upload with auto schema detection"
```

---

## Task 10: Multi-turn Conversation Context

**Files:**
- Modify: `src/app/analyze/[datasetId]/page.tsx` — pass conversation history to API
- Modify: `src/lib/llm-prompt.ts` — already handles history (built in Task 4)

**Step 1: Implement conversation state**

In the workspace page, maintain a `messages: Message[]` array:
- Each user question → add user message
- Each analysis result → add assistant message with analysis data
- Pass last 6 messages as `conversationHistory` to API

**Step 2: Add conversation indicators**

- Show user questions inline between analysis cards (small text, not bubble)
- "追问" label on follow-up questions after the first

**Step 3: Add "清空对话" button**

Button in the header area to reset conversation history and clear all cards.

**Step 4: Test multi-turn**

1. Ask "各月销售额趋势"
2. Follow up "哪个月下降最多？为什么？"
3. Verify the follow-up answer references the previous context

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add multi-turn conversation context for follow-up questions"
```

---

## Task 11: Error Handling & Loading States

**Files:**
- Modify: `src/app/analyze/[datasetId]/page.tsx` — error handling
- Create: `src/components/analyze/error-card.tsx` — error display
- Create: `src/components/analyze/loading-skeleton.tsx` — loading states

**Step 1: Create error card**

`src/components/analyze/error-card.tsx`:
- Displays error message in a styled card
- "重试" button to re-send the question
- Friendly messages:
  - SQL error → "分析遇到问题，正在重新尝试..."（auto-retry once）
  - LLM error → "AI 服务暂时不可用，请稍后重试"
  - Network error → "网络连接失败，请检查网络后重试"

**Step 2: Create loading skeleton**

`src/components/analyze/loading-skeleton.tsx`:
- Skeleton card matching analysis card layout
- "分析中..." text with subtle animation (not "AI thinking")
- Progress indicator (optional pulse animation)

**Step 3: Implement auto-retry for SQL failures**

In the query flow:
1. If DuckDB SQL execution fails
2. Send error message back to LLM API with the failed SQL and error
3. LLM regenerates SQL
4. Try executing again
5. If second attempt also fails → show error card

**Step 4: Handle empty results**

If SQL returns 0 rows → show friendly message "未找到匹配数据，试试换个问法" with suggested alternative questions.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add error handling, loading states, and auto-retry for SQL failures"
```

---

## Task 12: About Page

**Files:**
- Create: `src/app/about/page.tsx` — about page

**Step 1: Build about page**

`src/app/about/page.tsx`:
- Project introduction section: what DataChat does, why it was built
- Tech stack section: visual display of technologies used (Next.js, DuckDB WASM, ECharts, etc.)
- Architecture diagram (simplified version of the design doc diagram)
- Personal intro placeholder (user fills in their own info)
- Contact links placeholder

**Step 2: Add to navigation**

Ensure header nav links to /about.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add about page with project and tech stack introduction"
```

---

## Task 13: UI Polish with frontend-design Skill

**Files:**
- Modify: all page and component files for visual polish

**Step 1: Invoke frontend-design skill**

Use `@superpowers:frontend-design` skill to polish the UI. Focus areas:
- Custom color palette (professional, not default shadcn)
- Typography hierarchy
- Smooth transitions and micro-interactions
- Responsive layout adjustments
- Dark mode support (optional but impressive for interview)
- Consistent spacing and alignment

**Step 2: Polish homepage**

- Hero section with subtle gradient or pattern background
- Dataset cards with hover effects
- Smooth page transitions

**Step 3: Polish analysis workspace**

- Sidebar collapse animation
- Analysis card entrance animation
- Chart container styling
- Input bar design (floating, modern)
- Preset question chip styling

**Step 4: Verify across screen sizes**

Test at 1440px, 1024px, 768px, 375px widths.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: polish UI with custom design system and animations"
```

---

## Task 14: Vercel Deployment

**Files:**
- Modify: `next.config.ts` — production config
- Create: `vercel.json` (if needed)

**Step 1: Verify production build**

```bash
npm run build
```

Fix any build errors (type errors, missing imports, etc.)

**Step 2: Deploy to Vercel**

```bash
npx vercel
```

Or connect GitHub repo to Vercel dashboard.

**Step 3: Configure environment variables**

In Vercel dashboard → Settings → Environment Variables:
- `LLM_API_KEY`: your DeepSeek/OpenAI API key
- `LLM_BASE_URL`: API base URL
- `LLM_MODEL`: model name

**Step 4: Test production deployment**

Visit the deployed URL, verify:
- Homepage loads
- Dataset selection works
- Full analysis flow works (question → chart → insight)
- File upload works
- About page loads

**Step 5: Commit any deployment fixes**

```bash
git add .
git commit -m "chore: configure production build and Vercel deployment"
```

---

## Summary

| Task | Description | Key Deliverable |
|------|-------------|-----------------|
| 1 | Project Scaffolding | Next.js + Tailwind + shadcn/ui project |
| 2 | DuckDB WASM Integration | Browser-side SQL query engine |
| 3 | Generate Demo Datasets | 3 Parquet datasets with realistic Chinese business data |
| 4 | LLM API Route | Natural language → SQL + chart + insight |
| 5 | Homepage | Dataset selection + upload entry |
| 6 | Analysis Workspace Layout | Sidebar + input bar + data preview |
| 7 | Analysis Flow | Full query → result pipeline |
| 8 | ECharts Rendering | Chart rendering with custom theme |
| 9 | File Upload | CSV/Excel parsing and analysis |
| 10 | Multi-turn Conversation | Context-aware follow-up questions |
| 11 | Error Handling | Retry logic, loading states, friendly errors |
| 12 | About Page | Project + personal introduction |
| 13 | UI Polish | Professional design with frontend-design skill |
| 14 | Vercel Deployment | Production deployment |

**Recommended execution order:** Tasks 1-8 are the critical path for a working MVP. Tasks 9-14 add polish and completeness. If time is tight, ship after Task 8 and iterate.
