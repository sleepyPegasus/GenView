"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { MonacoCodeEditor } from "./monaco-code-editor";
import { AICodeModifyPanel } from "./ai-code-modify-panel";
import { MonacoEditorApiProvider, useMonacoEditorApi } from "@/contexts/monaco-editor-api-context";

/** 计算 scope_key：有 pageId 用 pageId，否则用代码 hash */
function useScopeKey(pageId: string | null, currentCode: string): string {
  const [scopeKey, setScopeKey] = useState("");
  useEffect(() => {
    if (pageId) {
      setScopeKey(pageId);
      return;
    }
    if (!currentCode) {
      setScopeKey("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(currentCode));
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (!cancelled) setScopeKey(`hash_${hex.slice(0, 16)}`);
      } catch {
        if (!cancelled) setScopeKey(`hash_${currentCode.length}_${Date.now().toString(36)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, currentCode]);
  return scopeKey;
}

interface CodeEditAdvancedModalProps {
  open: boolean;
  onClose: () => void;
  currentCode: string;
  setCurrentCode: (code: string) => void;
  language: "tsx" | "mermaid" | "python";
  appName: string;
  logoUrl: string;
  navLayout: string;
  theme: string;
  model: string;
  projectId: string | null;
  pageId?: string | null;
}

function CodeEditAdvancedModalInner({
  onClose,
  currentCode,
  setCurrentCode,
  language,
  appName,
  logoUrl,
  navLayout,
  theme,
  model,
  projectId,
  pageId,
}: Omit<CodeEditAdvancedModalProps, "open">) {
  const editorApi = useMonacoEditorApi();
  const scopeKey = useScopeKey(pageId ?? null, currentCode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--gen-background)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--gen-foreground)" }}>
          代码编辑 - 高级模式
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded hover:opacity-80 transition-opacity"
          style={{ color: "var(--gen-muted-fg)" }}
          aria-label="关闭"
        >
          <X size={18} />
        </button>
      </header>

      {/* Main: Left (Code) + Right (AI) with draggable separator */}
      <Group
        id="code-ai-split"
        orientation="horizontal"
        className="flex-1 min-h-0"
        resizeTargetMinimumSize={{ coarse: 24, fine: 8 }}
      >
        <Panel id="code-panel" defaultSize={60} minSize={30}>
          <div className="h-full min-w-0">
            <MonacoCodeEditor
              value={currentCode}
              onChange={setCurrentCode}
              language={language}
              readOnly={false}
            />
          </div>
        </Panel>
        <Separator
          id="code-ai-separator"
          className="w-1 min-w-[4px] flex-shrink-0 cursor-col-resize transition-colors hover:bg-[var(--gen-primary)] relative z-10"
          style={{ background: "var(--gen-border)" }}
        />
        <Panel id="ai-panel" defaultSize={40} minSize={280}>
          <AICodeModifyPanel
            currentCode={currentCode}
            onReplace={setCurrentCode}
            onReplaceSelection={editorApi?.replaceSelection}
            language={language}
            getSelectedText={
              editorApi ? () => editorApi.getSelectedText() : undefined
            }
            appName={appName}
            logoUrl={logoUrl}
            navLayout={navLayout}
            theme={theme}
            model={model}
            projectId={projectId}
            scopeKey={scopeKey}
          />
        </Panel>
      </Group>
    </div>
  );
}

export function CodeEditAdvancedModal({
  open,
  onClose,
  currentCode,
  setCurrentCode,
  language,
  appName,
  logoUrl,
  navLayout,
  theme,
  model,
  projectId,
  pageId,
}: CodeEditAdvancedModalProps) {
  if (!open) return null;

  return (
    <MonacoEditorApiProvider>
      <CodeEditAdvancedModalInner
        onClose={onClose}
        currentCode={currentCode}
        setCurrentCode={setCurrentCode}
        language={language}
        appName={appName}
        logoUrl={logoUrl}
        navLayout={navLayout}
        theme={theme}
        model={model}
        projectId={projectId}
        pageId={pageId}
      />
    </MonacoEditorApiProvider>
  );
}
