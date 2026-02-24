"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDatasetById } from "@/lib/dataset-registry";
import { useDuckDB } from "@/hooks/use-duckdb";
import { Header } from "@/components/layout/header";
import { DataSidebar } from "@/components/analyze/data-sidebar";
import { QueryInput } from "@/components/analyze/query-input";
import { AnalysisList } from "@/components/analyze/analysis-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Loader2 } from "lucide-react";
import { Message, AnalysisResult, QueryResult } from "@/types";

export default function AnalyzePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();
  const dataset = getDatasetById(datasetId);
  const { isLoading, isReady, error, loadDataset, runQuery } = useDuckDB();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!dataset) {
      router.replace("/");
      return;
    }
    loadDataset(dataset);
  }, [dataset, loadDataset, router]);

  const handleSubmit = useCallback(
    async (question: string) => {
      if (!dataset || !isReady || isAnalyzing) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: question,
        timestamp: Date.now(),
      };

      const assistantId = `msg-${Date.now() + 1}`;
      const placeholderMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now() + 1,
      };

      setMessages((prev) => [...prev, userMessage, placeholderMessage]);
      setIsAnalyzing(true);

      try {
        // Call LLM API
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            datasetId: dataset.id,
            conversationHistory: messages,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "分析请求失败");
        }

        const analysis: AnalysisResult = {
          sql: data.sql,
          chart: data.chart,
          insight: data.insight,
        };

        // Execute SQL via DuckDB
        let queryResult: QueryResult;
        try {
          queryResult = await runQuery(analysis.sql);
        } catch (sqlErr) {
          throw new Error(
            `SQL 执行失败: ${sqlErr instanceof Error ? sqlErr.message : "未知错误"}`
          );
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: analysis.insight,
                  analysis,
                  queryResult,
                }
              : m
          )
        );
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "分析失败，请重试";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errMsg, error: errMsg }
              : m
          )
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [dataset, isReady, isAnalyzing, messages, runQuery]
  );

  if (!dataset) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <DataSidebar dataset={dataset} />

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <p className="text-sm">正在加载数据引擎...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-destructive">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Ready state */}
          {isReady && (
            <>
              {/* Analysis results area */}
              <div className="flex-1 overflow-hidden">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Database className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm">
                      输入问题开始分析
                    </p>
                  </div>
                ) : (
                  <AnalysisList
                    messages={messages}
                    isAnalyzing={isAnalyzing}
                  />
                )}
              </div>

              {/* Loading skeleton for initial */}
              {isLoading && (
                <div className="px-6 py-4">
                  <Skeleton className="h-48 w-full rounded-lg" />
                </div>
              )}

              {/* Input bar */}
              <QueryInput
                onSubmit={handleSubmit}
                presetQuestions={
                  messages.length === 0 ? dataset.presetQuestions : []
                }
                disabled={isAnalyzing || !isReady}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
