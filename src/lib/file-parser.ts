import { ColumnInfo } from "@/types";
import * as XLSX from "xlsx";

export interface ParsedFile {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

/**
 * Parse a CSV or Excel file and return structured data with auto-detected column types.
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv") {
    return parseCsv(file);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file);
  } else {
    throw new Error(`不支持的文件格式: .${ext}，请上传 CSV 或 Excel 文件`);
  }
}

/**
 * Parse CSV file using FileReader.
 * Handles UTF-8 BOM and basic CSV parsing.
 */
async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await readFileAsText(file);
  // Remove UTF-8 BOM if present
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const lines = splitCsvLines(cleaned);
  if (lines.length < 2) {
    throw new Error("CSV 文件至少需要包含表头和一行数据");
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const safeHeaders = rawHeaders.map(sanitizeColumnName);

  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    safeHeaders.forEach((h, idx) => {
      row[h] = values[idx] ?? null;
    });
    rows.push(row);
  }

  const columns = detectColumnTypes(safeHeaders, rows);
  // Convert values to proper types based on detection
  const typedRows = rows.map((row) => {
    const typedRow: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col.name];
      if (val === null || val === undefined || val === "") {
        typedRow[col.name] = null;
      } else if (col.type === "DOUBLE") {
        typedRow[col.name] = parseFloat(String(val));
      } else if (col.type === "INTEGER") {
        typedRow[col.name] = parseInt(String(val), 10);
      } else {
        typedRow[col.name] = String(val);
      }
    }
    return typedRow;
  });

  return { columns, rows: typedRows };
}

/**
 * Split CSV text into lines, respecting quoted fields that may contain newlines.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++; // skip \n in \r\n
      }
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    lines.push(current);
  }
  return lines;
}

/**
 * Parse a single CSV line into an array of values.
 * Handles quoted fields with commas and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * Parse Excel file using the xlsx package.
 */
async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel 文件中没有找到工作表");
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  if (jsonData.length === 0) {
    throw new Error("Excel 文件中没有数据");
  }

  const rawHeaders = Object.keys(jsonData[0]);
  const safeHeaders = rawHeaders.map(sanitizeColumnName);

  // Build a mapping from raw header to safe header
  const headerMap: Record<string, string> = {};
  rawHeaders.forEach((raw, i) => {
    headerMap[raw] = safeHeaders[i];
  });

  // Remap rows to use safe header names
  const remappedRows = jsonData.map((row) => {
    const newRow: Record<string, unknown> = {};
    for (const raw of rawHeaders) {
      newRow[headerMap[raw]] = row[raw];
    }
    return newRow;
  });

  const columns = detectColumnTypes(safeHeaders, remappedRows);

  // Convert values to proper types based on detection
  const typedRows = remappedRows.map((row) => {
    const typedRow: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col.name];
      if (val === null || val === undefined || val === "") {
        typedRow[col.name] = null;
      } else if (col.type === "DOUBLE") {
        const num = parseFloat(String(val));
        typedRow[col.name] = isNaN(num) ? null : num;
      } else if (col.type === "INTEGER") {
        const num = parseInt(String(val), 10);
        typedRow[col.name] = isNaN(num) ? null : num;
      } else {
        typedRow[col.name] = String(val);
      }
    }
    return typedRow;
  });

  return { columns, rows: typedRows };
}

/**
 * Auto-detect column types by sampling up to the first 100 rows.
 */
function detectColumnTypes(
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnInfo[] {
  const sampleSize = Math.min(rows.length, 100);
  const sampleRows = rows.slice(0, sampleSize);

  return headers.map((header) => {
    let hasInteger = false;
    let hasDouble = false;
    let hasDate = false;
    let hasString = false;
    let nonNullCount = 0;
    let sampleValue = "";

    for (const row of sampleRows) {
      const val = row[header];
      if (val === null || val === undefined || val === "") continue;

      nonNullCount++;
      const str = String(val);
      if (!sampleValue) sampleValue = str;

      // Check if it's a date (YYYY-MM-DD pattern)
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        hasDate = true;
        continue;
      }

      // Check if numeric
      if (!isNaN(Number(str)) && str.trim() !== "") {
        if (Number.isInteger(Number(str)) && !str.includes(".")) {
          hasInteger = true;
        } else {
          hasDouble = true;
        }
        continue;
      }

      hasString = true;
    }

    // Determine type based on what we found
    let type: string;
    if (nonNullCount === 0) {
      type = "VARCHAR";
    } else if (hasString) {
      type = "VARCHAR";
    } else if (hasDate && !hasInteger && !hasDouble) {
      type = "DATE";
    } else if (hasDouble) {
      type = "DOUBLE";
    } else if (hasInteger) {
      type = "INTEGER";
    } else {
      type = "VARCHAR";
    }

    // Header names are already sanitized by callers
    return {
      name: header,
      type,
      description: header,
      sample: sampleValue || "",
    };
  });
}

/**
 * Sanitize column name for safe use in SQL.
 * Replace spaces and special characters with underscores.
 */
function sanitizeColumnName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    || "column";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate preset analysis questions based on column types.
 */
export function generatePresetQuestions(columns: ColumnInfo[]): string[] {
  const questions: string[] = [];

  const dateColumns = columns.filter((c) => c.type === "DATE");
  const numericColumns = columns.filter(
    (c) => c.type === "DOUBLE" || c.type === "INTEGER"
  );
  const categoricalColumns = columns.filter((c) => c.type === "VARCHAR");

  // Time-based trend question
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const dateCol = dateColumns[0];
    const numCol = numericColumns[0];
    questions.push(
      `${numCol.name} 按 ${dateCol.name} 的变化趋势是怎样的？`
    );
  }

  // Distribution question for numeric columns
  if (numericColumns.length > 0) {
    const numCol = numericColumns[0];
    questions.push(`${numCol.name} 的分布情况是怎样的？`);
  }

  // Category breakdown question
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const catCol = categoricalColumns[0];
    const numCol = numericColumns[0];
    questions.push(
      `不同 ${catCol.name} 的 ${numCol.name} 对比如何？`
    );
  }

  // Top N question
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const catCol = categoricalColumns[0];
    const numCol = numericColumns.length > 1 ? numericColumns[1] : numericColumns[0];
    questions.push(
      `${numCol.name} 最高的前 10 个 ${catCol.name} 是哪些？`
    );
  }

  // Categorical proportion question
  if (categoricalColumns.length > 0) {
    const catCol =
      categoricalColumns.length > 1
        ? categoricalColumns[1]
        : categoricalColumns[0];
    questions.push(`各 ${catCol.name} 的数量占比是多少？`);
  }

  // Return first 4 questions
  return questions.slice(0, 4);
}
