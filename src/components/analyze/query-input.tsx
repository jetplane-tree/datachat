"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInstructions } from "@/components/analyze/custom-instructions";

interface QueryInputProps {
  onSubmit: (question: string) => void;
  presetQuestions: string[];
  disabled?: boolean;
  customInstructions?: string;
  onCustomInstructionsChange?: (value: string) => void;
}

export function QueryInput({
  onSubmit,
  presetQuestions,
  disabled = false,
  customInstructions,
  onCustomInstructionsChange,
}: QueryInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handlePresetClick = (question: string) => {
    if (disabled) return;
    onSubmit(question);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  return (
    <div className="border-t border-border/40 bg-background px-4 pb-4 pt-3">
      {/* Preset question chips */}
      {presetQuestions.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {presetQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handlePresetClick(q)}
              disabled={disabled}
              className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground transition-all hover:border-indigo-300 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 transition-colors focus-within:border-indigo-300 focus-within:bg-background">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="输入你的数据分析问题..."
          disabled={disabled}
          rows={1}
          className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="h-7 w-7 shrink-0 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Custom instructions */}
      {onCustomInstructionsChange && (
        <div className="mt-1.5 flex items-center">
          <CustomInstructions
            value={customInstructions || ""}
            onChange={onCustomInstructionsChange}
          />
        </div>
      )}
    </div>
  );
}
