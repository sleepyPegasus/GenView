"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import {
  parseResponse,
  hasCompleteCodeBlock,
  extractLatestCodeBlock,
  extractAllTsxBlocks,
} from "@/lib/code-parser";
import { listMessages, ensureProjectAndConversation, updateConversation, updateProject, getConversation, getProject, deleteMessage } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/ui/model-selector";
import { Select } from "@/components/ui/select";
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
  Copy,
  Quote,
  RotateCcw,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as Diff from "diff";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  steps?: StepInfo[];
  progress?: number;
  tokenCount?: number;
  inputTokenCount?: number;
  elapsed?: number;
  isError?: boolean;
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
function getChatErrorInfo(
  code: string,
  fallbackMessage: string
): { title: string; description: string } {
  switch (code) {
    case "rate_limit":
      return { title: "请求过于频繁", description: "请稍后重试" };
    case "invalid_api_key":
      return { title: "API Key 无效", description: "请检查 OpenRouter 设置" };
    case "model_error":
      return { title: "模型返回错误", description: "可尝试切换其他模型" };
    case "connection_error":
      return { title: "连接失败", description: "请检查网络连接" };
    case "timeout":
      return { title: "请求超时", description: "请稍后重试" };
    default:
      return { title: "请求失败", description: fallbackMessage };
  }
}

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
    conversationMode,
    currentCode,
    projectId,
    conversationId,
    setProjectId,
    setConversationId,
    setAppName,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setCustomTheme,
    setModel,
    setConversationMode,
    setNavMenuItems,
    setNavBackgroundColor,
    setAppNameFontSize,
    setAppNameColor,
    invalidateConversationList,
    setCurrentCode,
    setExtraFiles,
    setRenderMode,
    pendingPromptToSend,
    setPendingPromptToSend,
  } = useAppStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipLoadForConvIdRef = useRef<string | null>(null);
  const lastSentTextRef = useRef<string>("");

  const ROUND_SIZE = 6;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setVisibleCount(6);
  }, [conversationId]);

  const visibleMessages =
    messages.length <= ROUND_SIZE || isStreaming
      ? messages
      : messages.slice(-visibleCount);

  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = topSentinelRef.current;
    if (!container || !sentinel || messages.length <= visibleCount || isStreaming) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        scrollRestoreRef.current = { height: container.scrollHeight, top: container.scrollTop };
        setVisibleCount((prev) => Math.min(prev + ROUND_SIZE, messages.length));
      },
      { root: container, rootMargin: "0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [messages.length, visibleCount, isStreaming]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const restore = scrollRestoreRef.current;
    if (!container || !restore) return;
    scrollRestoreRef.current = null;
    const added = container.scrollHeight - restore.height;
    if (added > 0) container.scrollTop = restore.top + added;
  }, [visibleCount]);

  // Load messages when conversation changes (e.g. user switched in sidebar)
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    if (skipLoadForConvIdRef.current === conversationId) {
      skipLoadForConvIdRef.current = null;
      return;
    }
    let cancelled = false;
    const cid = conversationId;
    listMessages(cid).then((msgs) => {
      if (cancelled) return;
      if (useAppStore.getState().conversationId !== cid) return;
      const chatMsgs: ChatMessage[] = msgs.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      setMessages(chatMsgs);
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  // During streaming, attempt to parse and preview code (only in Agent mode)
  useEffect(() => {
    if (conversationMode !== "agent" || !isStreaming || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant" || !lastMsg.content) return;

    const content = lastMsg.content;

    const tsxCode = extractLatestCodeBlock(content, "tsx");
    if (tsxCode && tsxCode.length > 50) {
      const allFiles = extractAllTsxBlocks(content);
      const mainCode = allFiles["/DashboardContent.tsx"] ?? tsxCode;
      setCurrentCode(mainCode);
      const { "/DashboardContent.tsx": _, ...rest } = allFiles;
      setExtraFiles(rest);
      setRenderMode("sandpack");
      return;
    }

    const pythonCode = extractLatestCodeBlock(content, "python");
    if (pythonCode && pythonCode.length > 20) {
      setCurrentCode(pythonCode);
      setExtraFiles({});
      setRenderMode("python");
      return;
    }

    if (hasCompleteCodeBlock(content)) {
      const mermaidCode = extractLatestCodeBlock(content, "mermaid");
      if (mermaidCode) {
        setCurrentCode(mermaidCode);
        setExtraFiles({});
        setRenderMode("mermaid");
      } else if (pythonCode) {
        setCurrentCode(pythonCode);
        setExtraFiles({});
        setRenderMode("python");
      }
    }
  }, [conversationMode, messages, isStreaming, setCurrentCode, setExtraFiles, setRenderMode]);

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
            case "input_tokens":
              updated.inputTokenCount = data.prompt_token_count as number;
              break;
            case "done":
              updated.progress = 100;
              updated.tokenCount = data.token_count as number;
              updated.elapsed = data.elapsed as number;
              // 流结束时，将所有处于 active/loading 的步骤标记为 done，避免 "Generating code..." 一直转圈
              if (updated.steps?.length) {
                updated.steps = updated.steps.map((s) =>
                  s.status === "active" || s.status === "loading"
                    ? { ...s, status: "done" as const }
                    : s
                );
              }
              break;
            case "error": {
              updated.content = m.content + `\n\n${data.message}`;
              const code = (data.code as string) ?? "model_error";
              if (code === "model_error") setModelSelectorOpen(true);
              const { title, description } = getChatErrorInfo(code, String(data.message));
              const textToRetry = lastSentTextRef.current;
              toast.error(title, {
                description,
                action: { label: "重试", onClick: () => sendMessage(textToRetry) },
              });
              break;
            }
          }
          return updated;
        })
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, options?: { messagesOverride?: ChatMessage[] }) => {
      let cid = conversationId;
      const baseMessages = options?.messagesOverride ?? messages;
      if (!cid || !projectId) {
        try {
          const { projectId: pid, conversationId: convId, conversation: conv } = await ensureProjectAndConversation({
            appName,
            logoUrl,
            navLayout,
            theme,
            existingProjectId: projectId,
            existingConversationId: conversationId,
          });
          setProjectId(pid);
          setConversationId(convId);
          cid = convId;
          skipLoadForConvIdRef.current = convId;
          const defaultNavMenuItems = [
            { label: "Dashboard", icon: "LayoutDashboard" },
            { label: "Analytics", icon: "BarChart" },
            { label: "Settings", icon: "Settings" },
          ];
          const applyProjectConfig = (p: import("@/lib/api").Project) => {
            setAppName(p.name ?? "GenView Dashboard");
            setLogoUrl(p.logo_url ?? "");
            setNavLayout((p.nav_layout ?? "side") as "top" | "side");
            setTheme((p.theme ?? "modern-b2b") as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy");
            setCustomTheme((p.custom_theme as unknown as import("@/lib/themes").ThemeTokens) ?? null);
            setModel(p.model ?? "google/gemini-3.1-pro-preview");
            setConversationMode((p.conversation_mode === "plan" ? "plan" : "agent"));
            setNavBackgroundColor(p.nav_background_color ?? null);
            setAppNameFontSize(p.app_name_font_size ?? null);
            setAppNameColor(p.app_name_color ?? null);
            const baseItems = (p.nav_menu_items?.length ? p.nav_menu_items : defaultNavMenuItems).map((it) => {
              const item = it as { label: string; icon?: string; children?: { label: string; icon?: string }[] };
              return {
                label: item.label,
                icon: item.icon ?? undefined,
                ...(item.children ? { children: item.children.map((c) => ({ label: c.label, icon: c.icon ?? undefined })) } : {}),
              };
            });
            setNavMenuItems(baseItems);
          };
          const applyConversationNavMenu = (c: import("@/lib/api").Conversation, p: import("@/lib/api").Project) => {
            const baseItems = (p.nav_menu_items?.length ? p.nav_menu_items : defaultNavMenuItems).map((it) => {
              const item = it as { label: string; icon?: string; children?: { label: string; icon?: string }[] };
              return {
                label: item.label,
                icon: item.icon ?? undefined,
                ...(item.children ? { children: item.children.map((ch) => ({ label: ch.label, icon: ch.icon ?? undefined })) } : {}),
              };
            });
            const convItems = c.nav_menu_items ?? [];
            let selectedIdx = 0;
            let flatIdx = 0;
            outer: for (const it of convItems as { selected?: boolean; children?: { selected?: boolean }[] }[]) {
              if (it.selected) {
                selectedIdx = flatIdx;
                break;
              }
              if (it.children?.length) {
                for (const ch of it.children) {
                  if (ch.selected) {
                    selectedIdx = flatIdx;
                    break outer;
                  }
                  flatIdx++;
                }
              } else {
                flatIdx++;
              }
            }
            let idx = 0;
            const withSelected = baseItems.map((it) => {
              if (it.children?.length) {
                const ch = it.children.map((c) => {
                  const sel = idx === selectedIdx;
                  idx++;
                  return { ...c, selected: sel };
                });
                return { ...it, selected: false, children: ch };
              }
              const sel = idx === selectedIdx;
              idx++;
              return { ...it, selected: sel };
            });
            setNavMenuItems(withSelected);
          };
          (async () => {
            const proj = await getProject(pid);
            applyProjectConfig(proj);
            const c = conv ?? await getConversation(convId);
            applyConversationNavMenu(c, proj);
          })();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error("Failed to create session", { description: msg });
          setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: "user", content: text },
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: `Failed to create session: ${msg}`,
              isError: true,
            },
          ]);
          return;
        }
      }

      lastSentTextRef.current = text;
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

      // First message: use first 7 chars as conversation title
      if (baseMessages.length === 0 && cid) {
        const title = text.slice(0, 7).trim() || "New Conversation";
        updateConversation(cid, { title }).catch(() => {}).finally(() => invalidateConversationList());
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const requestMode = conversationMode;

      try {
        // Build messages payload matching the backend ChatRequest schema
        const allMessages = [...baseMessages, userMsg].map((m) => ({
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
            conversation_mode: conversationMode,
            current_code: currentCode,
            conversation_id: cid,
            project_id: projectId ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          let errorCode = "model_error";
          try {
            const dataMatch = errText.match(/data:\s*(\{[^}]+\})/);
            if (dataMatch) {
              const data = JSON.parse(dataMatch[1]) as { code?: string };
              errorCode = data.code ?? errorCode;
            }
          } catch {
            if (res.status === 401) errorCode = "invalid_api_key";
            else if (res.status === 429) errorCode = "rate_limit";
          }
          if (errorCode === "model_error") setModelSelectorOpen(true);
          const { title, description } = getChatErrorInfo(errorCode, errText.slice(0, 200));
          toast.error(title, {
            description,
            action: {
              label: "重试",
              onClick: () => sendMessage(text),
            },
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${res.status} - ${errText}`, isError: true }
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

        // After stream completes, extract code for canvas (only in Agent mode)
        if (requestMode === "agent") {
          setMessages((prev) => {
            const last = prev.find((m) => m.id === assistantId);
            if (last?.content) {
              const parsed = parseResponse(last.content);
              if (parsed.codeBlocks.length > 0) {
                const lastBlock = parsed.codeBlocks[parsed.codeBlocks.length - 1];
                if (lastBlock.language === "tsx") {
                  const allFiles = extractAllTsxBlocks(last.content);
                  const mainCode = allFiles["/DashboardContent.tsx"] ?? lastBlock.code;
                  setCurrentCode(mainCode);
                  const { "/DashboardContent.tsx": _d, ...rest } = allFiles;
                  setExtraFiles(rest);
                  setRenderMode("sandpack");
                } else if (lastBlock.language === "python") {
                  setCurrentCode(lastBlock.code);
                  setExtraFiles({});
                  setRenderMode("python");
                } else {
                  setCurrentCode(lastBlock.code);
                  setExtraFiles({});
                  setRenderMode("mermaid");
                }
              }
            }
            return prev;
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped generation - 将 active/loading 步骤标记为 done，避免 "AI is reasoning" 一直转圈
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && m.steps?.length
                ? {
                    ...m,
                    steps: m.steps.map((s) =>
                      s.status === "active" || s.status === "loading"
                        ? { ...s, status: "done" as const }
                        : s
                    ),
                  }
                : m
            )
          );
        } else {
          const msg = err instanceof Error ? err.message : "Connection error";
          const code = msg.toLowerCase().includes("timeout") ? "timeout" : "connection_error";
          const { title, description } = getChatErrorInfo(code, msg);
          toast.error(title, {
            description,
            action: {
              label: "重试",
              onClick: () => sendMessage(text),
            },
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + `\n\nConnection error: ${msg}`, isError: true }
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
    [messages, appName, logoUrl, navLayout, theme, model, conversationMode, currentCode, projectId, conversationId, setProjectId, setConversationId, setAppName, setLogoUrl, setNavLayout, setTheme, setCustomTheme, setModel, setConversationMode, setNavMenuItems, setCurrentCode, setExtraFiles, setRenderMode, invalidateConversationList]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Quick-start: when RenderCanvas sets pendingPromptToSend, send it and clear
  useEffect(() => {
    if (pendingPromptToSend && pendingPromptToSend.trim() && !isStreaming) {
      const text = pendingPromptToSend.trim();
      setPendingPromptToSend(null);
      sendMessage(text);
    }
  }, [pendingPromptToSend, isStreaming, setPendingPromptToSend, sendMessage]);

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
    <div className="h-full flex flex-col min-w-0" style={{ background: "var(--gen-card)" }}>
      {/* Chat messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length > visibleCount && !isStreaming && (
          <div ref={topSentinelRef} className="h-1 flex-shrink-0" aria-hidden />
        )}
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

        {visibleMessages.map((msg, msgIdx) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex gap-3 justify-end group">
                <div className="flex flex-col items-end gap-1">
                  <div
                    className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ background: "var(--gen-primary)", color: "#ffffff" }}
                  >
                    {msg.content}
                  </div>
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--gen-muted-fg)" }}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(msg.content);
                        toast.success("已复制");
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="复制"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const quoted = "> " + msg.content.split("\n").join("\n> ") + "\n\n";
                        setInputText((prev) => (prev ? prev + "\n" + quoted : quoted));
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="引用"
                    >
                      <Quote size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!conversationId) return;
                        try {
                          await deleteMessage(conversationId, msg.id);
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                          toast.success("已删除");
                        } catch (err) {
                          const is404 = err instanceof Error && (err.message.includes("404") || err.message.includes("Not Found"));
                          if (is404) {
                            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                            toast.success("已删除");
                          } else {
                            toast.error("删除失败");
                          }
                        }
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
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
            <div key={msg.id} className="flex gap-3 justify-start group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "var(--gen-primary)" }}
              >
                <Bot size={14} className="text-white" />
              </div>
              <div className="max-w-[85%] space-y-2 min-w-0 flex-1">
                {/* Steps */}
                {hasSteps && <StepsList steps={msg.steps!} />}

                {/* Thinking block */}
                {hasThinking && <ThinkingBlock text={msg.thinking!} />}

                {/* Error retry button */}
                {msg.isError && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (isStreaming) return;
                      const idx = messages.findIndex((m) => m.id === msg.id);
                      const prevUser = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");
                      if (!prevUser) {
                        toast.error("无法重试");
                        return;
                      }
                      const filtered = messages.filter((m) => m.id !== msg.id);
                      setMessages(filtered);
                      await sendMessage(prevUser.content, { messagesOverride: filtered });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--gen-primary)", color: "#fff" }}
                  >
                    <RotateCcw size={12} />
                    重试
                  </button>
                )}

                {/* Content */}
                {(parsed.text || parsed.codeBlocks.length > 0) && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: msg.isError ? "rgba(239,68,68,0.1)" : "var(--gen-muted)",
                      color: msg.isError ? "#dc2626" : "var(--gen-foreground)",
                    }}
                  >
                    {parsed.text && (
                      <div
                        className="markdown-content overflow-x-auto [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_strong]:font-semibold [&_a]:underline [&_a]:text-[var(--gen-primary)] [&_pre]:whitespace-pre-wrap [&_pre]:text-xs [&_pre]:p-2 [&_pre]:rounded [&_pre]:bg-black/10 [&_code]:text-xs [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-[var(--gen-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-[var(--gen-muted)] [&_td]:border [&_td]:border-[var(--gen-border)] [&_td]:px-3 [&_td]:py-2 [&_tr:hover]:bg-black/5"
                        style={{ color: "var(--gen-foreground)" }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.text}</ReactMarkdown>
                      </div>
                    )}
                    {parsed.codeBlocks.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {parsed.codeBlocks.map((b, i) => {
                          const prevAssistant = visibleMessages
                            .slice(0, msgIdx)
                            .reverse()
                            .find((m) => m.role === "assistant");
                          const prevTsx = prevAssistant
                            ? parseResponse(prevAssistant.content).codeBlocks.filter((x) => x.language === "tsx")
                            : [];
                          const prevCode =
                            b.language === "tsx" && prevTsx.length > 0
                              ? prevTsx[prevTsx.length - 1]?.code ?? ""
                              : "";
                          const showDiff = b.language === "tsx" && prevCode && prevCode !== b.code;
                          const diffLines = showDiff
                            ? Diff.diffLines(prevCode, b.code)
                            : [{ value: b.code, added: false, removed: false }];
                          return (
                            <div
                              key={i}
                              className="relative group rounded-lg overflow-hidden"
                              style={{ background: "var(--gen-background)" }}
                            >
                              <div className="flex items-center justify-between px-2 py-1 text-xs opacity-70">
                                <span>{b.language.toUpperCase()}{showDiff ? " (变更高亮)" : ""}</span>
                                <button
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(b.code);
                                    toast.success("Code copied");
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                                  style={{ color: "var(--gen-muted-fg)" }}
                                  title="Copy code"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                              <pre className="p-2 text-xs overflow-x-auto max-h-32 overflow-y-auto font-mono">
                                {showDiff
                                  ? diffLines.map((part, pi) =>
                                      part.added ? (
                                        <span key={pi} className="block bg-green-500/20 text-green-700 dark:text-green-400">
                                          {part.value.split("\n").map((line, li) => (line ? <span key={li}>+ {line}{"\n"}</span> : null))}
                                        </span>
                                      ) : part.removed ? (
                                        <span key={pi} className="block bg-red-500/20 text-red-600 dark:text-red-400 line-through opacity-80">
                                          {part.value.split("\n").map((line, li) => (line ? <span key={li}>- {line}{"\n"}</span> : null))}
                                        </span>
                                      ) : (
                                        <span key={pi}>{part.value}</span>
                                      )
                                    )
                                  : b.code.slice(0, 500)}
                                {b.code.length > 500 && !showDiff ? "..." : ""}
                              </pre>
                              <span className="text-[10px] opacity-60 italic px-2 pb-1 block">
                                [Rendered on canvas]
                              </span>
                            </div>
                          );
                        })}
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
                      <span className="text-xs">等待回复...</span>
                    </div>
                  </div>
                )}

                {/* Stats (input tokens shown early, output + elapsed after completion) */}
                {(msg.inputTokenCount !== undefined || msg.tokenCount !== undefined) && (
                  <div
                    className="flex items-center gap-3 text-[10px] px-1"
                    style={{ color: "var(--gen-muted-fg)" }}
                  >
                    {msg.inputTokenCount !== undefined && (
                      <span>输入 {msg.inputTokenCount} tokens</span>
                    )}
                    {msg.tokenCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <Zap size={10} />
                        输出 {msg.tokenCount} tokens
                      </span>
                    )}
                    {msg.elapsed !== undefined && <span>{msg.elapsed}s</span>}
                  </div>
                )}

                {/* Message actions */}
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--gen-muted-fg)" }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(msg.content);
                      toast.success("已复制");
                    }}
                    className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                    title="复制"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const quoted = "> " + msg.content.split("\n").join("\n> ") + "\n\n";
                      setInputText((prev) => (prev ? prev + "\n" + quoted : quoted));
                    }}
                    className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                    title="引用"
                  >
                    <Quote size={12} />
                  </button>
                  {parsed.codeBlocks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const blocks = parsed.codeBlocks;
                        const lastTsx = blocks.filter((b) => b.language === "tsx");
                        const lastMermaid = blocks.filter((b) => b.language === "mermaid");
                        const lastPython = blocks.filter((b) => b.language === "python");
                        if (lastTsx.length > 0) {
                          const allFiles = extractAllTsxBlocks(msg.content);
                          const mainCode = allFiles["/DashboardContent.tsx"] ?? lastTsx[lastTsx.length - 1]!.code;
                          setCurrentCode(mainCode);
                          const { "/DashboardContent.tsx": _d, ...rest } = allFiles;
                          setExtraFiles(rest);
                          setRenderMode("sandpack");
                          toast.success("已恢复到此版本");
                        } else if (lastMermaid.length > 0) {
                          setCurrentCode(lastMermaid[lastMermaid.length - 1]!.code);
                          setExtraFiles({});
                          setRenderMode("mermaid");
                          toast.success("已恢复到此版本");
                        } else if (lastPython.length > 0) {
                          setCurrentCode(lastPython[lastPython.length - 1]!.code);
                          setExtraFiles({});
                          setRenderMode("python");
                          toast.success("已恢复到此版本");
                        }
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="恢复到此版本"
                    >
                      <History size={12} />
                    </button>
                  )}
                  {!showProgress && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!conversationId || isStreaming) return;
                        const idx = messages.findIndex((m) => m.id === msg.id);
                        const prevUser = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");
                        if (!prevUser) {
                          toast.error("无法重新生成");
                          return;
                        }
                        try {
                          await deleteMessage(conversationId, msg.id);
                          const filtered = messages.filter((m) => m.id !== msg.id);
                          setMessages(filtered);
                          await sendMessage(prevUser.content, { messagesOverride: filtered });
                        } catch (err) {
                          const is404 = err instanceof Error && (err.message.includes("404") || err.message.includes("Not Found"));
                          if (is404) {
                            const filtered = messages.filter((m) => m.id !== msg.id);
                            setMessages(filtered);
                            await sendMessage(prevUser.content, { messagesOverride: filtered });
                          } else {
                            toast.error(err instanceof Error ? err.message : "重新生成失败");
                          }
                        }
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="重新生成"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                  {!showProgress && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!conversationId) return;
                        try {
                          await deleteMessage(conversationId, msg.id);
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                          toast.success("已删除");
                        } catch (err) {
                          const is404 = err instanceof Error && (err.message.includes("404") || err.message.includes("Not Found"));
                          if (is404) {
                            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                            toast.success("已删除");
                          } else {
                            toast.error("删除失败");
                          }
                        }
                      }}
                      className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex flex-col gap-2 pl-10" style={{ color: "var(--gen-muted-fg)" }}>
            {(() => {
              const lastMsg = messages[messages.length - 1];
              const progress = lastMsg?.role === "assistant" ? (lastMsg?.progress ?? 0) : 0;
              return progress < 100 ? <ProgressBar progress={progress} /> : null;
            })()}
            <button
              onClick={stopGeneration}
              className="text-xs px-2.5 py-1 rounded-md transition-colors self-start"
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

      {/* Input area - Cursor style: input on top, Mode + Model below left */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid var(--gen-border)" }}>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Textarea
              data-testid="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                conversationMode === "plan"
                  ? "与 AI 对话、头脑风暴、激发灵感..."
                  : "Describe the UI you want to generate..."
              }
              className="min-h-[88px] max-h-[240px] resize-none flex-1"
              rows={2}
            />
            <Button
              data-testid="chat-send"
              type="submit"
              size="icon"
              disabled={isStreaming || !inputText.trim()}
            >
              <Send size={16} />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select
                options={[
                  { value: "plan", label: "Plan" },
                  { value: "agent", label: "Agent" },
                ]}
                value={conversationMode}
                onChange={(e) => {
                  const v = e.target.value as "plan" | "agent";
                  setConversationMode(v);
                  if (projectId) updateProject(projectId, { conversation_mode: v }).catch(() => {});
                }}
                className="h-8 w-[90px] text-xs"
              />
              <div className="w-[160px]">
                <ModelSelector
                  value={model}
                  onChange={(v) => {
                    setModel(v);
                    if (projectId) updateProject(projectId, { model: v }).catch(() => {});
                  }}
                  open={modelSelectorOpen}
                  onOpenChange={setModelSelectorOpen}
                />
              </div>
            </div>
          </div>
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
