"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { SandpackRenderer } from "./sandpack-preview";
import { MermaidPreview } from "./mermaid-preview";
import { PythonPreview } from "./python-preview";
import { PreviewErrorBoundary } from "./preview-error-boundary";
import { CodeEditAdvancedModal } from "./code-edit-advanced-modal";
import { createPage } from "@/lib/api";
import { Code2, Eye, Copy, Check, Loader2, Download, Save, Maximize2, Minimize2, Terminal } from "lucide-react";
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

function RenderCanvasInner() {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");
  const [copied, setCopied] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const router = useRouter();
  const projectIdFromRoute = params.projectId as string | undefined;
  const { projectId, conversationId, currentCode, extraFiles, renderMode, isStreaming, invalidatePagesList, conversationMode, navMenuItems, setPendingPromptToSend, setCurrentCode, appName, logoUrl, navLayout, theme, model, activePageId } = useAppStore();
  const QUICK_START_PROMPTS = [
    "创建一个销售数据看板，包含收入图表和 KPI 卡片",
    "画一个微服务系统架构图",
    "生成一个设备监控管理页面",
    "创建一个用户管理后台列表页",
    "画一个订单处理流程图",
  ];
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

  // Don't allow switching to advanced mode during streaming
  const canUseAdvancedEditor = !!renderMode && !isStreaming;

  const handleCopy = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showSaveToPageCollection =
    projectId && currentCode && (renderMode === "sandpack" || renderMode === "mermaid") && !isStreaming;

  const handleSaveToPageCollection = async () => {
    if (!projectId || !currentCode || !saveName.trim()) return;
    setSaving(true);
    try {
      const selectedMenuItem = navMenuItems?.find((item) => item.selected);
      await createPage(projectId, {
        name: saveName.trim(),
        nav_label: renderMode === "sandpack" ? (selectedMenuItem?.label ?? saveName.trim()) : saveName.trim(),
        code_block: currentCode,
        code_language: renderMode === "mermaid" ? "mermaid" : "tsx",
        extra_files: renderMode === "sandpack" && Object.keys(extraFiles).length > 0 ? extraFiles : undefined,
        source_conversation_id: conversationId ?? undefined,
      });
      toast.success("已保存到 Resources", {
        description: "可在侧边栏 Resources 中查看",
        action: projectIdFromRoute
          ? {
              label: "前往系统设计",
              onClick: () => router.replace(`/projects/${projectIdFromRoute}?tab=design`),
            }
          : undefined,
      });
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (showCode && canUseAdvancedEditor) {
          setAdvancedModalOpen(true);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showCode, canUseAdvancedEditor]);

  const codeLanguage = renderMode === "mermaid" ? "mermaid" : renderMode === "python" ? "python" : "tsx";

  return (
    <div className="h-full flex flex-col relative" style={{ background: "var(--gen-background)" }}>
      {/* 高级模式全屏模态 */}
      <CodeEditAdvancedModal
        open={advancedModalOpen}
        onClose={() => setAdvancedModalOpen(false)}
        currentCode={currentCode}
        setCurrentCode={setCurrentCode}
        language={codeLanguage}
        appName={appName}
        logoUrl={logoUrl}
        navLayout={navLayout}
        theme={theme}
        model={model}
        projectId={projectId}
        pageId={activePageId}
      />
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
          {activeTab === "code" && canUseAdvancedEditor && (
            <div
              className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded"
              style={{ background: "var(--gen-muted)", border: "1px solid var(--gen-border)" }}
            >
              <button
                type="button"
                onClick={() => setAdvancedModalOpen(false)}
                className="px-1.5 py-0.5 text-[10px] rounded transition-colors"
                style={{
                  background: !advancedModalOpen ? "var(--gen-primary)" : "transparent",
                  color: !advancedModalOpen ? "#fff" : "var(--gen-muted-fg)",
                }}
              >
                简单
              </button>
              <button
                type="button"
                onClick={() => setAdvancedModalOpen(true)}
                className="px-1.5 py-0.5 text-[10px] rounded transition-colors flex items-center gap-0.5"
                style={{
                  background: advancedModalOpen ? "var(--gen-primary)" : "transparent",
                  color: advancedModalOpen ? "#fff" : "var(--gen-muted-fg)",
                }}
              >
                <Terminal size={10} />
                高级
              </button>
            </div>
          )}
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
                title="Save to Resources"
              >
                <Save size={13} />
                保存到 Resources
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
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--gen-muted)" }}
              >
                <Eye size={28} style={{ color: "var(--gen-muted-fg)" }} />
              </div>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--gen-foreground)" }}>
                No preview yet
              </h3>
              <p className="text-xs max-w-[240px] mb-4" style={{ color: "var(--gen-muted-fg)" }}>
                Start a conversation to generate your dashboard UI or architecture diagram.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              <p className="text-xs font-medium mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                快速开始
              </p>
              {QUICK_START_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setPendingPromptToSend(prompt)}
                  disabled={isStreaming}
                  className="text-left px-3 py-2 text-xs rounded-lg transition-colors border hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "var(--gen-muted)",
                    color: "var(--gen-foreground)",
                    borderColor: "var(--gen-border)",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : isStreaming && conversationMode === "agent" ? (
          // During streaming (Agent mode only): show raw code viewer (no Sandpack → no flicker)
          <StreamingCodeViewer />
        ) : renderMode === "sandpack" ? (
          // After streaming: mount Sandpack with complete code
          <PreviewErrorBoundary>
            <div className="relative h-full">
              <SandpackRenderer
                showCode={showCode}
                useAdvancedEditor={false}
                setCurrentCode={setCurrentCode}
              />
            {showSaveToPageCollection && activeTab === "preview" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-lg transition-opacity hover:opacity-90"
                  style={{ background: "var(--gen-primary)", color: "#fff" }}
                >
                  <Save size={16} />
                  保存到 Resources
                </button>
              </div>
            )}
            </div>
          </PreviewErrorBoundary>
        ) : renderMode === "mermaid" ? (
          <PreviewErrorBoundary>
            <div className="relative h-full">
            <MermaidPreview code={currentCode} showCode={showCode} />
            {showSaveToPageCollection && activeTab === "preview" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-lg transition-opacity hover:opacity-90"
                  style={{ background: "var(--gen-primary)", color: "#fff" }}
                >
                  <Save size={16} />
                  保存到 Resources
                </button>
              </div>
            )}
            </div>
          </PreviewErrorBoundary>
        ) : renderMode === "python" ? (
          <PreviewErrorBoundary>
            <PythonPreview code={currentCode} showCode={showCode} />
          </PreviewErrorBoundary>
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
              保存到 Resources
            </h3>
            <input
              className="w-full px-3 py-2 text-sm rounded border mb-4"
              style={{
                background: "var(--gen-muted)",
                color: "var(--gen-foreground)",
                borderColor: "var(--gen-border)",
              }}
              placeholder="页面名称"
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

export function RenderCanvas() {
  return <RenderCanvasInner />;
}
