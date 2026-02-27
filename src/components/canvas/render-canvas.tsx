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
    <div className="h-full flex flex-col" style={{ background: "var(--gen-background)" }}>
      {/* Tab bar */}
      <div
        className="flex items-center justify-between px-4 h-11 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)" }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("preview")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={
              activeTab === "preview"
                ? { background: "var(--gen-primary)", color: "#fff" }
                : { color: "var(--gen-muted-fg)" }
            }
          >
            <Eye size={13} />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={
              activeTab === "code"
                ? { background: "var(--gen-primary)", color: "#fff" }
                : { color: "var(--gen-muted-fg)" }
            }
          >
            <Code2 size={13} />
            Code
          </button>
        </div>
        {currentCode && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
            style={{ color: "var(--gen-muted-fg)" }}
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
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--gen-muted)" }}
              >
                <Eye size={28} style={{ color: "var(--gen-muted-fg)" }} />
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--gen-foreground)" }}>
                No preview yet
              </h3>
              <p className="text-xs max-w-[240px]" style={{ color: "var(--gen-muted-fg)" }}>
                Start a conversation to generate your dashboard UI or architecture diagram.
              </p>
            </div>
          </div>
        ) : renderMode === "sandpack" ? (
          <SandpackRenderer showCode={showCode} />
        ) : renderMode === "mermaid" ? (
          <MermaidPreview code={currentCode} showCode={showCode} />
        ) : null}
      </div>
    </div>
  );
}
