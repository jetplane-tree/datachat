"use client";

import { useState, useCallback, useRef } from "react";
import { initDuckDB, getConnection, loadData, executeQuery } from "@/lib/duckdb";
import { Dataset, QueryResult, ColumnInfo } from "@/types";

export interface LoadingStage {
  step: number;
  totalSteps: number;
  label: string;
}

interface UseDuckDBReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  loadingStage: LoadingStage | null;
  loadDataset: (dataset: Dataset) => Promise<void>;
  loadCustomData: (
    tableName: string,
    rows: Record<string, unknown>[],
    columns: ColumnInfo[]
  ) => Promise<void>;
  runQuery: (sql: string) => Promise<QueryResult>;
}

export function useDuckDB(): UseDuckDBReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<LoadingStage | null>(null);
  const loadedRef = useRef<string | null>(null);

  const loadDataset = useCallback(async (dataset: Dataset) => {
    if (loadedRef.current === dataset.id) return;

    setIsLoading(true);
    setError(null);
    setIsReady(false);

    const tableEntries = Object.entries(dataset.dataFiles);
    const totalSteps = tableEntries.length + 1; // engine init + each table

    try {
      setLoadingStage({ step: 1, totalSteps, label: "正在启动数据引擎..." });
      await initDuckDB();
      await getConnection();

      for (let i = 0; i < tableEntries.length; i++) {
        const [tableName, filePath] = tableEntries[i];
        setLoadingStage({
          step: i + 2,
          totalSteps,
          label: `正在加载 ${tableName} 表...`,
        });
        await loadData(tableName, filePath);
      }

      loadedRef.current = dataset.id;
      setLoadingStage(null);
      setIsReady(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "DuckDB 初始化失败";
      setError(message);
      setLoadingStage(null);
      console.error("DuckDB init error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCustomData = useCallback(
    async (
      tableName: string,
      rows: Record<string, unknown>[],
      columns: ColumnInfo[]
    ) => {
      setIsLoading(true);
      setError(null);
      setIsReady(false);

      try {
        const database = await initDuckDB();
        const connection = await getConnection();

        // Build CREATE TABLE statement from column definitions
        const colDefs = columns
          .map((col) => `"${col.name}" ${mapColumnType(col.type)}`)
          .join(", ");
        await connection.query(
          `CREATE OR REPLACE TABLE ${tableName} (${colDefs})`
        );

        // Insert data in batches using JSON
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const jsonStr = JSON.stringify(batch);
          const fileName = `${tableName}_batch_${i}.json`;
          await database.registerFileText(fileName, jsonStr);
          await connection.query(
            `INSERT INTO ${tableName} SELECT * FROM read_json_auto('${fileName}')`
          );
        }

        loadedRef.current = `custom-${tableName}-${Date.now()}`;
        setIsReady(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "数据加载失败";
        setError(message);
        console.error("DuckDB custom data load error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const runQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    if (!isReady) {
      throw new Error("DuckDB 尚未就绪");
    }
    return executeQuery(sql);
  }, [isReady]);

  return { isLoading, isReady, error, loadingStage, loadDataset, loadCustomData, runQuery };
}

/**
 * Map our type names to DuckDB SQL types.
 */
function mapColumnType(type: string): string {
  switch (type) {
    case "INTEGER":
      return "BIGINT";
    case "DOUBLE":
      return "DOUBLE";
    case "DATE":
      return "VARCHAR"; // Store as VARCHAR to avoid parsing issues, DuckDB can cast as needed
    case "BOOLEAN":
      return "BOOLEAN";
    default:
      return "VARCHAR";
  }
}
