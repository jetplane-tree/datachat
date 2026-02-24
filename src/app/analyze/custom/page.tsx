"use client";

import { useState, useCallback, useRef } from "react";
import { useDuckDB } from "@/hooks/use-duckdb";
import { Header } from "@/components/layout/header";
import { DataSidebar } from "@/components/analyze/data-sidebar";
import { QueryInput } from "@/components/analyze/query-input";
import { AnalysisList } from "@/components/analyze/analysis-list";
import { parseFile, generatePresetQuestions } from "@/lib/file-parser";
import { getSchemaPrompt } from "@/lib/dataset-registry";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dataset, Message, AnalysisResult, QueryResult } from "@/types";

const TABLE_NAME = "uploaded_data";
const MAX_FILE_SIZE_WARNING = 10 * 1024 * 1024; // 10MB

export default function CustomAnalyzePage() {
  const { isLoading, isReady, error, loadCustomData, runQuery } = useDuckDB();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsParsing(true);

      // File size warning (but still allow)
      if (file.size > MAX_FILE_SIZE_WARNING) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        console.warn(
          `File size is ${sizeMB}MB, which may affect performance.`
        );
      }

      try {
        const { columns, rows } = await parseFile(file);

        if (rows.length === 0) {
          throw new Error("文件中没有数据行");
        }

        // Load data into DuckDB
        await loadCustomData(TABLE_NAME, rows, columns);

        // Build a temporary Dataset object
        const presetQuestions = generatePresetQuestions(columns);
        const customDataset: Dataset = {
          id: "custom",
          name: file.name,
          description: `上传的文件，共 ${rows.length} 行，${columns.length} 列`,
          icon: "FileSpreadsheet",
          tables: [
            {
              name: TABLE_NAME,
              description: `从 ${file.name} 导入的数据`,
              columns,
              rowCount: rows.length,
            },
          ],
          presetQuestions,
          dataFiles: {},
        };

        setDataset(customDataset);
        setMessages([]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "文件解析失败，请重试";
        setUploadError(msg);
        console.error("File parse error:", err);
      } finally {
        setIsParsing(false);
      }
    },
    [loadCustomData]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset the input so the same file can be re-uploaded
      e.target.value = "";
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
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

      try {
        // Build schema info for the custom dataset
        const schemaInfo = getSchemaPrompt(dataset);

        // Call LLM API with schemaInfo passed directly
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            datasetId: "custom",
            schemaInfo,
            conversationHistory: messages.slice(-6),
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

        // Execute SQL via DuckDB — with auto-retry
        let queryResult: QueryResult;
        try {
          queryResult = await runQuery(analysis.sql);
        } catch (sqlErr) {
          const sqlErrMsg =
            sqlErr instanceof Error ? sqlErr.message : "未知错误";

          // Auto-retry: send error back to LLM for a corrected SQL
          try {
            const retryRes = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question: `之前生成的 SQL 执行失败，错误信息: "${sqlErrMsg}"。原始SQL: ${analysis.sql}。请修正 SQL 并重新回答原始问题: ${question}`,
                datasetId: "custom",
                schemaInfo,
                conversationHistory: messages.slice(-6),
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

        // Handle empty results
        if (queryResult.rows.length === 0) {
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
        } else {
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
        }
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

  // Retry handler for error cards
  const handleRetry = useCallback(
    (question: string) => {
      // Remove the failed pair (last user + assistant messages)
      setMessages((prev) => {
        const newMessages = [...prev];
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

  // Upload UI — shown when no data is loaded yet
  if (!dataset && !isParsing && !isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 transition-all duration-200 ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50/50"
                  : "border-border/60 hover:border-indigo-300 hover:bg-indigo-50/20"
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <Upload className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  点击或拖拽文件到此处
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  支持 CSV、Excel (.xlsx / .xls) 格式
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  建议文件大小不超过 10MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {uploadError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading/parsing state
  if (isParsing || isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-sm">
            {isParsing ? "正在解析文件..." : "正在加载数据引擎..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !dataset) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-destructive">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Analysis workspace — shown after data is loaded
  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        {dataset && <DataSidebar dataset={dataset} />}

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
          {isReady && dataset && (
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
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30" />
                    <div className="text-center">
                      <p className="text-sm">
                        已加载 {dataset.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {dataset.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <AnalysisList
                    messages={messages}
                    isAnalyzing={isAnalyzing}
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
