"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorCardProps {
  question: string;
  error: string;
  onRetry?: (question: string) => void;
}

/**
 * Classify error type and return a user-friendly message.
 */
function getFriendlyMessage(error: string): {
  message: string;
  icon: "sql" | "llm" | "network";
} {
  const lower = error.toLowerCase();

  // Network errors
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("failed to fetch") ||
    lower.includes("网络") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout")
  ) {
    return {
      message: "网络连接失败，请检查网络后重试",
      icon: "network",
    };
  }

  // LLM / API errors
  if (
    lower.includes("llm") ||
    lower.includes("ai 服务") ||
    lower.includes("openai") ||
    lower.includes("api") ||
    lower.includes("返回格式") ||
    lower.includes("返回结果不完整") ||
    lower.includes("服务暂时不可用") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503")
  ) {
    return {
      message: "AI 服务暂时不可用，请稍后重试",
      icon: "llm",
    };
  }

  // SQL errors
  if (
    lower.includes("sql") ||
    lower.includes("syntax") ||
    lower.includes("column") ||
    lower.includes("table") ||
    lower.includes("duckdb") ||
    lower.includes("catalog") ||
    lower.includes("binder")
  ) {
    return {
      message: "分析遇到问题，正在重新尝试...",
      icon: "sql",
    };
  }

  // Default
  return {
    message: error,
    icon: "llm",
  };
}

export function ErrorCard({ question, error, onRetry }: ErrorCardProps) {
  const { message, icon } = getFriendlyMessage(error);

  return (
    <Card className="overflow-hidden border border-destructive/20 shadow-sm">
      {/* Question header */}
      <div className="border-b border-border/30 bg-muted/20 px-5 py-3">
        <p className="text-sm font-medium text-foreground">{question}</p>
      </div>

      {/* Error body */}
      <div className="flex items-start gap-3 px-5 py-4">
        {icon === "network" ? (
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="flex-1">
          <p className="text-sm text-destructive">{message}</p>
          {error !== message && (
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          )}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(question)}
              className="mt-3 h-7 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              重试
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
