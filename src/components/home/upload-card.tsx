"use client";

import Link from "next/link";
import { Upload, ArrowRight } from "lucide-react";

export function UploadCard() {
  return (
    <Link href="/analyze/custom">
      <div className="group relative flex h-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-dashed border-stone-300/80 bg-white/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400 transition-colors duration-300 group-hover:bg-indigo-100 group-hover:text-indigo-600">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              上传你的数据
            </h3>
            <ArrowRight className="h-3.5 w-3.5 text-stone-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            支持 CSV、Excel 格式文件
          </p>
        </div>
      </div>
    </Link>
  );
}
