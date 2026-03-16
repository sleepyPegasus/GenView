"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { parseResponse, extractLatestCodeBlock, extractFromIncompleteContent } from "@/lib/code-parser";
import { getChatUrl } from "@/lib/chat-api";
import { toast } from "sonner";
import { AIModifyDiffPreview } from "./ai-modify-diff-preview";

interface AIModifyInlinePopoverProps {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  onReplace: (newText: string) => void;
  /** Language for code block extraction */
  language: "tsx" | "mermaid" | "python";
  /** Store values for API */
  appName: string;
  logoUrl: string;
  navLayout: string;
  theme: string;
  model: string;
  currentCode: string;
  projectId: string | null;
  conversationId: string | null;
}

type ViewState = "input" | "diff";

export function AIModifyInlinePopover({
  open,
  onClose,
  selectedText,
  onReplace,
  language,
  appName,
  logoUrl,
  navLayout,
  theme,
  model,
  currentCode,
  projectId,
  conversationId,
}: AIModifyInlinePopoverProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>("input");
  const [pendingNewCode, setPendingNewCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInstruction("");
      setError(null);
      setViewState("input");
      setPendingNewCode(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleApplyFromDiff = useCallback(() => {
    if (pendingNewCode) {
      onReplace(pendingNewCode);
      onClose();
      toast.success("已应用 AI 修改");
    }
  }, [pendingNewCode, onReplace, onClose]);

  const handleCancelFromDiff = useCallback(() => {
    setViewState("input");
    setPendingNewCode(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = instruction.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    try {
      const chatUrl = getChatUrl();
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ type: "text", text: trimmed }] }],
          app_name: appName,
          logo_url: logoUrl,
          nav_layout: navLayout,
          theme,
          model,
          conversation_mode: "agent",
          current_code: currentCode,
          conversation_id: conversationId ?? undefined,
          project_id: projectId ?? undefined,
          modify_selection: selectedText,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "content" && typeof data.text === "string") {
                fullContent += data.text;
              }
            } catch {
              /* ignore */
            }
            eventType = "";
          }
        }
      }

      const parsed = parseResponse(fullContent);
      let block = parsed.codeBlocks.find((b) => b.language === language) ?? parsed.codeBlocks[0];
      if (!block?.code) {
        const extracted = extractLatestCodeBlock(fullContent, language) ?? extractFromIncompleteContent(fullContent, language);
        if (extracted) block = { language, code: extracted };
      }
      if (block?.code) {
        setPendingNewCode(block.code);
        setViewState("diff");
      } else {
        const snippet = fullContent.trim().slice(0, 150).replace(/\n/g, " ");
        setError(snippet ? `未解析到有效代码块。返回内容摘要: ${snippet}${fullContent.length > 150 ? "…" : ""}` : "未解析到有效代码块");
        toast.error("未解析到有效代码块", { description: snippet || undefined });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setError(msg);
      toast.error("AI 修改失败", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [
    instruction,
    loading,
    selectedText,
    currentCode,
    appName,
    logoUrl,
    navLayout,
    theme,
    model,
    projectId,
    conversationId,
    language,
    onReplace,
    onClose,
  ]);

  if (!open) return null;

  if (viewState === "diff" && pendingNewCode) {
    return (
      <div className="absolute z-50">
        <AIModifyDiffPreview
          original={selectedText}
          modified={pendingNewCode}
          onApply={handleApplyFromDiff}
          onCancel={handleCancelFromDiff}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 rounded-lg shadow-lg border overflow-hidden"
      style={{
        background: "var(--gen-background)",
        borderColor: "var(--gen-border)",
        minWidth: 320,
        maxWidth: 480,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs"
        style={{ background: "var(--gen-muted)", borderBottom: "1px solid var(--gen-border)" }}
      >
        <Sparkles size={14} style={{ color: "var(--gen-primary)" }} />
        <span style={{ color: "var(--gen-foreground)", fontWeight: 500 }}>AI 修改选中代码</span>
      </div>
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="输入修改指令，如：添加注释、重命名变量..."
          disabled={loading}
          className="w-full px-3 py-2 text-sm rounded border outline-none focus:ring-2"
          style={{
            background: "var(--gen-muted)",
            color: "var(--gen-foreground)",
            borderColor: "var(--gen-border)",
          }}
        />
        {error && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--gen-destructive, #ef4444)" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded"
            style={{ color: "var(--gen-muted-fg)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !instruction.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium disabled:opacity-50"
            style={{
              background: "var(--gen-primary)",
              color: "#fff",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                生成中...
              </>
            ) : (
              "生成"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
