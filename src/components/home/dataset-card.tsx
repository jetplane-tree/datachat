"use client";

import Link from "next/link";
import { ShoppingCart, Users, Megaphone, Database, ArrowRight } from "lucide-react";
import { Dataset } from "@/types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  Users,
  Megaphone,
};

interface DatasetCardProps {
  dataset: Dataset;
}

export function DatasetCard({ dataset }: DatasetCardProps) {
  const Icon = iconMap[dataset.icon] || Database;
  const tableCount = dataset.tables.length;
  const totalRows = dataset.tables.reduce((sum, t) => sum + t.rowCount, 0);

  return (
    <Link href={`/analyze/${dataset.id}`}>
      <div className="group relative overflow-hidden rounded-xl border border-stone-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-stone-300/80 hover:shadow-md">
        {/* Subtle gradient accent on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-50/0 transition-all duration-300 group-hover:from-indigo-50/40 group-hover:to-transparent" />

        <div className="relative flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 transition-colors duration-300 group-hover:bg-indigo-100 group-hover:text-indigo-600">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {dataset.name}
              </h3>
              <ArrowRight className="h-3.5 w-3.5 text-stone-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {dataset.description}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-stone-400">
              <span>{tableCount} 张表</span>
              <span className="h-0.5 w-0.5 rounded-full bg-stone-300" />
              <span>{totalRows.toLocaleString()} 行数据</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
