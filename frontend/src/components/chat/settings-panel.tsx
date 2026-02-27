"use client";

import { useAppStore, type NavLayout, type IndustryTheme } from "@/store/app-store";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModelSelector } from "@/components/ui/model-selector";
import { ChevronDown, ChevronRight, Settings2, Upload, Download } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { updateProject } from "@/lib/api";
import { themeMap } from "@/lib/themes";
import type { ThemeTokens } from "@/lib/themes";
import { toast } from "sonner";

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

export function SettingsPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    projectId,
    appName,
    logoUrl,
    navLayout,
    theme,
    customTheme,
    model,
    setAppName,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setCustomTheme,
    setModel,
  } = useAppStore();

  const saveToProject = useCallback(
    (data: { name?: string; logo_url?: string; nav_layout?: string; theme?: string }) => {
      if (!projectId) return;
      updateProject(projectId, data).catch(() => {
        toast.error("Failed to save settings");
      });
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId) return;
    const t = setTimeout(() => {
      saveToProject({ name: appName, logo_url: logoUrl });
    }, 500);
    return () => clearTimeout(t);
  }, [projectId, appName, logoUrl, saveToProject]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportTheme = () => {
    const tokens = customTheme ?? themeMap[theme];
    const { label: _l, ...rest } = tokens;
    const json = JSON.stringify({ ...rest, label: _l || theme }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "genview-theme.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Theme exported");
  };

  const handleImportTheme = () => {
    fileInputRef.current?.click();
  };

  const onThemeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ThemeTokens & { label?: string };
        const tokens: ThemeTokens = {
          label: data.label ?? "Custom",
          background: data.background ?? "#f8fafc",
          foreground: data.foreground ?? "#0f172a",
          primary: data.primary ?? "#2563eb",
          primaryForeground: data.primaryForeground ?? "#ffffff",
          secondary: data.secondary ?? "#f1f5f9",
          secondaryForeground: data.secondaryForeground ?? "#334155",
          muted: data.muted ?? "#f1f5f9",
          mutedForeground: data.mutedForeground ?? "#64748b",
          accent: data.accent ?? "#3b82f6",
          accentForeground: data.accentForeground ?? "#ffffff",
          card: data.card ?? "#ffffff",
          cardForeground: data.cardForeground ?? "#0f172a",
          border: data.border ?? "#e2e8f0",
          sidebarBg: data.sidebarBg ?? "#1e293b",
          sidebarForeground: data.sidebarForeground ?? "#e2e8f0",
        };
        setCustomTheme(tokens);
        setTheme("modern-b2b"); // base theme when using custom
        toast.success("Theme imported");
      } catch {
        toast.error("Invalid theme file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ borderBottom: "1px solid var(--gen-border)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
        style={{ color: "var(--gen-foreground)" }}
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
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gen-muted-fg)" }}>
              AI Model
            </label>
            <ModelSelector value={model} onChange={setModel} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gen-muted-fg)" }}>
              App Name
            </label>
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter app name..."
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gen-muted-fg)" }}>
              Logo URL
            </label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gen-muted-fg)" }}>
              Navigation Layout
            </label>
            <Select
              value={navLayout}
              onChange={(e) => {
                const v = e.target.value as NavLayout;
                setNavLayout(v);
                saveToProject({ nav_layout: v });
              }}
              options={navOptions}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gen-muted-fg)" }}>
              Industry Theme
            </label>
            <div className="flex gap-2">
              <Select
                value={customTheme ? "custom" : theme}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") return;
                  setCustomTheme(null);
                  const th = v as IndustryTheme;
                  setTheme(th);
                  saveToProject({ theme: th });
                }}
                options={[
                  ...themeOptions,
                  ...(customTheme ? [{ value: "custom", label: "Custom (imported)" }] : []),
                ]}
              />
              <button
                type="button"
                onClick={handleImportTheme}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors"
                style={{ border: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
                title="Import theme JSON"
              >
                <Upload size={12} />
                Import
              </button>
              <button
                type="button"
                onClick={handleExportTheme}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors"
                style={{ border: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
                title="Export theme JSON"
              >
                <Download size={12} />
                Export
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={onThemeFileChange}
            />
            {customTheme && (
              <button
                type="button"
                onClick={() => setCustomTheme(null)}
                className="mt-1 text-xs underline"
                style={{ color: "var(--gen-muted-fg)" }}
              >
                Clear custom theme
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
