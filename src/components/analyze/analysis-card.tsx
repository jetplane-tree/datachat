"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  BarChart3,
  RefreshCw,
  MessageSquare,
  WifiOff,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Message } from "@/types";
import { ChartRenderer } from "@/components/analyze/chart-renderer";

interface AnalysisCardProps {
  userMessage: Message;
  assistantMessage: Message;
  isFollowUp?: boolean;
  onRetry?: (question: string) => void;
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
                  <span className="text-xs">
                    未找到匹配数据，试试换个问法
                  </span>
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
