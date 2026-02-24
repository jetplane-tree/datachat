"use client";

import { useEffect } from "react";
import { preloadDuckDB } from "@/lib/duckdb";

export function DuckDBPreloader() {
  useEffect(() => {
    preloadDuckDB();
  }, []);
  return null;
}
