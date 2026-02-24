"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";

export function UploadCard() {
  return (
    <Link href="/analyze/custom">
      <Card className="group flex h-full cursor-pointer items-center gap-4 border border-dashed border-border/60 p-5 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50/30">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-500">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            上传你的数据
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            支持 CSV、JSON、Excel 格式
          </p>
        </div>
      </Card>
    </Link>
  );
}
