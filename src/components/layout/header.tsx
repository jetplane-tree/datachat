"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <span className="text-lg font-semibold tracking-tight">
            DataChat
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            首页
          </Link>
          <Link
            href="/about"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            关于
          </Link>
        </nav>
      </div>
    </header>
  );
}
