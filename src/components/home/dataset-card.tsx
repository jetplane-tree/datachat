"use client";

import Link from "next/link";
import { ShoppingCart, Users, Megaphone, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card className="group relative cursor-pointer overflow-hidden border border-border/60 p-5 transition-all duration-200 hover:border-border hover:shadow-md">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 transition-colors group-hover:bg-indigo-100">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {dataset.name}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {dataset.description}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge
                variant="secondary"
                className="text-[11px] font-normal"
              >
                {tableCount} 张表
              </Badge>
              <Badge
                variant="secondary"
                className="text-[11px] font-normal"
              >
                {totalRows.toLocaleString()} 行
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
