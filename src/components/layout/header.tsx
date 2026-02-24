"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3 } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-base font-medium tracking-tight">
            DataChat
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === "/"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            首页
          </Link>
          <Link
            href="/about"
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === "/about"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            关于
          </Link>
        </nav>
      </div>
    </header>
  );
}
