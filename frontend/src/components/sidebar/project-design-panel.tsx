"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import {
  exportProject,
  getProject,
  listPages,
  updateProject,
  type Page,
  type NavMenuItem,
  type NavConfigItem,
} from "@/lib/api";
import { Download, Eye, Loader2, Monitor, Tablet, Smartphone } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const DEFAULT_NAV_MENU_ITEMS: NavMenuItem[] = [
  { label: "Dashboard", icon: "LayoutDashboard" },
  { label: "Analytics", icon: "BarChart" },
  { label: "Settings", icon: "Settings" },
];

interface ProjectDesignPanelProps {
  projectId: string | null;
}

export function ProjectDesignPanel({ projectId }: ProjectDesignPanelProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [items, setItems] = useState<NavConfigItem[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "phone">("desktop");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    Promise.all([getProject(projectId), listPages(projectId)])
      .then(([proj, pgs]) => {
        if (!cancelled) {
          setPages(pgs);
          const cfg = proj.nav_config as { items?: NavConfigItem[]; top?: { label: string; pageId: string }[]; side?: { label: string; pageId: string }[] } | undefined;
          const navItems = (proj.nav_menu_items?.length ? proj.nav_menu_items : DEFAULT_NAV_MENU_ITEMS) as NavMenuItem[];
          if (cfg?.items && Array.isArray(cfg.items)) {
            const merged = navItems.map((m, i) => {
              const existing = cfg.items!.find((c) => c.label === m.label) ?? cfg.items![i];
              const hasChildren = (m.children?.length ?? 0) > 0;
              if (hasChildren) {
                const existingChildren = (existing as NavConfigItem)?.children ?? [];
                const children = (m.children ?? []).map((ch, j) => {
                  const ec = existingChildren.find((c) => c.label === ch.label) ?? existingChildren[j];
                  return { label: ch.label, pageId: ec?.pageId ?? "" };
                });
                return { label: m.label, pageId: (existing as NavConfigItem)?.pageId ?? "", children };
              }
              return { label: m.label, pageId: (existing as { pageId?: string })?.pageId ?? "" };
            });
            setItems(merged.length ? merged : [{ label: "Dashboard", pageId: "" }, { label: "Analytics", pageId: "" }, { label: "Settings", pageId: "" }]);
          } else {
            const legacy = (cfg?.side ?? cfg?.top ?? []) as { label: string; pageId: string }[];
            if (legacy.length > 0) {
              const merged = navItems.map((m) => {
                const hasChildren = (m.children?.length ?? 0) > 0;
                if (hasChildren) {
                  const children = (m.children ?? []).map((ch) => {
                    const found = legacy.find((c) => c.label === ch.label);
                    return { label: ch.label, pageId: found?.pageId ?? "" };
                  });
                  return { label: m.label, pageId: "", children };
                }
                const found = legacy.find((c) => c.label === m.label);
                return { label: m.label, pageId: found?.pageId ?? "" };
              });
              setItems(merged);
            } else {
              setItems(navItems.map((m) => {
                const hasChildren = (m.children?.length ?? 0) > 0;
                if (hasChildren) {
                  return { label: m.label, pageId: "", children: (m.children ?? []).map((ch) => ({ label: ch.label, pageId: "" })) };
                }
                return { label: m.label, pageId: "" };
              }));
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const setPageForLabel = (label: string, pageId: string, parentLabel?: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (parentLabel) {
          if (i.label !== parentLabel) return i;
          const children = (i.children ?? []).map((c) => (c.label === label ? { ...c, pageId } : c));
          return { ...i, children };
        }
        if (i.label === label) return { ...i, pageId };
        return i;
      })
    );
  };

  const tsxPages = pages.filter((p) => p.code_language === "tsx");
  const configuredCount = items.reduce(
    (acc, i) => acc + (i.pageId ? 1 : 0) + (i.children ?? []).filter((c) => c.pageId).length,
    0
  );
  const hasNavConfig = configuredCount > 0;
  const previewTabs: { pageId: string; label: string }[] = [];
  for (const i of items) {
    if (i.pageId) previewTabs.push({ pageId: i.pageId, label: i.label });
    for (const ch of i.children ?? []) {
      if (ch.pageId) previewTabs.push({ pageId: ch.pageId, label: `${i.label} › ${ch.label}` });
    }
  }
  const viewportWidth =
    previewViewport === "desktop" ? "100%" : previewViewport === "tablet" ? "768px" : "375px";

  const handleSave = useCallback(async () => {
    if (!projectId) return;

    const flat: { pageId: string; label: string }[] = [];
    for (const i of items) {
      if (i.pageId) flat.push({ pageId: i.pageId, label: i.label });
      for (const ch of i.children ?? []) {
        if (ch.pageId) flat.push({ pageId: ch.pageId, label: `${i.label} › ${ch.label}` });
      }
    }

    if (tsxPages.length > 0 && flat.length === 0) {
      toast.error("请至少为一个导航项配置页面");
      return;
    }

    const pageIdToLabels = new Map<string, string[]>();
    for (const { pageId, label } of flat) {
      const list = pageIdToLabels.get(pageId) ?? [];
      list.push(label);
      pageIdToLabels.set(pageId, list);
    }
    const duplicates = [...pageIdToLabels.entries()].filter(([, labels]) => labels.length > 1);
    if (duplicates.length > 0) {
      const names = duplicates.map(([pid, labels]) => {
        const p = tsxPages.find((x) => x.id === pid);
        return `${p?.name ?? pid} 已映射到: ${labels.join("、")}`;
      });
      toast.warning(`重复映射: ${names.join("；")}`, { duration: 5000 });
    }

    setSaving(true);
    try {
      await updateProject(projectId, { nav_config: { items } });
      setPreviewLoading(true);
      setPreviewKey((k) => k + 1);
      toast.success("Saved");
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [projectId, items, tsxPages]);

  if (!projectId) {
    return (
      <p className="text-xs py-4" style={{ color: "var(--gen-muted-fg)" }}>
        请先选择项目
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size={20} label="加载中..." />
      </div>
    );
  }

  const configContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
          为每个导航菜单项选择要渲染的页面。导航菜单来自项目设置，页面来自 Resources Tab。
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded font-medium"
            style={{
              background: "var(--gen-primary)",
              color: "#fff",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {hasNavConfig && projectId && (
            <Link
              href={`/projects/${projectId}/preview`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium"
              style={{
                background: "var(--gen-muted)",
                color: "var(--gen-foreground)",
              }}
            >
              <Eye size={14} />
              Preview
            </Link>
          )}
          {projectId && (
            <button
              type="button"
              onClick={async () => {
                if (!projectId || exporting) return;
                setExporting(true);
                try {
                  const { blob, filename } = await exportProject(projectId);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("导出成功");
                } catch (err) {
                  toast.error("导出失败", {
                    description: err instanceof Error ? err.message : "Unknown error",
                  });
                } finally {
                  setExporting(false);
                }
              }}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium"
              style={{
                background: "var(--gen-muted)",
                color: "var(--gen-foreground)",
                opacity: exporting ? 0.7 : 1,
              }}
            >
              <Download size={14} />
              {exporting ? "导出中..." : "导出项目"}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>
          导航菜单配置
        </h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div
                className="flex gap-2 items-center px-3 py-2 rounded-lg"
                style={{ background: "var(--gen-muted)" }}
              >
                <span className="w-20 flex-shrink-0 text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>{item.label}</span>
                <select
                  value={item.pageId ?? ""}
                  onChange={(e) => setPageForLabel(item.label, e.target.value)}
                  className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded border"
                  style={{
                    background: "var(--gen-background)",
                    borderColor: "var(--gen-border)",
                    color: "var(--gen-foreground)",
                  }}
                >
                  <option value="">未选择</option>
                  {tsxPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {(item.children ?? []).map((child) => (
                <div
                  key={`${item.label}-${child.label}`}
                  className="flex gap-2 items-center px-3 py-2 rounded-lg ml-4"
                  style={{ background: "var(--gen-muted)" }}
                >
                  <span className="w-20 flex-shrink-0 text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                    {item.label} › {child.label}
                  </span>
                  <select
                    value={child.pageId}
                    onChange={(e) => setPageForLabel(child.label, e.target.value, item.label)}
                    className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded border"
                    style={{
                      background: "var(--gen-background)",
                      borderColor: "var(--gen-border)",
                      color: "var(--gen-foreground)",
                    }}
                  >
                    <option value="">未选择</option>
                    {tsxPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
        {tsxPages.length === 0 && (
          <p className="text-xs py-2" style={{ color: "var(--gen-muted-fg)" }}>
            暂无 tsx 页面。请先在对话中保存页面到 Resources Tab。
          </p>
        )}
      </div>
    </div>
  );

  if (hasNavConfig && projectId) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="flex flex-col min-h-0 flex-1" style={{ height: "100vh", minHeight: 400 }}>
        <Group orientation="horizontal" style={{ height: "100%", minHeight: 400 }}>
          <Panel id="config" defaultSize={45} minSize={30}>
            <div className="h-full overflow-y-auto pr-2">{configContent}</div>
          </Panel>
          <Separator className="w-1.5 flex-shrink-0 rounded transition-colors hover:bg-[var(--gen-primary)]" style={{ background: "var(--gen-border)" }} />
          <Panel id="preview" defaultSize={55} minSize={30}>
            <div className="h-full flex flex-col rounded-lg overflow-hidden" style={{ border: "1px solid var(--gen-border)" }}>
              <div
                className="flex items-center justify-between gap-2 px-2 py-1.5 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--gen-border)", background: "var(--gen-muted)" }}
              >
                <div className="flex gap-0.5">
                  {(["desktop", "tablet", "phone"] as const).map((vp) => (
                    <button
                      key={vp}
                      type="button"
                      onClick={() => setPreviewViewport(vp)}
                      className="p-1.5 rounded transition-colors"
                      style={{
                        background: previewViewport === vp ? "var(--gen-primary)" : "transparent",
                        color: previewViewport === vp ? "#fff" : "var(--gen-muted-fg)",
                      }}
                      title={vp === "desktop" ? "桌面" : vp === "tablet" ? "平板" : "手机"}
                    >
                      {vp === "desktop" ? <Monitor size={14} /> : vp === "tablet" ? <Tablet size={14} /> : <Smartphone size={14} />}
                    </button>
                  ))}
                </div>
                {previewTabs.length > 1 && (
                <div className="flex gap-0.5">
                  {previewTabs.map((tab) => {
                    const isActive = previewPageId === tab.pageId || (previewPageId === null && tab.pageId === previewTabs[0]?.pageId);
                    return (
                      <button
                        key={tab.pageId}
                        type="button"
                        onClick={() => {
                          setPreviewLoading(true);
                          setPreviewPageId(tab.pageId);
                        }}
                        className="px-2.5 py-1 text-xs rounded transition-colors"
                        style={{
                          background: isActive ? "var(--gen-primary)" : "transparent",
                          color: isActive ? "#fff" : "var(--gen-muted-fg)",
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
              <div className="flex-1 min-h-0 relative flex justify-center overflow-auto" style={{ background: "var(--gen-muted)" }}>
                {previewLoading && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
                    style={{ background: "var(--gen-muted)" }}
                  >
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-muted-fg)" }} />
                    <span className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>加载预览中...</span>
                  </div>
                )}
                <div
                  className="flex-shrink-0 overflow-hidden rounded-b-lg"
                  style={{
                    width: viewportWidth,
                    maxWidth: "100%",
                    height: "100%",
                    minHeight: 400,
                    boxShadow: previewViewport !== "desktop" ? "0 0 0 1px var(--gen-border)" : undefined,
                  }}
                >
                  <iframe
                    key={`${previewKey}-${previewPageId ?? "default"}`}
                    src={`${base}/projects/${projectId}/preview?v=${previewKey}${previewPageId ? `&page=${encodeURIComponent(previewPageId)}` : ""}`}
                    title="系统预览"
                    className="w-full h-full"
                    sandbox="allow-scripts allow-same-origin"
                    onLoad={() => setPreviewLoading(false)}
                  />
                </div>
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    );
  }

  return configContent;
}
