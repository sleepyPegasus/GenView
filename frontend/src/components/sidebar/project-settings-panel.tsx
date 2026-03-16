"use client";

import { useAppStore, type NavLayout, type IndustryTheme } from "@/store/app-store";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Upload, Download, Save, Plus, Trash2, Eye, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { IconPicker } from "@/components/ui/icon-picker";
import { useState, useRef, useCallback, useEffect } from "react";
import { updateProject, type NavMenuItem } from "@/lib/api";
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

type IconComp = React.ComponentType<{ size?: number }>;
function getIconComp(name: string): IconComp | null {
  return (LucideIcons as unknown as Record<string, IconComp>)[name] ?? null;
}

export function ProjectSettingsPanel() {
  const [navPreviewOpen, setNavPreviewOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const {
    projectId,
    appName,
    appNameFontSize,
    appNameColor,
    logoUrl,
    navLayout,
    theme,
    customTheme,
    model,
    kgModel,
    conversationMode,
    navBackgroundColor,
    navMenuItems,
    setNavMenuItems,
    setAppName,
    setAppNameFontSize,
    setAppNameColor,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setCustomTheme,
    setModel,
    setKgModel,
    setConversationMode,
    setNavBackgroundColor,
  } = useAppStore();

  const normalizeForSave = useCallback((items: NavMenuItem[]) => {
    return items.map(({ label, icon, children }) => ({
      label,
      icon: icon ?? undefined,
      ...(children?.length ? { children: children.map(({ label: l, icon: ic }) => ({ label: l, icon: ic ?? undefined })) } : {}),
    }));
  }, []);

  const saveToProject = useCallback(
    (data: Parameters<typeof updateProject>[1]) => {
      if (!projectId) return;
      const payload = { ...data };
      if (payload.nav_menu_items) {
        payload.nav_menu_items = normalizeForSave(payload.nav_menu_items);
      }
      updateProject(projectId, payload).catch(() => {
        toast.error("Failed to save project settings");
      });
    },
    [projectId, normalizeForSave]
  );

  const handleSaveAll = useCallback(() => {
    if (!projectId) {
      toast.error("请先选择项目");
      return;
    }
    updateProject(projectId, {
      name: appName,
      logo_url: logoUrl,
      nav_layout: navLayout,
      theme,
      custom_theme: (customTheme ?? undefined) as Record<string, unknown> | undefined,
      model,
      kg_model: kgModel ?? undefined,
      conversation_mode: conversationMode,
      nav_background_color: navBackgroundColor ?? undefined,
      app_name_font_size: appNameFontSize ?? undefined,
      app_name_color: appNameColor ?? undefined,
      nav_menu_items: normalizeForSave(navMenuItems ?? []),
    })
      .then(() => toast.success("设置已保存"))
      .catch(() => toast.error("保存失败"));
  }, [
    projectId,
    appName,
    appNameFontSize,
    appNameColor,
    logoUrl,
    navLayout,
    theme,
    customTheme,
    model,
    kgModel,
    conversationMode,
    navBackgroundColor,
    navMenuItems,
    normalizeForSave,
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!navPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navPreviewOpen]);

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
        setTheme("modern-b2b");
        toast.success("Theme imported");
      } catch {
        toast.error("Invalid theme file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!projectId) return null;

  return (
    <div
      className="flex-shrink-0"
      style={{ borderColor: "var(--gen-border)" }}
    >
      <div className="px-3 pb-3 space-y-2">
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              App Name
            </label>
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter app name..."
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              App Name Font Size
            </label>
            <Select
              value={appNameFontSize ?? "default"}
              onChange={(e) => {
                const v = e.target.value === "default" ? null : e.target.value;
                setAppNameFontSize(v);
                saveToProject({ app_name_font_size: v ?? undefined });
              }}
              options={[
                { value: "default", label: "默认" },
                { value: "12px", label: "12px" },
                { value: "14px", label: "14px" },
                { value: "16px", label: "16px" },
                { value: "18px", label: "18px" },
                { value: "20px", label: "20px" },
              ]}
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              App Name Color
            </label>
            <div className="flex gap-1 items-center">
              <input
                type="color"
                value={appNameColor ?? "#e2e8f0"}
                onChange={(e) => {
                  const v = e.target.value;
                  setAppNameColor(v);
                  saveToProject({ app_name_color: v });
                }}
                className="h-8 w-12 rounded cursor-pointer"
                style={{ border: "1px solid var(--gen-border)", padding: 2 }}
              />
              <Input
                value={appNameColor ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim() || null;
                  setAppNameColor(v);
                  saveToProject({ app_name_color: v ?? undefined });
                }}
                placeholder="#e2e8f0"
                className="flex-1 text-xs h-8"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              Logo
            </label>
            <div className="flex gap-1">
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="URL"
                className="flex-1 text-xs h-8"
              />
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded"
                style={{ border: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
              >
                <Upload size={10} />
                上传
              </button>
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setLogoUrl(reader.result as string);
                  toast.success("Logo 已上传");
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
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
              className="text-xs h-8"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              Nav Background
            </label>
            <div className="flex gap-1 items-center">
              <input
                type="color"
                value={navBackgroundColor ?? "#1e293b"}
                onChange={(e) => {
                  setNavBackgroundColor(e.target.value);
                  saveToProject({ nav_background_color: e.target.value });
                }}
                className="h-8 w-12 rounded cursor-pointer"
                style={{ border: "1px solid var(--gen-border)", padding: 2 }}
              />
              <Input
                value={navBackgroundColor ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim() || null;
                  setNavBackgroundColor(v);
                  saveToProject({ nav_background_color: v ?? undefined });
                }}
                placeholder="#1e293b"
                className="flex-1 text-xs h-8"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              Theme
            </label>
            <div className="flex gap-1 flex-wrap">
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
                  ...(customTheme ? [{ value: "custom", label: "Custom" }] : []),
                ]}
                className="text-xs h-8 flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={handleImportTheme}
                className="px-2 py-1 text-[10px] rounded"
                style={{ border: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
              >
                Import
              </button>
              <button
                type="button"
                onClick={handleExportTheme}
                className="px-2 py-1 text-[10px] rounded"
                style={{ border: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
              >
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
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              Navigation Menu
            </label>
            <div className="space-y-1.5">
              {(navMenuItems ?? []).map((item, i) => {
                const hasChildren = (item.children?.length ?? 0) > 0;
                const isExpanded = expandedItems.has(i);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-1.5 items-center">
                      <button
                        type="button"
                        onClick={() => setExpandedItems((s) => {
                          const next = new Set(s);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })}
                        className="p-0.5 rounded flex-shrink-0 w-5 h-5 flex items-center justify-center"
                        style={{ color: hasChildren ? "var(--gen-muted-fg)" : "transparent", visibility: hasChildren ? "visible" : "hidden" }}
                        title={isExpanded ? "收起" : "展开"}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <IconPicker
                        value={item.icon ?? ""}
                        onChange={(iconName) => {
                          const next = [...(navMenuItems ?? [])];
                          next[i] = { ...next[i], icon: iconName };
                          setNavMenuItems(next);
                          saveToProject({ nav_menu_items: next });
                        }}
                        className="flex-shrink-0"
                      />
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const next = [...(navMenuItems ?? [])];
                          next[i] = { ...next[i], label: e.target.value };
                          setNavMenuItems(next);
                          saveToProject({ nav_menu_items: next });
                        }}
                        placeholder="Label"
                        className="flex-1 text-xs h-8"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(navMenuItems ?? [])];
                          next[i] = { ...next[i], children: [...(next[i].children ?? []), { label: "Sub Item", icon: "FileText" }] };
                          setNavMenuItems(next);
                          setExpandedItems((s) => new Set(s).add(i));
                          saveToProject({ nav_menu_items: next });
                        }}
                        className="p-1 rounded"
                        style={{ color: "var(--gen-primary)" }}
                        title="Add sub item"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (navMenuItems ?? []).filter((_, j) => j !== i);
                          setNavMenuItems(next);
                          saveToProject({ nav_menu_items: next });
                        }}
                        className="p-1 rounded"
                        style={{ color: "var(--gen-muted-fg)" }}
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {hasChildren && isExpanded && (
                      <div className="pl-6 space-y-1">
                        {(item.children ?? []).map((child, j) => (
                          <div key={j} className="flex gap-1.5 items-center">
                            <IconPicker
                              value={child.icon ?? ""}
                              onChange={(iconName) => {
                                const next = [...(navMenuItems ?? [])];
                                const ch = [...(next[i].children ?? [])];
                                ch[j] = { ...ch[j], icon: iconName };
                                next[i] = { ...next[i], children: ch };
                                setNavMenuItems(next);
                                saveToProject({ nav_menu_items: next });
                              }}
                              className="flex-shrink-0"
                            />
                            <Input
                              value={child.label}
                              onChange={(e) => {
                                const next = [...(navMenuItems ?? [])];
                                const ch = [...(next[i].children ?? [])];
                                ch[j] = { ...ch[j], label: e.target.value };
                                next[i] = { ...next[i], children: ch };
                                setNavMenuItems(next);
                                saveToProject({ nav_menu_items: next });
                              }}
                              placeholder="Sub label"
                              className="flex-1 text-xs h-8"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...(navMenuItems ?? [])];
                                const ch = (next[i].children ?? []).filter((_, k) => k !== j);
                                next[i] = { ...next[i], children: ch.length ? ch : undefined };
                                setNavMenuItems(next);
                                saveToProject({ nav_menu_items: next });
                              }}
                              className="p-1 rounded"
                              style={{ color: "var(--gen-muted-fg)" }}
                              title="Remove"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const prev = navMenuItems ?? [];
                  const next = [...prev, { label: "New Item", icon: "FileText" }];
                  setNavMenuItems(next);
                  saveToProject({ nav_menu_items: next });
                }}
                className="flex items-center gap-1 text-[10px]"
                style={{ color: "var(--gen-primary)" }}
              >
                <Plus size={10} />
                Add menu item
              </button>
              <button
                type="button"
                onClick={() => setNavPreviewOpen(true)}
                className="flex items-center gap-1 text-[10px] mt-1.5"
                style={{ color: "var(--gen-primary)" }}
              >
                <Eye size={10} />
                预览 Navigation
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--gen-muted-fg)" }}>
              Model / Mode
            </label>
            <div className="flex gap-1">
              <Select
                value={conversationMode}
                onChange={(e) => {
                  const v = e.target.value as "plan" | "agent";
                  setConversationMode(v);
                  saveToProject({ conversation_mode: v });
                }}
                options={[
                  { value: "plan", label: "Plan" },
                  { value: "agent", label: "Agent" },
                ]}
                className="text-xs h-8 flex-1"
              />
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model"
                className="text-xs h-8 flex-1 min-w-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium" style={{ color: "var(--gen-muted-fg)" }}>
                知识图谱 LLM
              </label>
              <Input
                value={kgModel ?? ""}
                onChange={(e) => setKgModel(e.target.value.trim() || null)}
                placeholder="留空则使用主对话模型"
                className="text-xs h-8"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium"
            style={{ background: "var(--gen-primary)", color: "#fff" }}
          >
            <Save size={12} />
            保存
          </button>
        </div>

      {/* Navigation Preview Modal */}
      {navPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setNavPreviewOpen(false)}
        >
          <div
            className="rounded-lg overflow-hidden shadow-xl max-w-5xl w-full mx-4"
            style={{
              background: "var(--gen-background)",
              border: "1px solid var(--gen-border)",
              maxHeight: "85vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
            >
              <span className="text-sm font-medium">Navigation 预览</span>
              <button
                type="button"
                onClick={() => setNavPreviewOpen(false)}
                className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <NavPreviewInline
                navLayout={navLayout}
                navMenuItems={navMenuItems ?? []}
                appName={appName}
                logoUrl={logoUrl}
                navBackgroundColor={navBackgroundColor}
                appNameFontSize={appNameFontSize}
                appNameColor={appNameColor}
                theme={theme}
                customTheme={customTheme}
                getIconComp={getIconComp}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavPreviewInline({
  navLayout,
  navMenuItems,
  appName,
  logoUrl,
  navBackgroundColor,
  appNameFontSize,
  appNameColor,
  theme,
  customTheme,
  getIconComp,
}: {
  navLayout: NavLayout;
  navMenuItems: NavMenuItem[];
  appName: string;
  logoUrl: string;
  navBackgroundColor: string | null;
  appNameFontSize: string | null;
  appNameColor: string | null;
  theme: IndustryTheme;
  customTheme: import("@/lib/themes").ThemeTokens | null;
  getIconComp: (name: string) => IconComp | null;
}) {
  const tokens = customTheme ?? themeMap[theme];
  const sidebarBg = navBackgroundColor ?? tokens.sidebarBg;
  const fg = tokens.sidebarForeground;
  const appFontSize = appNameFontSize ?? "14px";
  const appColor = appNameColor ?? fg;
  const items = navMenuItems.length ? navMenuItems : [
    { label: "Dashboard", icon: "LayoutDashboard" },
    { label: "Analytics", icon: "BarChart" },
    { label: "Settings", icon: "Settings" },
  ];

  const renderNavItem = (item: { label: string; icon?: string }, key: string, opts?: { isChild?: boolean; isFirst?: boolean }) => {
    const Icon = item.icon ? getIconComp(item.icon) : null;
    return (
      <div
        key={key}
        className="flex items-center gap-2 py-1.5 px-2 rounded text-xs mb-0.5"
        style={{
          marginLeft: opts?.isChild ? 12 : 0,
          background: opts?.isFirst ? "rgba(255,255,255,0.08)" : "transparent",
          opacity: opts?.isFirst ? 1 : 0.7,
        }}
      >
        {Icon ? <Icon size={14} /> : null}
        <span>{item.label || "Item"}</span>
      </div>
    );
  };

  if (navLayout === "side") {
    return (
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--gen-border)", minHeight: 200 }}>
        <aside
          className="w-[180px] flex-shrink-0 flex flex-col"
          style={{ background: sidebarBg, color: fg }}
        >
          <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-6 h-6 rounded flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: tokens.primary, color: tokens.primaryForeground, fontSize: 11, fontWeight: 700 }}>
                {(appName || "A").charAt(0)}
              </div>
            )}
            <span className="font-semibold text-xs truncate" style={{ fontSize: appFontSize, color: appColor }}>{appName || "App"}</span>
          </div>
          <nav className="p-2 flex-1">
            {items.map((item, i) => (
              <div key={i}>
                {renderNavItem(item, `item-${i}`, { isFirst: i === 0 })}
                {(item.children ?? []).map((child, j) => renderNavItem(child, `item-${i}-child-${j}`, { isChild: true }))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex-1 p-4 flex items-center justify-center" style={{ background: tokens.background, color: tokens.mutedForeground, fontSize: 12 }}>
          内容区域
        </div>
      </div>
    );
  }

  const [topOpenIdx, setTopOpenIdx] = useState<number>(-1);
  return (
    <div className="flex flex-col rounded-lg overflow-hidden border" style={{ borderColor: "var(--gen-border)", minHeight: 160 }}>
      <header
        className="flex items-center gap-4 px-4 py-2 flex-shrink-0"
        style={{ background: sidebarBg, color: fg, borderBottom: "1px solid var(--gen-border)" }}
      >
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-6 h-6 rounded flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: tokens.primary, color: tokens.primaryForeground, fontSize: 11, fontWeight: 700 }}>
              {(appName || "A").charAt(0)}
            </div>
          )}
          <span className="font-semibold text-xs" style={{ fontSize: appFontSize, color: appColor }}>{appName || "App"}</span>
        </div>
        <nav className="flex gap-1 flex-1 items-center">
          {items.map((item, i) => {
            const hasChildren = (item.children?.length ?? 0) > 0;
            if (!hasChildren) {
              const Icon = item.icon ? getIconComp(item.icon) : null;
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs" style={{ background: i === 0 ? "rgba(255,255,255,0.08)" : "transparent", opacity: i === 0 ? 1 : 0.7 }}>
                  {Icon ? <Icon size={14} /> : null}
                  <span>{item.label || "Item"}</span>
                </div>
              );
            }
            const isParentActive = (item.children ?? []).some((c) => (c as { selected?: boolean }).selected);
            const ParentIcon = item.icon ? getIconComp(item.icon) : null;
            return (
              <div
                key={i}
                className="relative"
                onMouseEnter={() => setTopOpenIdx(i)}
                onMouseLeave={() => setTopOpenIdx(-1)}
              >
                <div className="flex items-center gap-2 py-1.5 px-2 rounded text-xs" style={{ background: isParentActive ? "rgba(255,255,255,0.08)" : "transparent", opacity: isParentActive ? 1 : 0.7 }}>
                  {ParentIcon ? <ParentIcon size={14} /> : null}
                  <span>{item.label || "Item"}</span>
                </div>
                {topOpenIdx === i && (item.children ?? []).length > 0 && (
                  <div
                    className="absolute left-0 mt-1 rounded py-1 min-w-[120px] z-10"
                    style={{ background: sidebarBg, border: "1px solid var(--gen-border)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                  >
                    {(item.children ?? []).map((ch, j) => {
                      const Icon = ch.icon ? getIconComp(ch.icon) : null;
                      const sel = (ch as { selected?: boolean }).selected ?? false;
                      return (
                        <div
                          key={j}
                          className="flex items-center gap-2 py-2 px-3 text-xs"
                          style={{ background: sel ? "rgba(255,255,255,0.08)" : "transparent", opacity: sel ? 1 : 0.7, borderTop: j === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}
                        >
                          {Icon ? <Icon size={14} /> : null}
                          <span>{ch.label || "Item"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 p-4 flex items-center justify-center" style={{ background: tokens.background, color: tokens.mutedForeground, fontSize: 12 }}>
        内容区域
      </div>
    </div>
  );
}
