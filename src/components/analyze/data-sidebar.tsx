"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Table2, Database } from "lucide-react";
import { Dataset, DatasetTable } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DataSidebarProps {
  dataset: Dataset;
}

function TableSection({ table }: { table: DatasetTable }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <Table2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <span className="font-medium text-foreground">{table.name}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {table.rowCount.toLocaleString()} 行
        </span>
      </button>
      {expanded && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
          {table.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-baseline gap-2 py-0.5 text-xs"
            >
              <span className="text-foreground">{col.name}</span>
              <span className="text-[10px] text-muted-foreground/70">
                {col.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataSidebar({ dataset }: DataSidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/40 bg-muted/20">
      <div className="flex items-center gap-2 px-4 py-3">
        <Database className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-foreground">
          {dataset.name}
        </h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {dataset.tables.map((table) => (
            <TableSection key={table.name} table={table} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
