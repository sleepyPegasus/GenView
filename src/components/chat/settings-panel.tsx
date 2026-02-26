"use client";

import { useAppStore, type NavLayout, type IndustryTheme } from "@/store/app-store";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { useState } from "react";

const navOptions = [
  { value: "top", label: "Top Navigation" },
  { value: "side", label: "Side Navigation" },
];

const themeOptions = [
  { value: "modern-b2b", label: "Modern B2B" },
  { value: "dark-dashboard", label: "Dark Dashboard" },
  { value: "steel-metallurgy", label: "Steel & Metallurgy" },
  { value: "wind-energy", label: "Wind Energy" },
];

const modelOptions = [
  { value: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
  { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3" },
];

export function SettingsPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    appName,
    logoUrl,
    navLayout,
    theme,
    model,
    setAppName,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setModel,
  } = useAppStore();

  return (
    <div className="border-b border-[--gen-border]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[--gen-foreground] hover:bg-[--gen-muted] transition-colors"
      >
        <Settings2 size={16} />
        <span>Global Settings</span>
        {collapsed ? (
          <ChevronRight size={14} className="ml-auto" />
        ) : (
          <ChevronDown size={14} className="ml-auto" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[--gen-muted-fg] mb-1 block">
              AI Model
            </label>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={modelOptions}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[--gen-muted-fg] mb-1 block">
              App Name
            </label>
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter app name..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[--gen-muted-fg] mb-1 block">
              Logo URL
            </label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[--gen-muted-fg] mb-1 block">
              Navigation Layout
            </label>
            <Select
              value={navLayout}
              onChange={(e) => setNavLayout(e.target.value as NavLayout)}
              options={navOptions}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[--gen-muted-fg] mb-1 block">
              Industry Theme
            </label>
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value as IndustryTheme)}
              options={themeOptions}
            />
          </div>
        </div>
      )}
    </div>
  );
}
