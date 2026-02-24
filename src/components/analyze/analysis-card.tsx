"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Message } from "@/types";
import { ChartRenderer } from "@/components/analyze/chart-renderer";

interface AnalysisCardProps {
  userMessage: Message;
  assistantMessage: Message;
}

export function AnalysisCard({
  userMessage,
  assistantMessage,
}: AnalysisCardProps) {
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { analysis, queryResult, error } = assistantMessage;

  const handleCopySQL = async () => {
    if (!analysis?.sql) return;
    await navigator.clipboard.writeText(analysis.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden border border-border/50 shadow-sm">
      {/* Question header */}
      <div className="border-b border-border/30 bg-muted/20 px-5 py-3">
        <p className="text-sm font-medium text-foreground">
          {userMessage.content}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 px-5 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Analysis results */}
      {analysis && !error && (
        <div className="space-y-0">
          {/* Chart */}
          <div className="px-5 pt-4 pb-2">
            {queryResult && queryResult.rows.length > 0 ? (
              <ChartRenderer
                chartConfig={analysis.chart}
                queryResult={queryResult}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                  <span className="text-xs">暂无数据</span>
                </div>
              </div>
            )}
          </div>

          {/* Insight */}
          <div className="mx-5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {analysis.insight}
            </p>
          </div>

          {/* SQL section */}
          <div className="px-5 pb-4 pt-2">
            <button
              onClick={() => setSqlExpanded(!sqlExpanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {sqlExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              查看 SQL
            </button>
            {sqlExpanded && (
              <div className="relative mt-2 rounded-lg bg-zinc-950 p-3">
                <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-300">
                  <code>{analysis.sql}</code>
                </pre>
                <button
                  onClick={handleCopySQL}
                  className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state (no analysis, no error) */}
      {!analysis && !error && (
        <div className="px-5 py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
            <span className="ml-2 text-sm">分析中...</span>
          </div>
        </div>
      )}
    </Card>
  );
}
