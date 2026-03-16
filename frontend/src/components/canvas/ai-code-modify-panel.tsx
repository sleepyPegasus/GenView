"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Sparkles, Send, User, Bot, Code2, X, CheckCircle2, Circle } from "lucide-react";
import { parseResponse, extractLatestCodeBlock, extractFromIncompleteContent } from "@/lib/code-parser";
import { getChatUrl } from "@/lib/chat-api";
import { getAiModifyHistory } from "@/lib/api";
import { toast } from "sonner";
import { AIModifyDiffPreview } from "./ai-modify-diff-preview";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 用户消息引用的选中代码片段 */
  referencedCode?: string;
}

interface StepInfo {
  id: string;
  label: string;
  status: "loading" | "active" | "done";
}

interface AICodeModifyPanelProps {
  currentCode: string;
  onReplace: (newText: string) => void;
  onReplaceSelection?: (newText: string) => void;
  language: "tsx" | "mermaid" | "python";
  getSelectedText?: () => string;
  appName: string;
  logoUrl: string;
  navLayout: string;
  theme: string;
  model: string;
  projectId: string | null;
  scopeKey: string;
}

type ViewState = "chat" | "diff";

export function AICodeModifyPanel({
  currentCode,
  onReplace,
  onReplaceSelection,
  language,
  getSelectedText,
  appName,
  logoUrl,
  navLayout,
  theme,
  model,
  projectId,
  scopeKey,
}: AICodeModifyPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>("chat");
  const [pendingNewCode, setPendingNewCode] = useState<string | null>(null);
  const [diffOriginal, setDiffOriginal] = useState<string>("");
  const [wasSelectionMode, setWasSelectionMode] = useState(false);
  const [diffApplied, setDiffApplied] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [thinking, setThinking] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingStartRef = useRef<number | null>(null);
  const [lastThinkingDurationSeconds, setLastThinkingDurationSeconds] = useState<number | null>(null);
  const [polledSelection, setPolledSelection] = useState<string | null>(null);
  const [referenceDismissed, setReferenceDismissed] = useState(false);
  const displayedSelection = referenceDismissed ? null : (polledSelection || null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // 拉取 AI 修改历史（按 scope_key 持久化）
  useEffect(() => {
    if (!projectId || !scopeKey) return;
    let cancelled = false;
    getAiModifyHistory(projectId, scopeKey)
      .then((history) => {
        if (cancelled) return;
        const msgs: ChatMessage[] = history.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          referencedCode: m.referenced_code ?? undefined,
        }));
        setMessages(msgs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, scopeKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = getSelectedText?.();
      const trimmed = t?.trim() || null;
      setPolledSelection(trimmed);
      if (!trimmed) setReferenceDismissed(false);
    }, 400);
    return () => clearInterval(interval);
  }, [getSelectedText]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, steps, thinking, viewState, pendingNewCode]);

  const handleApplyFromDiff = useCallback(() => {
    if (!pendingNewCode) return;
    if (wasSelectionMode && onReplaceSelection) {
      onReplaceSelection(pendingNewCode);
    } else {
      onReplace(pendingNewCode);
    }
    setDiffApplied(true);
    toast.success("已应用 AI 修改");
  }, [pendingNewCode, wasSelectionMode, onReplace, onReplaceSelection]);

  const handleCancelFromDiff = useCallback(() => {
    if (diffApplied) {
      if (wasSelectionMode && onReplaceSelection) {
        onReplaceSelection(diffOriginal);
      } else {
        onReplace(diffOriginal);
      }
      setDiffApplied(false);
    }
  }, [diffApplied, wasSelectionMode, diffOriginal, onReplace, onReplaceSelection]);

  const handleSubmit = useCallback(async () => {
    const trimmed = instruction.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setThinking("");
    setLastThinkingDurationSeconds(null);
    setDiffApplied(false);
    thinkingStartRef.current = Date.now();
    const selectedText = referenceDismissed ? undefined : getSelectedText?.();
    const referencedCode = selectedText?.trim() || undefined;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      referencedCode,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInstruction("");

    const isFullFile = !referencedCode;
    const allMessages = [...messages, userMsg];

    const controller = new AbortController();

    try {
      const chatUrl = getChatUrl();
      const res = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, parts: [{ type: "text", text: m.content }] })),
          app_name: appName,
          logo_url: logoUrl,
          nav_layout: navLayout,
          theme,
          model,
          conversation_mode: "agent",
          current_code: currentCode,
          conversation_id: undefined,
          project_id: projectId ?? undefined,
          scope_key: projectId && scopeKey ? scopeKey : undefined,
          modify_selection: isFullFile ? undefined : userMsg.referencedCode,
          modify_full_file: isFullFile,
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
      const assistantId = `a-${Date.now()}`;
      let streamError: { message: string; code?: string } | null = null;
      // #region agent log
      let contentEventCount = 0;
      let thinkingEventCount = 0;
      const eventTypeCounts: Record<string, number> = {};
      // #endregion

      setSteps([{ id: "s1", label: "连接中...", status: "loading" }]);

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
              // #region agent log
              eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
              if (eventType === "content") contentEventCount++;
              if (eventType === "thinking") thinkingEventCount++;
              // #endregion
              if (eventType === "error") {
                streamError = {
                  message: typeof data.message === "string" ? data.message : "AI 服务返回错误",
                  code: data.code,
                };
                break;
              } else if (eventType === "content" && typeof data.text === "string") {
                fullContent += data.text;
              } else if (eventType === "step" && typeof data.label === "string") {
                setSteps((prev) => {
                  const existing = prev.find((s) => s.label === data.label);
                  if (existing) {
                    return prev.map((s) => (s.label === data.label ? { ...s, status: (data.status as "loading" | "active" | "done") ?? "active" } : s));
                  }
                  return [...prev.map((s) => ({ ...s, status: "done" as const })), { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, label: data.label, status: (data.status as "loading" | "active" | "done") ?? "active" }];
                });
              } else if (eventType === "thinking" && typeof data.text === "string") {
                setThinking((t) => t + data.text);
              }
            } catch {
              /* ignore */
            }
            eventType = "";
          }
        }
        if (streamError) break;
      }

      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      const thinkingEnd = Date.now();
      const durationSec = thinkingStartRef.current ? (thinkingEnd - thinkingStartRef.current) / 1000 : 0;
      setThinking("");

      // #region agent log
      fetch('http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c3078'},body:JSON.stringify({sessionId:'1c3078',location:'ai-code-modify-panel.tsx:parse-before',message:'Before parse',data:{fullContentLen:fullContent.length,contentEventCount,thinkingEventCount,eventTypeCounts,fullContentPreview:fullContent.slice(0,300),hasTripleBacktick:fullContent.includes('```')},hypothesisId:'H1,H2,H3,H5',timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (streamError) {
        // #region agent log
        fetch('http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c3078'},body:JSON.stringify({sessionId:'1c3078',location:'ai-code-modify-panel.tsx:stream-error',message:'Stream error from backend',data:streamError,hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setError(streamError.message);
        setSteps([]);
        toast.error(streamError.message, { description: streamError.code });
        return;
      }

      const parsed = parseResponse(fullContent);
      let block = parsed.codeBlocks.find((b) => b.language === language) ?? parsed.codeBlocks[0];
      if (!block?.code) {
        const extracted = extractLatestCodeBlock(fullContent, language) ?? extractFromIncompleteContent(fullContent, language);
        if (extracted) block = { language, code: extracted };
      }
      // #region agent log
      fetch('http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c3078'},body:JSON.stringify({sessionId:'1c3078',location:'ai-code-modify-panel.tsx:parse-after',message:'After parse',data:{codeBlocksCount:parsed.codeBlocks.length,blockCodeLen:block?.code?.length??0,parseSuccess:!!block?.code},hypothesisId:'H2,H3',timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (block?.code) {
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: fullContent }]);
        const sel = (getSelectedText?.() || "").trim();
        const orig = sel || currentCode;
        setDiffOriginal(orig);
        setWasSelectionMode(!!sel);
        setPendingNewCode(block.code);
        setViewState("diff");
        setLastThinkingDurationSeconds(Math.round(durationSec * 10) / 10);
      } else {
        const snippet = fullContent.trim().slice(0, 150).replace(/\n/g, " ");
        const errMsg = snippet ? `未解析到有效代码块。返回内容摘要: ${snippet}${fullContent.length > 150 ? "…" : ""}` : "未解析到有效代码块";
        setError(errMsg);
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: fullContent || "(无有效代码块)" }]);
        toast.error("未解析到有效代码块", { description: snippet || undefined });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setError(msg);
      setSteps([]);
      toast.error("AI 修改失败", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [
    instruction,
    loading,
    messages,
    getSelectedText,
    referenceDismissed,
    currentCode,
    appName,
    logoUrl,
    navLayout,
    theme,
    model,
    language,
    onReplace,
    projectId,
    scopeKey,
  ]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs flex-shrink-0"
        style={{ background: "var(--gen-muted)", borderBottom: "1px solid var(--gen-border)" }}
      >
        <Sparkles size={14} style={{ color: "var(--gen-primary)" }} />
        <span style={{ color: "var(--gen-foreground)", fontWeight: 500 }}>AI 对话式编程修改</span>
      </div>

      {/* Content area: scrollable */}
      <div ref={contentRef} className="flex-1 overflow-auto min-h-0 p-3">
        <>
          {/* Conversation history */}
          {messages.map((m, idx) => (
              <div key={m.id}>
                {idx > 0 && messages[idx - 1].role === "assistant" && (
                  <div
                    className="my-4 h-0.5 flex-shrink-0 rounded-full"
                    style={{ background: "var(--gen-primary)", opacity: 0.6 }}
                  />
                )}
                <div
                  className="mb-3 flex gap-2"
                  style={{ color: "var(--gen-foreground)" }}
                >
                <div className="flex-shrink-0 mt-0.5">
                  {m.role === "user" ? <User size={12} style={{ color: "var(--gen-muted-fg)" }} /> : <Bot size={12} style={{ color: "var(--gen-primary)" }} />}
                </div>
                <div className="flex-1 min-w-0 text-xs space-y-1">
                  {m.role === "user" && m.referencedCode && (
                    <div
                      className="rounded px-2 py-1.5 text-[11px] font-mono overflow-hidden"
                      style={{ background: "var(--gen-muted)", border: "1px solid var(--gen-border)" }}
                    >
                      <div className="flex items-center gap-1 mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                        <Code2 size={10} />
                        引用代码
                      </div>
                      <pre className="whitespace-pre-wrap break-words m-0 max-h-24 overflow-y-auto">{m.referencedCode.slice(0, 600)}{m.referencedCode.length > 600 ? "..." : ""}</pre>
                    </div>
                  )}
                  <div
                    className="rounded px-2 py-1.5"
                    style={{
                      background: m.role === "user" ? "var(--gen-muted)" : "transparent",
                      border: m.role === "assistant" ? "1px solid var(--gen-border)" : "none",
                    }}
                  >
                    {m.content.slice(0, 500)}
                    {m.content.length > 500 && "..."}
                  </div>
                </div>
              </div>
            </div>
            ))}
            {/* Steps / AI thinking / Diff - 与 assistant 消息对齐 */}
            {(pendingNewCode && lastThinkingDurationSeconds != null) || steps.length > 0 || (viewState === "diff" && pendingNewCode) ? (
              <div className="mb-3 flex gap-2" style={{ color: "var(--gen-foreground)" }}>
                <div className="flex-shrink-0 mt-0.5">
                  <Bot size={12} style={{ color: "var(--gen-primary)" }} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {pendingNewCode && lastThinkingDurationSeconds != null && (
                    <div className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                      AI thinking for {lastThinkingDurationSeconds} seconds...
                    </div>
                  )}
                  {steps.length > 0 && !pendingNewCode && (
                    <div className="space-y-1">
                      {steps.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 text-xs"
                          style={{ color: s.status === "done" ? "var(--gen-muted-fg)" : "var(--gen-foreground)" }}
                        >
                          {s.status === "done" ? (
                            <CheckCircle2 size={12} style={{ color: "#22c55e" }} className="flex-shrink-0" />
                          ) : s.status === "active" ? (
                            <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "var(--gen-primary)" }} />
                          ) : (
                            <Circle size={12} className="flex-shrink-0 opacity-40" />
                          )}
                          <span className={s.status === "done" ? "opacity-60" : ""}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {viewState === "diff" && pendingNewCode && (
                    <AIModifyDiffPreview
                      original={diffOriginal}
                      modified={pendingNewCode}
                      onApply={handleApplyFromDiff}
                      onCancel={handleCancelFromDiff}
                      applied={diffApplied}
                    />
                  )}
                </div>
              </div>
            ) : null}
            {/* Thinking */}
            {thinking && (
              <div className="mb-3 flex gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <Bot size={12} style={{ color: "var(--gen-primary)" }} />
                </div>
                <div className="flex-1 min-w-0 text-xs rounded p-2" style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}>
                  <div className="font-medium mb-1">思考中...</div>
                  <pre className="whitespace-pre-wrap break-words m-0 text-[11px]">{thinking.slice(-800)}</pre>
                </div>
              </div>
            )}
            {messages.length === 0 && !loading && (
              <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                输入修改指令，AI 将分析当前文件并修改。无需选中代码。
              </p>
            )}
        </>
      </div>

      {/* Input area: fixed at bottom */}
      <div
        className="flex-shrink-0 p-3 flex flex-col gap-2"
        style={{ borderTop: "1px solid var(--gen-border)" }}
      >
        {displayedSelection && (
          <div
            className="rounded px-2 py-1.5 text-[11px] font-mono overflow-hidden flex items-start gap-2"
            style={{ background: "var(--gen-muted)", border: "1px solid var(--gen-primary)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1" style={{ color: "var(--gen-primary)" }}>
                <Code2 size={10} />
                引用选中代码
              </div>
              <pre className="whitespace-pre-wrap break-words m-0 max-h-20 overflow-y-auto" style={{ color: "var(--gen-foreground)" }}>
                {displayedSelection.length > 400 ? displayedSelection.slice(0, 400) + "..." : displayedSelection}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => setReferenceDismissed(true)}
              className="flex-shrink-0 p-1 rounded hover:opacity-80"
              style={{ color: "var(--gen-muted-fg)" }}
              title="清除引用"
            >
              <X size={12} />
            </button>
          </div>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--gen-destructive, #ef4444)" }}>
            {error}
          </p>
        )}
        <textarea
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="例如：为图表添加 loading 状态、添加错误处理..."
          disabled={loading}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded border outline-none focus:ring-2 resize-none"
          style={{
            background: "var(--gen-muted)",
            color: "var(--gen-foreground)",
            borderColor: "var(--gen-border)",
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !instruction.trim()}
          className="flex items-center justify-center gap-2 w-full py-2 text-sm rounded font-medium disabled:opacity-50"
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
            <>
              <Send size={14} />
              生成修改
            </>
          )}
        </button>
      </div>
    </div>
  );
}
