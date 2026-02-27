"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import {
  parseResponse,
  hasCompleteCodeBlock,
  extractLatestCodeBlock,
} from "@/lib/code-parser";
import { SettingsPanel } from "./settings-panel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Send,
  Bot,
  User,
  Loader2,
  Brain,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Zap,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  steps?: StepInfo[];
  progress?: number;
  tokenCount?: number;
  elapsed?: number;
}

interface StepInfo {
  label: string;
  status: "loading" | "active" | "done";
  timestamp: number;
}

/**
 * Get the chat API URL. Uses NEXT_PUBLIC_BACKEND_URL directly to bypass
 * the Next.js rewrite proxy, which buffers SSE streams and prevents
 * real-time event delivery.
 */
function getChatUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`;
  }
  // Fallback: same-origin through Next.js proxy (may buffer SSE)
  return "/api/chat";
}

export function ChatPanel() {
  const {
    appName,
    logoUrl,
    navLayout,
    theme,
    model,
    currentCode,
    conversationId,
    setCurrentCode,
    setRenderMode,
  } = useAppStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // During streaming, attempt to parse and preview code
  useEffect(() => {
    if (!isStreaming || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant" || !lastMsg.content) return;

    const content = lastMsg.content;

    const tsxCode = extractLatestCodeBlock(content, "tsx");
    if (tsxCode && tsxCode.length > 50) {
      setCurrentCode(tsxCode);
      setRenderMode("sandpack");
      return;
    }

    if (hasCompleteCodeBlock(content)) {
      const mermaidCode = extractLatestCodeBlock(content, "mermaid");
      if (mermaidCode) {
        setCurrentCode(mermaidCode);
        setRenderMode("mermaid");
      }
    }
  }, [messages, isStreaming, setCurrentCode, setRenderMode]);

  const handleSSEEvent = useCallback(
    (assistantId: string, eventType: string, data: Record<string, unknown>) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const updated = { ...m };
          switch (eventType) {
            case "content":
              updated.content = m.content + (data.text as string);
              break;
            case "thinking":
              updated.thinking = (m.thinking || "") + (data.text as string);
              break;
            case "step": {
              const steps = [...(m.steps || [])];
              // Mark previous active/loading steps as done when new step arrives
              if (steps.length > 0 && data.status !== "done") {
                const last = steps[steps.length - 1];
                if (last.status === "loading" || last.status === "active") {
                  steps[steps.length - 1] = { ...last, status: "done" };
                }
              }
              if (data.status === "done" && steps.length > 0) {
                const idx = steps.findIndex((s) => s.label === data.label);
                if (idx >= 0) {
                  steps[idx] = { ...steps[idx], status: "done" };
                } else {
                  steps.push({ label: data.label as string, status: "done", timestamp: Date.now() });
                }
              } else {
                steps.push({
                  label: data.label as string,
                  status: data.status as StepInfo["status"],
                  timestamp: Date.now(),
                });
              }
              updated.steps = steps;
              break;
            }
            case "progress":
              updated.progress = data.percent as number;
              break;
            case "done":
              updated.progress = 100;
              updated.tokenCount = data.token_count as number;
              updated.elapsed = data.elapsed as number;
              break;
            case "error":
              updated.content = m.content + `\n\n${data.message}`;
              break;
          }
          return updated;
        })
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        thinking: "",
        steps: [],
        progress: 0,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      useAppStore.getState().setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Build messages payload matching the backend ChatRequest schema
        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          parts: [{ type: "text", text: m.content }],
        }));

        // Call backend directly (bypass Next.js proxy which buffers SSE)
        const chatUrl = getChatUrl();

        const res = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            app_name: appName,
            logo_url: logoUrl,
            nav_layout: navLayout,
            theme,
            model,
            current_code: currentCode,
            conversation_id: conversationId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${res.status} - ${errText}` }
                : m
            )
          );
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";
        // eventType must persist across read() chunks — an "event:" line
        // can arrive in one chunk while its "data:" line arrives in the next.
        let eventType = "";

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
                handleSSEEvent(assistantId, eventType, data);
              } catch {
                // ignore parse errors
              }
              eventType = "";
            } else if (line.trim() === "") {
              // Empty line = end of SSE event; do NOT reset eventType here
              // because we already reset it after processing the data line.
            }
          }
        }

        // After stream completes, extract code for canvas
        setMessages((prev) => {
          const last = prev.find((m) => m.id === assistantId);
          if (last?.content) {
            const parsed = parseResponse(last.content);
            if (parsed.codeBlocks.length > 0) {
              const lastBlock = parsed.codeBlocks[parsed.codeBlocks.length - 1];
              setCurrentCode(lastBlock.code);
              setRenderMode(lastBlock.language === "tsx" ? "sandpack" : "mermaid");
            }
          }
          return prev;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped generation
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + "\n\nConnection error" }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        useAppStore.getState().setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, appName, logoUrl, navLayout, theme, model, currentCode, conversationId, setCurrentCode, setRenderMode]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--gen-card)" }}>
      <SettingsPanel />

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Bot size={36} style={{ color: "var(--gen-primary)" }} className="mb-3" />
            <h3 className="text-sm font-medium mb-1" style={{ color: "var(--gen-foreground)" }}>
              GenView AI
            </h3>
            <p className="text-xs max-w-[260px]" style={{ color: "var(--gen-muted-fg)" }}>
              Describe the dashboard, admin panel, or architecture diagram you
              want to build.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex gap-3 justify-end">
                <div
                  className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ background: "var(--gen-primary)", color: "#ffffff" }}
                >
                  {msg.content}
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "var(--gen-muted)" }}
                >
                  <User size={14} style={{ color: "var(--gen-foreground)" }} />
                </div>
              </div>
            );
          }

          // Assistant message
          const parsed = parseResponse(msg.content);
          const hasThinking = msg.thinking && msg.thinking.length > 0;
          const hasSteps = msg.steps && msg.steps.length > 0;
          const isLastAssistant = msg.id === messages[messages.length - 1]?.id;
          const showProgress = isStreaming && isLastAssistant;

          return (
            <div key={msg.id} className="flex gap-3 justify-start">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "var(--gen-primary)" }}
              >
                <Bot size={14} className="text-white" />
              </div>
              <div className="max-w-[85%] space-y-2 min-w-0 flex-1">
                {/* Progress bar */}
                {showProgress && msg.progress !== undefined && msg.progress < 100 && (
                  <ProgressBar progress={msg.progress} />
                )}

                {/* Steps */}
                {hasSteps && <StepsList steps={msg.steps!} />}

                {/* Thinking block */}
                {hasThinking && <ThinkingBlock text={msg.thinking!} />}

                {/* Content */}
                {(parsed.text || parsed.codeBlocks.length > 0) && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}
                  >
                    {parsed.text && (
                      <div className="whitespace-pre-wrap">{parsed.text}</div>
                    )}
                    {parsed.codeBlocks.length > 0 && (
                      <div className="mt-2 text-xs opacity-70 italic">
                        {parsed.codeBlocks.map((b, i) => (
                          <span key={i}>
                            [{b.language.toUpperCase()} code rendered on canvas]
                            {i < parsed.codeBlocks.length - 1 ? " " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state during streaming */}
                {!parsed.text && parsed.codeBlocks.length === 0 && !hasThinking && showProgress && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-sm"
                    style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-xs">Waiting for response...</span>
                    </div>
                  </div>
                )}

                {/* Stats (after completion) */}
                {msg.tokenCount !== undefined && msg.elapsed !== undefined && (
                  <div
                    className="flex items-center gap-3 text-[10px] px-1"
                    style={{ color: "var(--gen-muted-fg)" }}
                  >
                    <span className="flex items-center gap-1">
                      <Zap size={10} />
                      {msg.tokenCount} tokens
                    </span>
                    <span>{msg.elapsed}s</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex items-center gap-2 pl-10" style={{ color: "var(--gen-muted-fg)" }}>
            <button
              onClick={stopGeneration}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                border: "1px solid var(--gen-border)",
                color: "var(--gen-foreground)",
                background: "var(--gen-card)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gen-muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--gen-card)"; }}
            >
              Stop generating
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--gen-border)" }}>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the UI you want to generate..."
            className="min-h-[44px] max-h-[120px] resize-none flex-1"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isStreaming || !inputText.trim()}
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--gen-muted)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: "var(--gen-primary)",
          }}
        />
      </div>
      <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>
        {progress}%
      </span>
    </div>
  );
}

function StepsList({ steps }: { steps: StepInfo[] }) {
  return (
    <div className="space-y-1 px-1">
      {steps.map((step, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-xs"
          style={{ color: step.status === "done" ? "var(--gen-muted-fg)" : "var(--gen-foreground)" }}
        >
          {step.status === "done" ? (
            <CheckCircle2 size={12} style={{ color: "#22c55e" }} className="flex-shrink-0" />
          ) : step.status === "active" ? (
            <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: "var(--gen-primary)" }} />
          ) : (
            <Circle size={12} className="flex-shrink-0 opacity-40" />
          )}
          <span className={step.status === "done" ? "opacity-60" : ""}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200;

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs leading-relaxed"
      style={{
        background: "var(--gen-muted)",
        border: "1px solid var(--gen-border)",
        color: "var(--gen-muted-fg)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 font-medium w-full text-left"
        style={{ color: "var(--gen-foreground)" }}
      >
        <Brain size={12} style={{ color: "var(--gen-primary)" }} />
        <span>Thinking</span>
        {isLong && (
          expanded
            ? <ChevronDown size={12} className="ml-auto" />
            : <ChevronRight size={12} className="ml-auto" />
        )}
      </button>
      <div
        className={`mt-1.5 whitespace-pre-wrap ${isLong && !expanded ? "max-h-[80px] overflow-hidden" : ""}`}
        style={isLong && !expanded ? { maskImage: "linear-gradient(to bottom, black 60%, transparent)" } : {}}
      >
        {text}
      </div>
    </div>
  );
}
