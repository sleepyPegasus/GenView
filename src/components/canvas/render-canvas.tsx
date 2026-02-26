"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { SandpackRenderer } from "./sandpack-preview";
import { MermaidPreview } from "./mermaid-preview";
import { Code2, Eye, Copy, Check } from "lucide-react";

export function RenderCanvas() {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const { currentCode, renderMode } = useAppStore();

  const handleCopy = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showCode = activeTab === "code";

  return (
    <div className="h-full flex flex-col bg-[--gen-background]">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-[--gen-border] px-4 h-11 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "preview"
                ? "bg-[--gen-primary] text-white"
                : "text-[--gen-muted-fg] hover:text-[--gen-foreground] hover:bg-[--gen-muted]"
            }`}
          >
            <Eye size={13} />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === "code"
                ? "bg-[--gen-primary] text-white"
                : "text-[--gen-muted-fg] hover:text-[--gen-foreground] hover:bg-[--gen-muted]"
            }`}
          >
            <Code2 size={13} />
            Code
          </button>
        </div>
        {currentCode && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[--gen-muted-fg] hover:text-[--gen-foreground] hover:bg-[--gen-muted] rounded-md transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Code"}
          </button>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden">
        {!currentCode || !renderMode ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[--gen-muted] flex items-center justify-center mx-auto mb-4">
                <Eye size={28} className="text-[--gen-muted-fg]" />
              </div>
              <h3 className="text-sm font-medium text-[--gen-foreground] mb-1">
                No preview yet
              </h3>
              <p className="text-xs text-[--gen-muted-fg] max-w-[240px]">
                Start a conversation to generate your dashboard UI or architecture diagram.
              </p>
            </div>
          </div>
        ) : renderMode === "sandpack" ? (
          <SandpackRenderer code={currentCode} showCode={showCode} />
        ) : renderMode === "mermaid" ? (
          <MermaidPreview code={currentCode} showCode={showCode} />
        ) : null}
      </div>
    </div>
  );
}
