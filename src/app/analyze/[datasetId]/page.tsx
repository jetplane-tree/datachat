"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDatasetById } from "@/lib/dataset-registry";
import { Header } from "@/components/layout/header";
import { DataSidebar } from "@/components/analyze/data-sidebar";
import { QueryInput } from "@/components/analyze/query-input";
import { AnalysisList } from "@/components/analyze/analysis-list";
import { Database, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccessGate, useAccessCode } from "@/components/access-gate";
import { useCustomInstructions } from "@/components/analyze/custom-instructions";
import { Message, AnalysisResult, QueryResult, DatasetTable } from "@/types";

export default function AnalyzePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const router = useRouter();
  const dataset = getDatasetById(datasetId);
  const { code: accessCode, loaded: codeLoaded, saveCode, clearCode } = useAccessCode();
  const { instructions: customInstructions, save: saveInstructions } = useCustomInstructions();
  const [tables, setTables] = useState<DatasetTable[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState("");

  useEffect(() => {
    if (!dataset) {
      router.replace("/");
      return;
    }

    async function fetchSchema() {
      try {
        const res = await fetch(`/api/schema?datasetId=${datasetId}`);
        const data = await res.json();
        if (res.ok && data.tables) {
          setTables(data.tables);
        }
      } catch {
        // Schema fetch failed — sidebar will just be empty
      } finally {
        setSchemaLoading(false);
      }
    }
    fetchSchema();
  }, [dataset, datasetId, router]);

  const handleClearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSubmit = useCallback(
    async (question: string) => {
      if (!dataset || isAnalyzing) return;

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
      setAnalyzeStage("AI 正在分析你的问题...");

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            datasetId: dataset.id,
            conversationHistory: messages.slice(-6),
            accessCode,
            customInstructions: customInstructions || undefined,
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

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: analysis.insight, analysis, queryResult: data.queryResult }
              : m
          )
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "分析失败，请重试";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: errMsg, error: errMsg } : m
          )
        );
      } finally {
        setIsAnalyzing(false);
        setAnalyzeStage("");
      }
    },
    [dataset, isAnalyzing, messages, accessCode, clearCode, customInstructions]
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

  const handleUpdateResult = useCallback(
    (messageId: string, queryResult: QueryResult, sql: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                queryResult,
                analysis: m.analysis ? { ...m.analysis, sql } : m.analysis,
              }
            : m
        )
      );
    },
    []
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
        {schemaLoading ? (
          <aside className="flex h-full w-64 shrink-0 items-center justify-center border-r border-border/40 bg-muted/20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </aside>
        ) : (
          <DataSidebar datasetName={dataset.name} tables={tables} />
        )}

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
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
                  onUpdateResult={handleUpdateResult}
                  accessCode={accessCode}
                />
              )}
            </div>

            {/* Input bar */}
            <QueryInput
              onSubmit={handleSubmit}
              presetQuestions={
                messages.length === 0 ? dataset.presetQuestions : []
              }
              disabled={isAnalyzing}
              customInstructions={customInstructions}
              onCustomInstructionsChange={saveInstructions}
            />
          </>
        </div>
      </div>
    </div>
  );
}
