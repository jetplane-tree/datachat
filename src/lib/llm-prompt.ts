import { Message } from "@/types";

export function buildAnalysisPrompt(
  schemaInfo: string,
  question: string,
  conversationHistory: Message[]
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
