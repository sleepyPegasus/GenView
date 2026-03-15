"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getProject,
  listPages,
  updateProject,
  type Page,
  type NavMenuItem,
  type NavConfigItem,
} from "@/lib/api";
import { Loader2, Eye } from "lucide-react";

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
  const [items, setItems] = useState<NavConfigItem[]>([]);

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

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await updateProject(projectId, { nav_config: { items } });
      toast.success("Saved");
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const configuredCount = items.reduce(
    (acc, i) => acc + (i.pageId ? 1 : 0) + (i.children ?? []).filter((c) => c.pageId).length,
    0
  );
  const hasNavConfig = configuredCount > 0;
  const tsxPages = pages.filter((p) => p.code_language === "tsx");

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
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
      </div>
    );
  }

  return (
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
}
