"use client";

import { useAppStore } from "@/store/app-store";
import { ChatPanel } from "@/components/chat/chat-panel";
import { RenderCanvas } from "@/components/canvas/render-canvas";

export default function Home() {
  const theme = useAppStore((s) => s.theme);

  return (
    <div data-theme={theme} className="flex h-screen w-screen overflow-hidden">
      {/* Left Panel - Chat */}
      <div
        className="h-full border-r border-[--gen-border] flex-shrink-0"
        style={{ width: "35%" }}
      >
        <ChatPanel />
      </div>

      {/* Right Panel - Canvas */}
      <div className="h-full flex-1 min-w-0">
        <RenderCanvas />
      </div>
    </div>
  );
}
