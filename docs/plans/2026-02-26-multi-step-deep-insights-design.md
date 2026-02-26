# Batch 2: Multi-step Analysis + Deep Insights

**Date:** 2026-02-26
**Status:** Approved

## Background

DataChat currently operates in a "one question, one answer" mode. Each analysis is independent — no follow-up suggestions, no structured insights, no anomaly detection. Users must manually think of the next question.

## Goals

1. **Smart follow-up suggestions** — after each analysis, recommend 2-3 next questions as clickable buttons
2. **Implicit analysis flow** — LLM judges the current analysis stage and guides users through overview → breakdown → drill → action
3. **Deep insights** — structured insight output with statistical indicators, anomaly detection, and action recommendations
4. **Pure prompt approach** — no additional LLM calls, no frontend computation; everything via prompt engineering

## Data Structure Changes

### New Types (`src/types/index.ts`)

```typescript
type AnalysisStage = "overview" | "breakdown" | "drill" | "anomaly" | "action";

interface InsightHighlight {
  type: "stat" | "anomaly" | "action";
  text: string;
}

interface InsightResult {
  summary: string;
  highlights: InsightHighlight[];
}

interface FollowUpQuestion {
  text: string;
  stage: AnalysisStage;
}
```

### Modified Types

```typescript
interface AnalysisResult {
  sql: string;
  chart: ChartConfig;
  insight: InsightResult;           // was: string
  followUpQuestions: FollowUpQuestion[];  // new
  analysisStage: AnalysisStage;          // new
}
```

### Backward Compatibility

If `insight` is a plain string (LLM fallback), auto-wrap as `{ summary: insight, highlights: [] }`.

## LLM Output Format

```json
{
  "sql": "SELECT ...",
  "chart": { "type": "line", "xField": "month", "yField": "total_sales", "title": "..." },
  "insight": {
    "summary": "12月销售额达到峰值 85.2 万元，环比增长 23%",
    "highlights": [
      { "type": "stat", "text": "平均月销售额 62.5 万元，标准差 15.3 万" },
      { "type": "anomaly", "text": "8月销售额骤降 35%，疑似季节性因素" },
      { "type": "action", "text": "建议提前制定 Q4 促销策略，重点备货数码配件" }
    ]
  },
  "followUpQuestions": [
    { "text": "8月销售额下降的具体原因是什么？", "stage": "drill" },
    { "text": "各地区在Q4的表现如何？", "stage": "breakdown" }
  ],
  "analysisStage": "overview"
}
```

## Prompt Changes (`src/lib/llm-prompt.ts`)

### New: Analysis Stage Rules

After chart selection rules, add:

```
## 分析阶段
根据对话上下文判断当前分析阶段，并据此生成追问建议：
- overview：总览全局数据（首次提问通常是这个阶段）
- breakdown：按维度拆解（如按地区、按类目细分）
- drill：深入某个具体发现（如某个月份、某个异常点）
- anomaly：排查异常原因
- action：给出行动建议

追问建议应引导用户从 overview → breakdown → drill → action 逐步深入，
但不要强制，用户可以跳到任何阶段。
```

### Updated: Output JSON Structure

Update the output template to match the new structured format.

### Updated: Insight Rules

```
insight 要求：
- summary：核心发现 + 关键数字（1句话）
- highlights 包含 2-4 条，每条标记 type：
  - stat：统计指标（均值、中位数、标准差、峰值、增长率、占比等）
  - anomaly：异常发现（突增/骤降/偏离均值等，没有则不写）
  - action：业务建议（基于数据的可执行建议）
- 禁止空洞描述如"数据呈现一定趋势"

followUpQuestions 要求：
- 生成 2-3 个追问建议，引导用户深入分析
- 每个问题带 stage 标签
- 问题要具体，与当前数据结果相关
```

### Updated: Few-shot Examples

Both examples updated to use the new JSON structure.

## API Changes (`src/app/api/analyze/route.ts`)

### Normalize Insight Format

```typescript
const normalizedInsight = typeof insight === "string"
  ? { summary: insight, highlights: [] }
  : insight;
```

### Return New Fields

```typescript
return NextResponse.json({
  sql,
  chart,
  insight: normalizedInsight,
  followUpQuestions: followUpQuestions || [],
  analysisStage: analysisStage || "overview",
  queryResult,
});
```

### Validation

Check `normalizedInsight.summary` instead of `!insight`.

Retry logic returns the same new fields.

## Frontend Changes

### AnalysisCard (`src/components/analyze/analysis-card.tsx`)

Replace plain text insight with structured display:

- **summary**: Bold text, insight title
- **highlights**: Each item with icon + color by type:
  - `stat` → blue, `BarChart3` icon
  - `anomaly` → amber/orange, `AlertTriangle` icon
  - `action` → green, `Lightbulb` icon
- **followUpQuestions**: Horizontal row of small buttons at the bottom of the card, clicking triggers `onFollowUp(text)`

### Props Chain

- `AnalysisCard` gets new `onFollowUp: (text: string) => void` prop
- `AnalysisList` passes it through
- Parent pages (`[datasetId]/page.tsx`, `custom/page.tsx`) connect it to `handleSubmit`

### Compatibility

- String insight → render as plain text
- Empty `followUpQuestions` → hide follow-up section
- Empty `highlights` → show only summary

## Files to Change

| File | Change |
|------|--------|
| `src/types/index.ts` | Add new types, modify `AnalysisResult` |
| `src/lib/llm-prompt.ts` | Rewrite prompt: stage rules, structured output, new examples |
| `src/app/api/analyze/route.ts` | Normalize insight, return new fields |
| `src/components/analyze/analysis-card.tsx` | Structured insight display + follow-up buttons |
| `src/components/analyze/analysis-list.tsx` | Pass through `onFollowUp` prop |
| `src/app/analyze/[datasetId]/page.tsx` | Connect `onFollowUp` to `handleSubmit` |
| `src/app/analyze/custom/page.tsx` | Same as above |

## Out of Scope

- Export reports (PDF/PNG/CSV)
- Analysis history persistence
- Chart drill-down (click chart element to drill)
- Multiple LLM calls for deeper analysis
