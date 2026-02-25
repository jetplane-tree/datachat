import { Message } from "@/types";

export function buildAnalysisPrompt(
  schemaInfo: string,
  question: string,
  conversationHistory: Message[],
  customInstructions?: string
): string {
  const historyContext = conversationHistory
    .slice(-6)
    .map((m) => {
      if (m.role === "user") return `用户: ${m.content}`;
      if (m.analysis) return `分析结果: SQL=${m.analysis.sql}, 洞察=${m.analysis.insight}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return `根据用户的问题，生成 SQL 查询语句、图表配置和数据洞察。

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
  "chart": { "type": "line", "xField": "month", "yField": "total_sales", "title": "各月销售额趋势" },
  "insight": "2024年销售额整体呈上升趋势，其中12月达到峰值 85.2 万元，环比增长 23%。建议关注 Q4 旺季备货策略。"
}
\`\`\`

问题: "各商品类目的销售占比"
\`\`\`json
{
  "sql": "SELECT category, SUM(total_amount) AS total_sales FROM orders GROUP BY category ORDER BY total_sales DESC",
  "chart": { "type": "pie", "xField": "category", "yField": "total_sales", "title": "各商品类目销售占比" },
  "insight": "数码配件以 35.2% 的占比位居第一，贡献销售额 210 万元。前三大类目合计占总销售额的 72%，长尾类目可考虑精简。"
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
  },
  "insight": "2-3句话的数据洞察"
}

关键规则：
- SQL 必须只使用上面列出的表和字段
- xField 和 yField 的值必须与 SQL SELECT 中的列名或 AS 别名完全一致
- 如果 SQL 写了 SELECT strftime('%Y-%m', order_date) AS month，那 xField 必须是 "month"
- seriesField 同理，必须是 SELECT 中存在的列名
- 饼图的 type 使用 "pie"，xField 是分类字段，yField 是数值字段
- 当用户想查看明细数据、原始记录、列表详情时，type 使用 "table"，此时不需要聚合，直接 SELECT 需要的字段即可

insight 要求：
- 第一句：核心发现 + 关键数字（如"销售额最高的是数码配件类目，达到 125 万元"）
- 第二句：趋势或对比（如"较上月增长 15%"或"是第二名的 2.3 倍"）
- 第三句（可选）：业务建议
- 禁止空洞描述如"数据呈现一定趋势"

只返回 JSON，不要返回其他任何内容`;
}
