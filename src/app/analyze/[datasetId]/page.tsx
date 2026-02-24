"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDatasetById } from "@/lib/dataset-registry";
import { useDuckDB } from "@/hooks/use-duckdb";
import { Header } from "@/components/layout/header";
import { DataSidebar } from "@/components/analyze/data-sidebar";
import { QueryInput } from "@/components/analyze/query-input";
import { AnalysisList } from "@/components/analyze/analysis-list";
import { Database, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessGate, useAccessCode } from "@/components/access-gate";
import { Message, AnalysisResult, QueryResult } from "@/types";

export default function AnalyzePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();
  const dataset = getDatasetById(datasetId);
  const { isLoading, isReady, error, loadingStage, loadDataset, runQuery } = useDuckDB();
  const { code: accessCode, loaded: codeLoaded, saveCode, clearCode } = useAccessCode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState("");

  useEffect(() => {
    if (!dataset) {
      router.replace("/");
      return;
    }
    loadDataset(dataset);
  }, [dataset, loadDataset, router]);

  const handleClearConversation = useCallback(() => {
    setMessages([]);
  }, []);

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
      setAnalyzeStage("AI 正在理解你的问题...");

      try {
        // Call LLM API
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            datasetId: dataset.id,
            conversationHistory: messages.slice(-6),
            accessCode,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403) {
            clearCode();
            throw new Error("访问密码已失效，请重新输入");
          }
          throw new Error(data.error || "分析请求失败");
        }

        const analysis: AnalysisResult = {
          sql: data.sql,
          chart: data.chart,
          insight: data.insight,
        };

        // Execute SQL via DuckDB — with auto-retry
        setAnalyzeStage("正在执行数据查询...");
        let queryResult: QueryResult;
        try {
          queryResult = await runQuery(analysis.sql);
        } catch (sqlErr) {
          const sqlErrMsg =
            sqlErr instanceof Error ? sqlErr.message : "未知错误";

          // Auto-retry: send error back to LLM for a corrected SQL
          try {
            setAnalyzeStage("SQL 出错，正在自动修正...");
            const retryRes = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question: `之前生成的 SQL 执行失败，错误信息: "${sqlErrMsg}"。原始SQL: ${analysis.sql}。请修正 SQL 并重新回答原始问题: ${question}`,
                datasetId: dataset.id,
                conversationHistory: messages.slice(-6),
                accessCode,
              }),
            });

            const retryData = await retryRes.json();

            if (retryRes.ok && retryData.sql) {
              analysis.sql = retryData.sql;
              analysis.chart = retryData.chart || analysis.chart;
              analysis.insight = retryData.insight || analysis.insight;
              queryResult = await runQuery(retryData.sql);
            } else {
              throw new Error(sqlErrMsg);
            }
          } catch {
            throw new Error(`SQL 执行失败: ${sqlErrMsg}`);
          }
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
        setAnalyzeStage("");
      }
    },
    [dataset, isReady, isAnalyzing, messages, runQuery, accessCode, clearCode]
  );

  // Retry handler for error cards
  const handleRetry = useCallback(
    (question: string) => {
      // Remove the failed pair (last user + assistant messages)
      setMessages((prev) => {
        const newMessages = [...prev];
        // Find and remove the last pair with this question
        for (let i = newMessages.length - 2; i >= 0; i--) {
          if (
            newMessages[i].role === "user" &&
            newMessages[i].content === question
          ) {
            newMessages.splice(i, 2);
            break;
          }
        }
        return newMessages;
      });
      // Re-submit
      setTimeout(() => handleSubmit(question), 100);
    },
    [handleSubmit]
  );

  if (!dataset) return null;

  // Show access gate if no code stored yet
  if (!codeLoaded) return null;
  if (!accessCode) {
    return <AccessGate onVerified={saveCode} />;
  }

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
            <div className="flex flex-1 flex-col items-center justify-center gap-5 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              {loadingStage && (
                <div className="flex w-64 flex-col items-center gap-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                      style={{
                        width: `${(loadingStage.step / loadingStage.totalSteps) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm">{loadingStage.label}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {loadingStage.step} / {loadingStage.totalSteps}
                  </p>
                </div>
              )}
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
              {/* Toolbar - clear conversation */}
              {messages.length > 0 && (
                <div className="flex items-center justify-end border-b border-border/30 px-4 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearConversation}
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                    清空对话
                  </Button>
                </div>
              )}

              {/* Analysis results area */}
              <div className="flex-1 overflow-hidden">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Database className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm">输入问题开始分析</p>
                  </div>
                ) : (
                  <AnalysisList
                    messages={messages}
                    isAnalyzing={isAnalyzing}
                    analyzeStage={analyzeStage}
                    onRetry={handleRetry}
                  />
                )}
              </div>

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
