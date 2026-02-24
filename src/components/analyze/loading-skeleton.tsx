"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <Card className="overflow-hidden border border-border/50 shadow-sm">
      {/* Question header skeleton */}
      <div className="border-b border-border/30 bg-muted/20 px-5 py-3">
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Content area */}
      <div className="space-y-4 px-5 py-5">
        {/* Chart area skeleton */}
        <div className="flex h-[200px] items-center justify-center rounded-lg bg-muted/20">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 [animation-delay:300ms]" />
            <span className="ml-2 text-sm">分析中...</span>
          </div>
        </div>

        {/* Insight skeleton */}
        <div className="space-y-2 rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>

        {/* SQL toggle skeleton */}
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  );
}
