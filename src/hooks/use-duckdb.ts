"use client";

import { useState, useCallback, useRef } from "react";
import { initDuckDB, getConnection, loadData, executeQuery } from "@/lib/duckdb";
import { Dataset, QueryResult } from "@/types";

interface UseDuckDBReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  loadDataset: (dataset: Dataset) => Promise<void>;
  runQuery: (sql: string) => Promise<QueryResult>;
}

export function useDuckDB(): UseDuckDBReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const loadDataset = useCallback(async (dataset: Dataset) => {
    if (loadedRef.current === dataset.id) return;

    setIsLoading(true);
    setError(null);
    setIsReady(false);

    try {
      await initDuckDB();
      await getConnection();

      for (const [tableName, filePath] of Object.entries(dataset.dataFiles)) {
        await loadData(tableName, filePath);
      }

      loadedRef.current = dataset.id;
      setIsReady(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "DuckDB 初始化失败";
      setError(message);
      console.error("DuckDB init error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    if (!isReady) {
      throw new Error("DuckDB 尚未就绪");
    }
    return executeQuery(sql);
  }, [isReady]);

  return { isLoading, isReady, error, loadDataset, runQuery };
}
