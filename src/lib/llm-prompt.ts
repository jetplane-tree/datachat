import { Message } from "@/types";

function buildHistoryContext(conversationHistory: Message[]): string {
  return conversationHistory
    .slice(-6)
    .map((m) => {
      if (m.role === "user") return `用户: ${m.content}`;
      if (m.analysis) {
        const insightText = typeof m.analysis.insight === "string"
          ? m.analysis.insight
          : m.analysis.insight.summary;
        return `分析结果: SQL=${m.analysis.sql}, 洞察=${insightText}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Step 1: Generate SQL + chart config (no insight — data not yet available)
 */
export function buildSqlPrompt(
  schemaInfo: string,
  question: string,
  conversationHistory: Message[],
  customInstructions?: string
): string {
  const historyContext = buildHistoryContext(conversationHistory);

  return `根据用户的问题，生成 SQL 查询语句和图表配置。

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

## 示例

问题: "各月销售额趋势"
\`\`\`json
{
  "sql": "SELECT strftime('%Y-%m', order_date) AS month, SUM(total_amount) AS total_sales FROM orders GROUP BY month ORDER BY month",
  "chart": { "type": "line", "xField": "month", "yField": "total_sales", "title": "各月销售额趋势" }
}
\`\`\`

问题: "各商品类目的销售占比"
\`\`\`json
{
  "sql": "SELECT category, SUM(total_amount) AS total_sales FROM orders GROUP BY category ORDER BY total_sales DESC",
  "chart": { "type": "pie", "xField": "category", "yField": "total_sales", "title": "各商品类目销售占比" }
}
\`\`\`

${historyContext ? `## 对话上下文\n${historyContext}\n` : ""}
${customInstructions ? `## 用户自定义指令\n${customInstructions}\n` : ""}
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
  }
}

关键规则：
- SQL 必须只使用上面列出的表和字段
- xField 和 yField 的值必须与 SQL SELECT 中的列名或 AS 别名完全一致
- 如果 SQL 写了 SELECT strftime('%Y-%m', order_date) AS month，那 xField 必须是 "month"
- seriesField 同理，必须是 SELECT 中存在的列名
- 饼图的 type 使用 "pie"，xField 是分类字段，yField 是数值字段
- 当用户想查看明细数据、原始记录、列表详情时，type 使用 "table"

只返回 JSON，不要返回其他任何内容`;
}

/**
 * Step 2: Generate insight + follow-up questions based on ACTUAL query results
 */
export function buildInsightPrompt(
  question: string,
  sql: string,
  queryData: Record<string, unknown>[],
  conversationHistory: Message[],
  customInstructions?: string
): string {
  const historyContext = buildHistoryContext(conversationHistory);

  // Limit data to first 50 rows to keep prompt manageable
  const dataPreview = queryData.slice(0, 50);
  const totalRows = queryData.length;
  const dataStr = JSON.stringify(dataPreview, null, 2);

  return `你是资深数据分析师。请根据以下实际查询结果，给出结构化的数据洞察和追问建议。

## 用户问题
${question}

## 执行的 SQL
${sql}

## 查询结果（共 ${totalRows} 行${totalRows > 50 ? "，以下展示前 50 行" : ""}）
${dataStr}

## 分析阶段
根据对话上下文判断当前分析阶段：
- overview：总览全局数据（首次提问通常是这个阶段）
- breakdown：按维度拆解（如按地区、按类目细分）
- drill：深入某个具体发现（如某个月份、某个异常点）
- anomaly：排查异常原因
- action：给出行动建议

追问建议应引导用户从 overview → breakdown → drill → action 逐步深入。

${historyContext ? `## 对话上下文\n${historyContext}\n` : ""}
${customInstructions ? `## 用户自定义指令\n${customInstructions}\n` : ""}

## 输出要求
基于上面的实际数据，返回严格的 JSON：
{
  "insight": {
    "summary": "核心发现 + 关键数字（1句话，必须引用实际数据中的真实数值）",
    "highlights": [
      { "type": "stat", "text": "统计指标（基于真实数据计算）" },
      { "type": "anomaly", "text": "异常发现（如有）" },
      { "type": "action", "text": "业务建议" }
    ]
  },
  "followUpQuestions": [
    { "text": "推荐的下一个分析问题", "stage": "breakdown | drill | anomaly | action" }
  ],
  "analysisStage": "当前分析阶段"
}

关键规则：
- 所有数字必须来自实际查询结果，禁止编造数据
- summary 必须包含具体数字，禁止占位符如 [需填充]
- highlights 包含 2-4 条，每条标记 type：
  - stat：统计指标（均值、中位数、峰值、增长率、占比等，从数据中计算）
  - anomaly：异常发现（突增/骤降/偏离等，没有明显异常则省略此条）
  - action：业务建议（基于数据的可执行建议）
- 禁止空洞描述如"数据呈现一定趋势"
- followUpQuestions 生成 2-3 个，要具体，与当前数据结果相关

只返回 JSON，不要返回其他任何内容`;
}
