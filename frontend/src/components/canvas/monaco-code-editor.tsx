"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center" style={{ background: "var(--gen-muted)" }}>
      <LoadingSpinner size={24} label="加载编辑器中..." />
    </div>
  ),
});

export type MonacoLanguage = "tsx" | "mermaid" | "python";

function toMonacoLanguage(lang: MonacoLanguage): string {
  if (lang === "tsx") return "typescript";
  if (lang === "python") return "python";
  return "plaintext";
}

interface MonacoCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: MonacoLanguage;
  readOnly?: boolean;
}

interface MonacoEditorInstance {
  getModel: () => { getValue: () => string; setValue: (v: string) => void } | null;
}

/**
 * Monaco-based code editor for advanced editing mode.
 * Supports bidirectional sync: edits flow to onChange; external value updates
 * are applied only when not actively editing to avoid overwriting user input.
 */
export function MonacoCodeEditor({ value, onChange, language, readOnly = false }: MonacoCodeEditorProps) {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const isUserEditingRef = useRef(false);
  const lastExternalValueRef = useRef(value);

  const editTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorMount = useCallback((_monaco: unknown, editor: MonacoEditorInstance) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (newValue !== undefined) {
        isUserEditingRef.current = true;
        if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
        editTimeoutRef.current = setTimeout(() => {
          isUserEditingRef.current = false;
          editTimeoutRef.current = null;
        }, 500);
        onChange(newValue);
      }
    },
    [onChange]
  );

  useEffect(() => {
    return () => {
      if (editTimeoutRef.current) clearTimeout(editTimeoutRef.current);
    };
  }, []);

  // Sync external value into editor when it changes (e.g. AI generated, history restore).
  // Only apply when editor content matches lastExternalValueRef (no user edits since last apply).
  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastExternalValueRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const current = model.getValue();
    // If editor content differs from last applied external value, user has edited - don't overwrite
    if (current !== lastExternalValueRef.current) return;
    if (isUserEditingRef.current) return;
    lastExternalValueRef.current = value;
    model.setValue(value);
  }, [value]);

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      language={toMonacoLanguage(language)}
      value={value}
      onChange={handleChange}
      onMount={handleEditorMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        wordWrap: "on",
        readOnly,
        tabSize: 2,
        scrollBeyondLastLine: false,
        padding: { top: 12 },
      }}
      loading={
        <div className="flex h-full items-center justify-center" style={{ background: "var(--gen-muted)" }}>
          <LoadingSpinner size={24} label="加载编辑器中..." />
        </div>
      }
    />
  );
}
