// Dataset metadata
export interface DatasetTable {
  name: string;
  description: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  sample: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  icon: string;
  tables: DatasetTable[];
  presetQuestions: string[];
  dataFiles: Record<string, string>;
}

// LLM response
export interface AnalysisResult {
  sql: string;
  chart: ChartConfig;
  insight: string;
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "scatter" | "heatmap" | "funnel" | "table";
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
