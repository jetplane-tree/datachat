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
