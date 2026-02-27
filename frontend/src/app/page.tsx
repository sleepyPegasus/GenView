"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ChatPanel } from "@/components/chat/chat-panel";
import { RenderCanvas } from "@/components/canvas/render-canvas";
import { ProjectSidebar } from "@/components/sidebar/project-sidebar";
import { ThemeInjector } from "@/components/theme-injector";
import { MessageSquare, Layout } from "lucide-react";

export default function Home() {
  const theme = useAppStore((s) => s.theme);
  const customTheme = useAppStore((s) => s.customTheme);
  const [mobileView, setMobileView] = useState<"chat" | "canvas">("chat");
  const effectiveTheme = customTheme ? "custom" : theme;

  return (
    <div data-theme={effectiveTheme} className="flex h-screen w-screen overflow-hidden">
      <ThemeInjector />
      <ProjectSidebar />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile tab bar */}
        <div
          className="md:hidden flex gap-1 p-2 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--gen-border)" }}
        >
          <button
            onClick={() => setMobileView("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md ${
              mobileView === "chat" ? "bg-[var(--gen-primary)] text-white" : "text-[var(--gen-muted-fg)]"
            }`}
          >
            <MessageSquare size={14} />
            Chat
          </button>
          <button
            onClick={() => setMobileView("canvas")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md ${
              mobileView === "canvas" ? "bg-[var(--gen-primary)] text-white" : "text-[var(--gen-muted-fg)]"
            }`}
          >
            <Layout size={14} />
            Canvas
          </button>
        </div>

        {/* Desktop: resizable panels */}
        <Group
          id="main-split"
          orientation="horizontal"
          className="flex-1 hidden md:flex min-h-0 min-w-0 w-full"
          resizeTargetMinimumSize={{ coarse: 24, fine: 8 }}
        >
          <Panel id="chat-panel" defaultSize="45" minSize="30" maxSize="60">
            <div className="h-full min-w-0 overflow-hidden" style={{ borderRight: "1px solid var(--gen-border)" }}>
              <ChatPanel />
            </div>
          </Panel>
          <Separator
            id="main-separator"
            className="w-1 min-w-[4px] flex-shrink-0 cursor-col-resize transition-colors hover:bg-[var(--gen-primary)] relative z-10"
            style={{ background: "var(--gen-border)" }}
          />
          <Panel id="canvas-panel" defaultSize="55" minSize="40">
            <div className="h-full min-w-0">
              <RenderCanvas />
            </div>
          </Panel>
        </Group>

        {/* Mobile: single view, both mounted for state preservation */}
        <div className="flex-1 flex min-h-0 md:hidden">
          <div className={`h-full w-full ${mobileView === "chat" ? "block" : "hidden"}`}>
            <ChatPanel />
          </div>
          <div className={`h-full w-full ${mobileView === "canvas" ? "block" : "hidden"}`}>
            <RenderCanvas />
          </div>
        </div>
      </div>
    </div>
  );
}
