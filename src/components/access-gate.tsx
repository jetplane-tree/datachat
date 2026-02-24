"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "datachat-access-code";

export function useAccessCode() {
  const [code, setCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCode(sessionStorage.getItem(STORAGE_KEY));
    setLoaded(true);
  }, []);

  const saveCode = (value: string) => {
    sessionStorage.setItem(STORAGE_KEY, value);
    setCode(value);
  };

  const clearCode = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCode(null);
  };

  return { code, loaded, saveCode, clearCode };
}

interface AccessGateProps {
  onVerified: (code: string) => void;
}

export function AccessGate({ onVerified }: AccessGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      // Verify the code against the server
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: trimmed }),
      });

      if (res.ok) {
        onVerified(trimmed);
      } else {
        setError("密码错误，请重试");
        setValue("");
      }
    } catch {
      setError("验证失败，请检查网络");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">
              输入访问密码
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              请输入密码以使用数据分析功能
            </p>
          </div>
          <div className="mt-2 w-full space-y-3">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
              autoFocus
              className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-indigo-300"
            />
            {error && (
              <p className="text-center text-xs text-destructive">{error}</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={loading || !value.trim()}
              className="w-full bg-indigo-500 hover:bg-indigo-600"
            >
              {loading ? "验证中..." : "确认"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
