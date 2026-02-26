# Multi-step Analysis + Deep Insights — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured deep insights (stats/anomaly/action highlights), smart follow-up question suggestions, and implicit analysis stage guidance — all via pure prompt engineering.

**Architecture:** Extend the existing single-LLM-call flow. The prompt is enhanced to return a richer JSON structure with structured insights, follow-up questions, and analysis stage metadata. The API normalizes the output for backward compatibility. The frontend renders highlights with type-specific icons/colors and follow-up buttons.

**Tech Stack:** Same as existing — Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, ECharts, DeepSeek API, Turso.

---

## Task 1: Update type definitions

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types and update AnalysisResult**

Replace lines 25-30 with:

```typescript
// Analysis stages
export type AnalysisStage = "overview" | "breakdown" | "drill" | "anomaly" | "action";

// Structured insight
export interface InsightHighlight {
  type: "stat" | "anomaly" | "action";
  text: string;
}

export interface InsightResult {
  summary: string;
  highlights: InsightHighlight[];
}

// Follow-up questions
export interface FollowUpQuestion {
  text: string;
  stage: AnalysisStage;
}

// LLM response
export interface AnalysisResult {
  sql: string;
  chart: ChartConfig;
  insight: InsightResult;
  followUpQuestions: FollowUpQuestion[];
  analysisStage: AnalysisStage;
}
```

**Step 2: Verify build**

Run: `npx next build`
Expected: Build will fail because `analysis.insight` is now an object but used as string in multiple places. This is expected — we fix it in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add structured insight, follow-up question, and analysis stage types"
```

---

## Task 2: Rewrite prompt for structured output

**Files:**
- Modify: `src/lib/llm-prompt.ts`

**Step 1: Rewrite the full prompt template**

Replace the entire return string (lines 19-96) with:

```typescript
  return `根据用户的问题，生成 SQL 查询语句、图表配置和结构化数据洞察。

## 数据库信息
${schemaInfo}

## SQL 方言
使用 SQLite SQL 语法。注意：
- 日期函数使用 SQLite 语法 (如 strftime('%Y-%m', date_col), date(), julianday())
- 字符串使用单引号
- 支持 CTE (WITH 子句)
- 支持窗口函数 (ROW_NUMBER, RANK, LAG, LEAD 等)
- 布尔值存储为 INTEGER (0/1)，使用 WHERE col = 1 而非 WHERE col = true
- 不支持 DATE_TRUNC，使用 strftime 替代
- 不支持 EXTRACT，使用 strftime 替代，例如 strftime('%Y', date_col) 取年份

## 图表选择规则
根据问题意图选择图表类型：
- 时间趋势（按月/按日变化）→ line
- 分类对比（各类目/各地区对比）→ bar
- 占比分布（各部分占总体比例）→ pie
- 相关性分析（两个数值变量关系）→ scatter
- 转化漏斗（多步骤递减）→ funnel
- 明细列表（查看原始记录、TOP N 明细）→ table

## 分析阶段
根据对话上下文判断当前分析阶段，并据此生成追问建议：
- overview：总览全局数据（首次提问通常是这个阶段）
- breakdown：按维度拆解（如按地区、按类目细分）
- drill：深入某个具体发现（如某个月份、某个异常点）
- anomaly：排查异常原因
- action：给出行动建议

追问建议应引导用户从 overview → breakdown → drill → action 逐步深入，但不要强制，用户可以跳到任何阶段。

## 示例

问题: "各月销售额趋势"
\`\`\`json
{
  "sql": "SELECT strftime('%Y-%m', order_date) AS month, SUM(total_amount) AS total_sales FROM orders GROUP BY month ORDER BY month",
  "chart": { "type": "line", "xField": "month", "yField": "total_sales", "title": "各月销售额趋势" },
  "insight": {
    "summary": "2024年销售额整体呈上升趋势，12月达到峰值 85.2 万元。",
    "highlights": [
      { "type": "stat", "text": "月均销售额 62.5 万元，环比平均增长 8.3%" },
      { "type": "anomaly", "text": "8月销售额骤降 35%，偏离均值超过2个标准差" },
      { "type": "action", "text": "建议关注 Q4 旺季备货策略，提前布局促销活动" }
    ]
  },
  "followUpQuestions": [
    { "text": "8月销售额下降的原因是什么？", "stage": "drill" },
    { "text": "各地区的月度销售趋势如何？", "stage": "breakdown" }
  ],
  "analysisStage": "overview"
}
\`\`\`

问题: "各商品类目的销售占比"
\`\`\`json
{
  "sql": "SELECT category, SUM(total_amount) AS total_sales FROM orders GROUP BY category ORDER BY total_sales DESC",
  "chart": { "type": "pie", "xField": "category", "yField": "total_sales", "title": "各商品类目销售占比" },
  "insight": {
    "summary": "数码配件以 35.2% 的占比位居第一，贡献销售额 210 万元。",
    "highlights": [
      { "type": "stat", "text": "前三大类目合计占总销售额的 72%，HHI 集中度指数 0.21" },
      { "type": "anomaly", "text": "家居日用类目占比仅 3.1%，远低于行业平均水平" },
      { "type": "action", "text": "长尾类目可考虑精简，集中资源在头部类目" }
    ]
  },
  "followUpQuestions": [
    { "text": "数码配件的月度销售趋势如何？", "stage": "drill" },
    { "text": "各类目的利润率对比如何？", "stage": "breakdown" }
  ],
  "analysisStage": "overview"
}
\`\`\`

${historyContext ? \`## 对话上下文\\n\${historyContext}\\n\` : ""}
${customInstructions ? \`## 用户自定义指令\\n\${customInstructions}\\n\` : ""}
## 用户问题
${question}

## 输出要求
返回严格的 JSON 格式，不要包含任何其他文本或 markdown 标记：
{
  "sql": "完整的 SQL 查询语句",
  "chart": {
    "type": "line | bar | pie | scatter | heatmap | funnel | table",
    "xField": "X轴字段名（必须与 SQL SELECT 中的列名或 AS 别名完全一致）",
    "yField": "Y轴字段名（必须与 SQL SELECT 中的列名或 AS 别名完全一致）",
    "seriesField": "系列字段名（可选，必须是 SELECT 中存在的列名）",
    "title": "图表标题"
  },
  "insight": {
    "summary": "核心发现 + 关键数字（1句话）",
    "highlights": [
      { "type": "stat", "text": "统计指标" },
      { "type": "anomaly", "text": "异常发现" },
      { "type": "action", "text": "业务建议" }
    ]
  },
  "followUpQuestions": [
    { "text": "推荐的下一个分析问题", "stage": "breakdown | drill | anomaly | action" }
  ],
  "analysisStage": "当前分析阶段"
}

关键规则：
- SQL 必须只使用上面列出的表和字段
- xField 和 yField 的值必须与 SQL SELECT 中的列名或 AS 别名完全一致
- 如果 SQL 写了 SELECT strftime('%Y-%m', order_date) AS month，那 xField 必须是 "month"
- seriesField 同理，必须是 SELECT 中存在的列名
- 饼图的 type 使用 "pie"，xField 是分类字段，yField 是数值字段
- 当用户想查看明细数据、原始记录、列表详情时，type 使用 "table"

insight 要求：
- summary：核心发现 + 关键数字（1句话）
- highlights 包含 2-4 条，每条标记 type：
  - stat：统计指标（均值、中位数、标准差、峰值、增长率、占比等）
  - anomaly：异常发现（突增/骤降/偏离均值等，没有明显异常则省略此条）
  - action：业务建议（基于数据的可执行建议）
- 禁止空洞描述如"数据呈现一定趋势"

followUpQuestions 要求：
- 生成 2-3 个追问建议，引导用户深入分析
- 每个问题带 stage 标签，表示该问题属于哪个分析阶段
- 问题要具体，与当前数据结果相关，不要泛泛而谈

只返回 JSON，不要返回其他任何内容`;
```

**Step 2: Update conversation history serialization**

The `historyContext` builder (lines 9-17) references `m.analysis.insight` which is now an object. Update line 13:

```typescript
      if (m.analysis) {
        const insightText = typeof m.analysis.insight === "string"
          ? m.analysis.insight
          : m.analysis.insight.summary;
        return `分析结果: SQL=${m.analysis.sql}, 洞察=${insightText}`;
      }
```

**Step 3: Commit**

```bash
git add src/lib/llm-prompt.ts
git commit -m "feat: rewrite prompt for structured insights, follow-ups, and analysis stages"
```

---

## Task 3: Update API to normalize and return new fields

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Step 1: Add normalizeInsight helper**

After the `extractJSON` function (after line 50), add:

```typescript
function normalizeInsight(insight: unknown): { summary: string; highlights: { type: string; text: string }[] } {
  if (typeof insight === "string") {
    return { summary: insight, highlights: [] };
  }
  if (insight && typeof insight === "object" && "summary" in insight) {
    return insight as { summary: string; highlights: { type: string; text: string }[] };
  }
  return { summary: String(insight || ""), highlights: [] };
}
```

**Step 2: Update parsed result handling**

Replace line 147:
```typescript
    const { sql, chart, insight } = parsed;
```
with:
```typescript
    const { sql, chart, insight, followUpQuestions, analysisStage } = parsed;
    const normalizedInsight = normalizeInsight(insight);
```

**Step 3: Update validation**

Replace line 149:
```typescript
    if (!sql || !chart || !insight) {
```
with:
```typescript
    if (!sql || !chart || !normalizedInsight.summary) {
```

**Step 4: Update success response**

Replace line 207:
```typescript
    return NextResponse.json({ sql, chart, insight, queryResult }, {
```
with:
```typescript
    return NextResponse.json({
      sql,
      chart,
      insight: normalizedInsight,
      followUpQuestions: followUpQuestions || [],
      analysisStage: analysisStage || "overview",
      queryResult,
    }, {
```

**Step 5: Update retry response**

Replace lines 190-198 (the retry success response):
```typescript
          queryResult = await executeQuery(retryParsed.sql);
          return NextResponse.json({
            sql: retryParsed.sql,
            chart: retryParsed.chart || chart,
            insight: retryParsed.insight || insight,
            queryResult,
          }, {
            headers: { "X-RateLimit-Remaining": String(remaining) },
          });
```
with:
```typescript
          queryResult = await executeQuery(retryParsed.sql);
          return NextResponse.json({
            sql: retryParsed.sql,
            chart: retryParsed.chart || chart,
            insight: normalizeInsight(retryParsed.insight || insight),
            followUpQuestions: retryParsed.followUpQuestions || followUpQuestions || [],
            analysisStage: retryParsed.analysisStage || analysisStage || "overview",
            queryResult,
          }, {
            headers: { "X-RateLimit-Remaining": String(remaining) },
          });
```

**Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: normalize structured insight and return follow-up questions from API"
```

---

## Task 4: Update AnalysisCard for structured insights and follow-up buttons

**Files:**
- Modify: `src/components/analyze/analysis-card.tsx`

**Step 1: Update imports**

Replace the lucide imports (lines 4-14) with:

```typescript
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  MessageSquare,
  WifiOff,
  Play,
  Loader2,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
```

Update the types import (line 18):

```typescript
import { ChartConfig, InsightResult, Message, QueryResult } from "@/types";
```

**Step 2: Add onFollowUp prop**

Update AnalysisCardProps (lines 22-30):

```typescript
interface AnalysisCardProps {
  userMessage: Message;
  assistantMessage: Message;
  isFollowUp?: boolean;
  onRetry?: (question: string) => void;
  onFollowUp?: (question: string) => void;
  onUpdateResult?: (messageId: string, queryResult: QueryResult, sql: string) => void;
  analyzeStage?: string;
  accessCode?: string;
}
```

Add `onFollowUp` to the destructured props (line 76-84):

```typescript
export function AnalysisCard({
  userMessage,
  assistantMessage,
  isFollowUp = false,
  onRetry,
  onFollowUp,
  onUpdateResult,
  analyzeStage,
  accessCode,
}: AnalysisCardProps) {
```

**Step 3: Add insight helper**

After the `getFriendlyError` function (after line 74), add:

```typescript
const highlightConfig = {
  stat: { icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  anomaly: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  action: { icon: Lightbulb, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
} as const;
```

**Step 4: Replace the Insight section**

Replace lines 261-266 (the `{/* Insight */}` section):

```tsx
          {/* Insight */}
          <div className="mx-5 rounded-lg border border-indigo-100/60 bg-indigo-50/30 px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {analysis.insight}
            </p>
          </div>
```

with:

```tsx
          {/* Insight */}
          <div className="mx-5 space-y-2">
            {/* Summary */}
            <div className="rounded-lg border border-indigo-100/60 bg-indigo-50/30 px-4 py-3">
              <p className="text-sm font-medium leading-relaxed text-foreground/90">
                {typeof analysis.insight === "string" ? analysis.insight : analysis.insight.summary}
              </p>
            </div>

            {/* Highlights */}
            {typeof analysis.insight === "object" && analysis.insight.highlights?.length > 0 && (
              <div className="space-y-1.5">
                {analysis.insight.highlights.map((h, i) => {
                  const config = highlightConfig[h.type] || highlightConfig.stat;
                  const Icon = config.icon;
                  return (
                    <div key={i} className={`flex items-start gap-2 rounded-md border ${config.border} ${config.bg} px-3 py-2`}>
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${config.color}`} />
                      <p className="text-xs leading-relaxed text-foreground/80">{h.text}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Follow-up questions */}
            {analysis.followUpQuestions?.length > 0 && onFollowUp && (
              <div className="flex flex-wrap gap-2 pt-1">
                {analysis.followUpQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onFollowUp(q.text)}
                    className="rounded-full border border-indigo-200/60 bg-white px-3 py-1.5 text-xs text-indigo-600 transition-colors hover:bg-indigo-50 hover:border-indigo-300"
                  >
                    {q.text}
                  </button>
                ))}
              </div>
            )}
          </div>
```

**Step 5: Commit**

```bash
git add src/components/analyze/analysis-card.tsx
git commit -m "feat: render structured insights with highlights and follow-up buttons"
```

---

## Task 5: Wire up follow-up through AnalysisList and pages

**Files:**
- Modify: `src/components/analyze/analysis-list.tsx`
- Modify: `src/app/analyze/[datasetId]/page.tsx`
- Modify: `src/app/analyze/custom/page.tsx`

**Step 1: Add onFollowUp to AnalysisList**

In `src/components/analyze/analysis-list.tsx`, update the interface (line 8-15):

```typescript
interface AnalysisListProps {
  messages: Message[];
  isAnalyzing: boolean;
  analyzeStage?: string;
  onRetry?: (question: string) => void;
  onFollowUp?: (question: string) => void;
  onUpdateResult?: (messageId: string, queryResult: QueryResult, sql: string) => void;
  accessCode?: string;
}
```

Add `onFollowUp` to the destructured props (line 17-24):

```typescript
export function AnalysisList({
  messages,
  isAnalyzing,
  analyzeStage,
  onRetry,
  onFollowUp,
  onUpdateResult,
  accessCode,
}: AnalysisListProps) {
```

Pass it to AnalysisCard (add after the `onRetry={onRetry}` line, around line 50):

```tsx
            onFollowUp={onFollowUp}
```

**Step 2: Update [datasetId]/page.tsx**

In `src/app/analyze/[datasetId]/page.tsx`, add `onFollowUp={handleSubmit}` to the `<AnalysisList>` component (around line 216-224).

Find:
```tsx
                <AnalysisList
                  messages={messages}
                  isAnalyzing={isAnalyzing}
                  analyzeStage={analyzeStage}
                  onRetry={handleRetry}
                  onUpdateResult={handleUpdateResult}
                  accessCode={accessCode}
                />
```

Add `onFollowUp={handleSubmit}`:
```tsx
                <AnalysisList
                  messages={messages}
                  isAnalyzing={isAnalyzing}
                  analyzeStage={analyzeStage}
                  onRetry={handleRetry}
                  onFollowUp={handleSubmit}
                  onUpdateResult={handleUpdateResult}
                  accessCode={accessCode}
                />
```

**Step 3: Update custom/page.tsx**

Same change in `src/app/analyze/custom/page.tsx` — add `onFollowUp={handleSubmit}` to the `<AnalysisList>` component (around line 401-407).

**Step 4: Update handleSubmit in both pages to store new fields**

In both page files, the `handleSubmit` function builds an `AnalysisResult` from the API response. Update it to include the new fields.

Find (in both files):
```typescript
        const analysis: AnalysisResult = {
          sql: data.sql,
          chart: data.chart,
          insight: data.insight,
        };
```

Replace with:
```typescript
        const analysis: AnalysisResult = {
          sql: data.sql,
          chart: data.chart,
          insight: typeof data.insight === "string"
            ? { summary: data.insight, highlights: [] }
            : data.insight,
          followUpQuestions: data.followUpQuestions || [],
          analysisStage: data.analysisStage || "overview",
        };
```

**Step 5: Verify build**

Run: `npx next build`
Expected: Build passes.

**Step 6: Commit**

```bash
git add src/components/analyze/analysis-list.tsx src/app/analyze/[datasetId]/page.tsx src/app/analyze/custom/page.tsx
git commit -m "feat: wire up follow-up questions through AnalysisList to pages"
```

---

## Task 6: Build verification and push

**Step 1: Full build**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Push to GitHub**

```bash
git push origin main
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `InsightResult`, `InsightHighlight`, `FollowUpQuestion`, `AnalysisStage` types; update `AnalysisResult` |
| `src/lib/llm-prompt.ts` | Rewrite prompt: analysis stage rules, structured JSON output, updated few-shot examples, updated insight rules |
| `src/app/api/analyze/route.ts` | Add `normalizeInsight` helper, return structured insight + followUpQuestions + analysisStage |
| `src/components/analyze/analysis-card.tsx` | Render highlights with type-specific icons/colors, render follow-up buttons |
| `src/components/analyze/analysis-list.tsx` | Pass through `onFollowUp` prop |
| `src/app/analyze/[datasetId]/page.tsx` | Wire `onFollowUp` to `handleSubmit`, store new analysis fields |
| `src/app/analyze/custom/page.tsx` | Same as above |
