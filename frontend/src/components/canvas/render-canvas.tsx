"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/app-store";
import { SandpackRenderer } from "./sandpack-preview";
import { MermaidPreview } from "./mermaid-preview";
import { PythonPreview } from "./python-preview";
import { createPage } from "@/lib/api";
import { Code2, Eye, Copy, Check, Loader2, Download, Save, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { projectId, conversationId, currentCode, extraFiles, renderMode, isStreaming, invalidatePagesList, conversationMode, navMenuItems } = useAppStore();
  const prevStreamingRef = useRef(false);

  const toggleFullscreen = () => {
    if (!previewRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      previewRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-switch tabs on streaming state transitions (only in Agent mode; Plan keeps current tab)
  useEffect(() => {
    if (conversationMode !== "agent") return;
    if (isStreaming && !prevStreamingRef.current) {
      // Streaming just started → show code
      setActiveTab("code");
    } else if (!isStreaming && prevStreamingRef.current && currentCode && renderMode) {
      // Streaming just ended with code → show preview
      setActiveTab("preview");
    }
    prevStreamingRef.current = isStreaming;
  }, [conversationMode, isStreaming, currentCode, renderMode]);

  const handleCopy = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showSaveToPageCollection =
    projectId && currentCode && renderMode === "sandpack" && !isStreaming;

  const handleSaveToPageCollection = async () => {
    if (!projectId || !currentCode || !saveName.trim()) return;
    setSaving(true);
    try {
      const selectedMenuItem = navMenuItems?.find((item) => item.selected);
      await createPage(projectId, {
        name: saveName.trim(),
        nav_label: selectedMenuItem?.label ?? saveName.trim(),
        code_block: currentCode,
        code_language: "tsx",
        extra_files: Object.keys(extraFiles).length > 0 ? extraFiles : undefined,
        source_conversation_id: conversationId ?? undefined,
      });
      toast.success("Saved to page collection");
      invalidatePagesList();
      setSaveDialogOpen(false);
      setSaveName("");
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportFile = () => {
    if (!currentCode) return;
    const filename =
      renderMode === "mermaid" ? "diagram.mmd" : renderMode === "python" ? "script.py" : "DashboardContent.tsx";
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
          {activeTab === "preview" && currentCode && renderMode && !isStreaming && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ml-1"
              style={{ color: "var(--gen-muted-fg)" }}
              title={isFullscreen ? "退出全屏 (Esc)" : "全屏预览"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
        {currentCode && (
          <div className="flex items-center gap-1">
            {showSaveToPageCollection && (
              <button
                onClick={() => setSaveDialogOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
                style={{ color: "var(--gen-muted-fg)" }}
                title="Save to page collection"
              >
                <Save size={13} />
                保存到页面集
              </button>
            )}
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
              title={
                renderMode === "mermaid"
                  ? "Export as .mmd file"
                  : renderMode === "python"
                    ? "Export as .py file"
                    : "Export as .tsx file"
              }
            >
              <Download size={13} />
              {renderMode === "mermaid" ? "Export" : renderMode === "python" ? "Export .py" : "Export .tsx"}
            </button>
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div ref={previewRef} className="flex-1 overflow-hidden min-h-0">
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
        ) : isStreaming && conversationMode === "agent" ? (
          // During streaming (Agent mode only): show raw code viewer (no Sandpack → no flicker)
          <StreamingCodeViewer />
        ) : renderMode === "sandpack" ? (
          // After streaming: mount Sandpack with complete code
          <SandpackRenderer showCode={showCode} />
        ) : renderMode === "mermaid" ? (
          <MermaidPreview code={currentCode} showCode={showCode} />
        ) : renderMode === "python" ? (
          <PythonPreview code={currentCode} showCode={showCode} />
        ) : null}
      </div>

      {/* Save to page collection dialog */}
      {saveDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !saving && setSaveDialogOpen(false)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{ background: "var(--gen-background)", border: "1px solid var(--gen-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: "var(--gen-foreground)" }}>
              保存到页面集
            </h3>
            <input
              className="w-full px-3 py-2 text-sm rounded border mb-4"
              style={{
                background: "var(--gen-muted)",
                color: "var(--gen-foreground)",
                borderColor: "var(--gen-border)",
              }}
              placeholder="Page name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveToPageCollection();
                if (e.key === "Escape") setSaveDialogOpen(false);
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSaveDialogOpen(false)}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "var(--gen-muted-fg)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToPageCollection}
                disabled={saving || !saveName.trim()}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{
                  background: "var(--gen-primary)",
                  color: "#fff",
                  opacity: saving || !saveName.trim() ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
