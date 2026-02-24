"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnalysisCard } from "@/components/analyze/analysis-card";
import { Message } from "@/types";

interface AnalysisListProps {
  messages: Message[];
  isAnalyzing: boolean;
}

export function AnalysisList({ messages, isAnalyzing }: AnalysisListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group messages into pairs (user + assistant)
  const pairs: { user: Message; assistant: Message }[] = [];
  for (let i = 0; i < messages.length; i += 2) {
    const user = messages[i];
    const assistant = messages[i + 1];
    if (user && assistant) {
      pairs.push({ user, assistant });
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAnalyzing]);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        {pairs.map((pair) => (
          <AnalysisCard
            key={pair.user.id}
            userMessage={pair.user}
            assistantMessage={pair.assistant}
          />
        ))}

        {/* Skeleton loading for next analysis */}
        {isAnalyzing && pairs.length > 0 && !pairs[pairs.length - 1].assistant.analysis && !pairs[pairs.length - 1].assistant.error && null}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
