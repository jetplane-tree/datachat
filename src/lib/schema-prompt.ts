import { DatasetTable } from "@/types";

export function buildSchemaPrompt(datasetName: string, tables: DatasetTable[]): string {
  let prompt = `数据集: ${datasetName}\n\n`;
  for (const table of tables) {
    prompt += `表名: ${table.name} (${table.description}, 约${table.rowCount}行)\n`;
    prompt += `字段:\n`;
    for (const col of table.columns) {
      prompt += `  - ${col.name} (${col.type})${col.description ? `: ${col.description}` : ""}${col.sample ? `, 示例: ${col.sample}` : ""}\n`;
    }
    prompt += `\n`;
  }
  return prompt;
}
