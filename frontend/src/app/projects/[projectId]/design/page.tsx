"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  getProject,
  listPages,
  updateProject,
  type Page,
  type Project,
  type NavMenuItem,
  type NavConfigItem,
} from "@/lib/api";
import { ThemeInjector } from "@/components/theme-injector";
import { ArrowLeft, Loader2, Eye } from "lucide-react";

const DEFAULT_NAV_MENU_ITEMS: NavMenuItem[] = [
  { label: "Dashboard", icon: "LayoutDashboard" },
  { label: "Analytics", icon: "BarChart" },
  { label: "Settings", icon: "Settings" },
];

export default function SystemDesignPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<NavConfigItem[]>([]);

  const navMenuItems = (project?.nav_menu_items?.length ? project.nav_menu_items : DEFAULT_NAV_MENU_ITEMS) as NavMenuItem[];
  const tsxPages = pages.filter((p) => p.code_language === "tsx");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProject(projectId), listPages(projectId)])
      .then(([proj, pgs]) => {
        if (!cancelled) {
          setProject(proj);
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
    setSaving(true);
    try {
      await updateProject(projectId, {
        nav_config: { items },
      });
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" data-theme="modern-b2b">
        <ThemeInjector />
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" data-theme="modern-b2b">
      <ThemeInjector />
      <header
        className="flex items-center gap-4 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)" }}
      >
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1 text-sm"
          style={{ color: "var(--gen-muted-fg)" }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className="text-lg font-semibold flex-1" style={{ color: "var(--gen-foreground)" }}>
          System Design
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded font-medium"
          style={{
            background: "var(--gen-primary)",
            color: "#fff",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {hasNavConfig && (
          <Link
            href={`/projects/${projectId}/preview`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded font-medium"
            style={{
              background: "var(--gen-muted)",
              color: "var(--gen-foreground)",
            }}
          >
            <Eye size={16} />
            Preview
          </Link>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 p-6 overflow-y-auto"
          style={{ color: "var(--gen-foreground)" }}
        >
          <p className="text-sm mb-4" style={{ color: "var(--gen-muted-fg)" }}>
            为每个导航菜单项选择要渲染的页面。导航菜单来自项目设置，页面来自 Resources Tab。
          </p>
          <div className="max-w-2xl space-y-4">
            <h2 className="text-sm font-medium" style={{ color: "var(--gen-foreground)" }}>
              导航菜单配置
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div
                    className="flex items-center gap-4 px-4 py-3 rounded-lg"
                    style={{ background: "var(--gen-muted)" }}
                  >
                    <span className="w-28 flex-shrink-0 text-sm font-medium">{item.label}</span>
                    <select
                      value={item.pageId ?? ""}
                      onChange={(e) => setPageForLabel(item.label, e.target.value)}
                      className="flex-1 text-sm px-3 py-2 rounded border"
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
                      className="flex items-center gap-4 px-4 py-3 rounded-lg ml-6"
                      style={{ background: "var(--gen-muted)" }}
                    >
                      <span className="w-28 flex-shrink-0 text-sm" style={{ color: "var(--gen-muted-fg)" }}>
                        {item.label} › {child.label}
                      </span>
                      <select
                        value={child.pageId}
                        onChange={(e) => setPageForLabel(child.label, e.target.value, item.label)}
                        className="flex-1 text-sm px-3 py-2 rounded border"
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
      </div>
    </div>
  );
}
