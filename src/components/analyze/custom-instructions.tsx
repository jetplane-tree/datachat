"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "datachat-custom-instructions";

export function useCustomInstructions() {
  const [instructions, setInstructions] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setInstructions(saved);
    setLoaded(true);
  }, []);

  const save = useCallback((value: string) => {
    setInstructions(value);
    if (value.trim()) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { instructions, save, loaded };
}

interface CustomInstructionsProps {
  value: string;
  onChange: (value: string) => void;
}

export function CustomInstructions({ value, onChange }: CustomInstructionsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
          value.trim()
            ? "text-indigo-500 hover:bg-indigo-50"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="自定义指令"
      >
        <Settings2 className="h-3.5 w-3.5" />
        {value.trim() ? "已设置指令" : "自定义指令"}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-80 rounded-lg border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">自定义指令</span>
            <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
            添加自定义分析偏好，例如：&quot;用中文回答&quot;、&quot;重点关注同比增长&quot;、&quot;图表标题用英文&quot;等。
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入你的自定义指令..."
            rows={3}
            className="w-full rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300/50"
          />
          <div className="mt-2 flex items-center justify-between">
            {value.trim() && (
              <button
                onClick={() => {
                  setDraft("");
                  onChange("");
                  setOpen(false);
                }}
                className="text-[10px] text-destructive hover:underline"
              >
                清除
              </button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 text-[10px]">
                取消
              </Button>
              <Button size="sm" onClick={handleSave} className="h-6 text-[10px]">
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
