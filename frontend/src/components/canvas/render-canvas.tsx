"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/app-store";
import { SandpackRenderer } from "./sandpack-preview";
import { MermaidPreview } from "./mermaid-preview";
import { Code2, Eye, Copy, Check, Loader2, Download } from "lucide-react";

/**
 * Lightweight code viewer used during streaming.
 * Avoids Sandpack entirely so there's no sandbox recompile / flicker.
 */
function StreamingCodeViewer() {
  const currentCode = useAppStore((s) => s.currentCode);
  const preRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom as code streams in
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [currentCode]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center gap-2 px-4 py-2 text-xs flex-shrink-0"
        style={{ color: "var(--gen-primary)", borderBottom: "1px solid var(--gen-border)" }}
      >
        <Loader2 size={12} className="animate-spin" />
        <span>Generating code...</span>
      </div>
      <pre
        ref={preRef}
        className="flex-1 overflow-auto p-4 text-xs leading-relaxed font-mono"
        style={{
          background: "var(--gen-muted)",
          color: "var(--gen-foreground)",
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {currentCode || "Waiting for code..."}
      </pre>
    </div>
  );
}

export function RenderCanvas() {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");
  const [copied, setCopied] = useState(false);
  const { currentCode, renderMode, isStreaming } = useAppStore();
  const prevStreamingRef = useRef(false);

  // Auto-switch tabs on streaming state transitions
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      // Streaming just started → show code
      setActiveTab("code");
    } else if (!isStreaming && prevStreamingRef.current && currentCode && renderMode) {
      // Streaming just ended with code → show preview
      setActiveTab("preview");
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, currentCode, renderMode]);

  const handleCopy = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportFile = () => {
    if (!currentCode) return;
    const filename = renderMode === "mermaid" ? "diagram.mmd" : "DashboardContent.tsx";
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
            data-testid="tab-preview"
            onClick={() => setActiveTab("preview")}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={
              activeTab === "preview"
                ? { background: "var(--gen-primary)", color: "#fff" }
                : { color: "var(--gen-muted-fg)", opacity: isStreaming ? 0.4 : 1 }
            }
          >
            <Eye size={13} />
            Preview
          </button>
          <button
            data-testid="tab-code"
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
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
              style={{ color: "var(--gen-muted-fg)" }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleExportFile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
              style={{ color: "var(--gen-muted-fg)" }}
              title={renderMode === "mermaid" ? "Export as .mmd file" : "Export as .tsx file"}
            >
              <Download size={13} />
              {renderMode === "mermaid" ? "Export" : "Export .tsx"}
            </button>
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden min-h-0">
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
        ) : isStreaming ? (
          // During streaming: show raw code viewer (no Sandpack → no flicker)
          <StreamingCodeViewer />
        ) : renderMode === "sandpack" ? (
          // After streaming: mount Sandpack with complete code
          <SandpackRenderer showCode={showCode} />
        ) : renderMode === "mermaid" ? (
          <MermaidPreview code={currentCode} showCode={showCode} />
        ) : null}
      </div>
    </div>
  );
}
