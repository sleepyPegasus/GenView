"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useAppStore } from "@/store/app-store";
import {
  parseResponse,
  hasCompleteCodeBlock,
  extractLatestCodeBlock,
} from "@/lib/code-parser";
import { getMessageText } from "@/lib/message-utils";
import { SettingsPanel } from "./settings-panel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2 } from "lucide-react";

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

  const storeRef = useRef({ appName, logoUrl, navLayout, theme, model, currentCode, conversationId });
  storeRef.current = { appName, logoUrl, navLayout, theme, model, currentCode, conversationId };

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: () => ({
          app_name: storeRef.current.appName,
          logo_url: storeRef.current.logoUrl,
          nav_layout: storeRef.current.navLayout,
          theme: storeRef.current.theme,
          model: storeRef.current.model,
          current_code: storeRef.current.currentCode,
          conversation_id: storeRef.current.conversationId,
        }),
      }),
    []
  );

  const { messages, sendMessage, status, stop } = useChat({
    transport,
    onFinish: ({ message }) => {
      const text = getMessageText(message);
      const parsed = parseResponse(text);
      if (parsed.codeBlocks.length > 0) {
        const lastBlock = parsed.codeBlocks[parsed.codeBlocks.length - 1];
        setCurrentCode(lastBlock.code);
        setRenderMode(lastBlock.language === "tsx" ? "sandpack" : "mermaid");
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // During streaming, attempt to parse and preview code
  useEffect(() => {
    if (!isStreaming || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const content = getMessageText(lastMsg);
    if (!content) return;

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

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    const text = inputText;
    setInputText("");
    await sendMessage({ text });
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
          const text = getMessageText(msg);
          const parsed = parseResponse(text);
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "var(--gen-primary)" }}
                >
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                style={
                  msg.role === "user"
                    ? { background: "var(--gen-primary)", color: "#ffffff" }
                    : { background: "var(--gen-muted)", color: "var(--gen-foreground)" }
                }
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
                {!parsed.text && parsed.codeBlocks.length === 0 && text && (
                  <div className="whitespace-pre-wrap">{text}</div>
                )}
              </div>
              {msg.role === "user" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "var(--gen-muted)" }}
                >
                  <User size={14} style={{ color: "var(--gen-foreground)" }} />
                </div>
              )}
            </div>
          );
        })}

        {isStreaming && (
          <div className="flex items-center gap-2" style={{ color: "var(--gen-muted-fg)" }}>
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Generating...</span>
            <button
              onClick={stop}
              className="text-xs underline"
              style={{ color: "var(--gen-muted-fg)" }}
            >
              Stop
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
