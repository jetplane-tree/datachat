"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  BarChart3,
  RefreshCw,
  MessageSquare,
  WifiOff,
  Play,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartConfig, Message, QueryResult } from "@/types";
import { ChartRenderer } from "@/components/analyze/chart-renderer";
import { DataTable } from "@/components/analyze/data-table";

interface AnalysisCardProps {
  userMessage: Message;
  assistantMessage: Message;
  isFollowUp?: boolean;
  onRetry?: (question: string) => void;
  onUpdateResult?: (messageId: string, queryResult: QueryResult, sql: string) => void;
  analyzeStage?: string;
  accessCode?: string;
}

/**
 * Classify error type and return a user-friendly message.
 */
function getFriendlyError(error: string): {
  message: string;
  isNetwork: boolean;
} {
  const lower = error.toLowerCase();

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch") ||
    lower.includes("网络") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout")
  ) {
    return { message: "网络连接失败，请检查网络后重试", isNetwork: true };
  }

  if (
    lower.includes("llm") ||
    lower.includes("openai") ||
    lower.includes("返回格式") ||
    lower.includes("返回结果不完整") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("502") ||
    lower.includes("503")
  ) {
    return { message: "AI 服务暂时不可用，请稍后重试", isNetwork: false };
  }

  if (
    lower.includes("sql 执行失败") ||
    lower.includes("syntax") ||
    lower.includes("duckdb")
  ) {
    return { message: "分析遇到问题，请尝试换个问法", isNetwork: false };
  }

  return { message: error, isNetwork: false };
}

export function AnalysisCard({
  userMessage,
  assistantMessage,
  isFollowUp = false,
  onRetry,
  onUpdateResult,
  analyzeStage,
  accessCode,
}: AnalysisCardProps) {
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingSQL, setEditingSQL] = useState(false);
  const [editedSQL, setEditedSQL] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [overrideChartType, setOverrideChartType] = useState<string | null>(null);

  const { analysis, queryResult, error } = assistantMessage;

  const effectiveChartType = overrideChartType || analysis?.chart?.type;
  const isTableMode = effectiveChartType === "table";

  const handleCopySQL = async () => {
    if (!analysis?.sql) return;
    await navigator.clipboard.writeText(analysis.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSQL = () => {
    setEditedSQL(analysis?.sql || "");
    setEditingSQL(true);
    setExecuteError(null);
  };

  const handleCancelEdit = () => {
    setEditingSQL(false);
    setEditedSQL("");
    setExecuteError(null);
  };

  const handleExecuteSQL = async () => {
    if (!editedSQL.trim() || !onUpdateResult) return;
    setExecuting(true);
    setExecuteError(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: editedSQL, accessCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "查询失败");

      onUpdateResult(assistantMessage.id, data, editedSQL);
      setEditingSQL(false);
      setOverrideChartType(null);
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setExecuting(false);
    }
  };

  const friendlyError = error ? getFriendlyError(error) : null;

  return (
    <Card className={`overflow-hidden border shadow-sm ${error ? "border-destructive/20" : "border-border/50"}`}>
      {/* Question header */}
      <div className="border-b border-border/30 bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2">
          {isFollowUp && (
            <Badge
              variant="secondary"
              className="gap-1 text-[10px] font-normal"
            >
              <MessageSquare className="h-2.5 w-2.5" />
              追问
            </Badge>
          )}
          <p className="text-sm font-medium text-foreground">
            {userMessage.content}
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && friendlyError && (
        <div className="flex items-start gap-3 px-5 py-4">
          {friendlyError.isNetwork ? (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="flex-1">
            <p className="text-sm text-destructive">{friendlyError.message}</p>
            {friendlyError.message !== error && (
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            )}
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(userMessage.content)}
                className="mt-2 h-7 gap-1.5 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                重试
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Analysis results */}
      {analysis && !error && (
        <div className="space-y-0">
          {/* Chart (hidden in table mode) */}
          {!isTableMode && (
            <div className="px-5 pt-4 pb-2">
              {queryResult && queryResult.rows.length > 0 ? (
                <div className="relative">
                  {/* Chart type switcher */}
                  <div className="absolute right-0 top-0 z-10">
                    <select
                      value={effectiveChartType || "bar"}
                      onChange={(e) => setOverrideChartType(e.target.value)}
                      className="rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] text-muted-foreground outline-none hover:border-border focus:ring-1 focus:ring-indigo-500/50"
                    >
                      <option value="bar">柱状图</option>
                      <option value="line">折线图</option>
                      <option value="pie">饼图</option>
                      <option value="scatter">散点图</option>
                      <option value="funnel">漏斗图</option>
                      <option value="table">仅表格</option>
                    </select>
                  </div>
                  <ChartRenderer
                    chartConfig={{
                      ...analysis.chart,
                      type: (effectiveChartType || analysis.chart.type) as ChartConfig["type"],
                    }}
                    queryResult={queryResult}
                  />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                    <span className="text-xs">
                      未找到匹配数据，试试换个问法
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Table mode header with switcher */}
          {isTableMode && queryResult && queryResult.rows.length > 0 && (
            <div className="flex items-center justify-end px-5 pt-3">
              <select
                value="table"
                onChange={(e) => setOverrideChartType(e.target.value)}
                className="rounded-md border border-border/50 bg-background px-2 py-1 text-[10px] text-muted-foreground outline-none hover:border-border focus:ring-1 focus:ring-indigo-500/50"
              >
                <option value="bar">柱状图</option>
                <option value="line">折线图</option>
                <option value="pie">饼图</option>
                <option value="scatter">散点图</option>
                <option value="funnel">漏斗图</option>
                <option value="table">仅表格</option>
              </select>
            </div>
          )}

          {/* Data table */}
          {queryResult && queryResult.rows.length > 0 && (
            <div className="pt-2 pb-1">
              <DataTable queryResult={queryResult} defaultExpanded={isTableMode} />
            </div>
          )}

          {/* Insight */}
          <div className="mx-5 rounded-lg border border-indigo-100/60 bg-indigo-50/30 px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {analysis.insight}
            </p>
          </div>

          {/* SQL section */}
          <div className="px-5 pb-4 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSqlExpanded(!sqlExpanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {sqlExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                查看 SQL
              </button>
              {sqlExpanded && !editingSQL && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleEditSQL}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    编辑
                  </button>
                  <button
                    onClick={handleCopySQL}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
              )}
            </div>

            {sqlExpanded && (
              <div className="mt-2">
                {editingSQL ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedSQL}
                      onChange={(e) => setEditedSQL(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500/50"
                      rows={Math.min(editedSQL.split("\n").length + 2, 12)}
                    />
                    {executeError && (
                      <p className="text-xs text-destructive">{executeError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 text-xs">
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleExecuteSQL}
                        disabled={executing || !editedSQL.trim()}
                        className="h-7 gap-1 text-xs"
                      >
                        {executing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        执行查询
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-lg bg-zinc-950 p-3">
                    <pre className="overflow-x-auto text-xs leading-relaxed text-zinc-300">
                      <code>{analysis?.sql}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state (no analysis, no error) */}
      {!analysis && !error && (
        <div className="px-5 py-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground">
              {analyzeStage || "分析中..."}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
