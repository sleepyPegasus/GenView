"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from "@codesandbox/sandpack-react";
import { getProject, getPage } from "@/lib/api";
import { generateSandpackFiles } from "@/lib/sandpack-files";
import { ThemeInjector } from "@/components/theme-injector";
import { Loader2 } from "lucide-react";

function ScreenshotReadyMarker() {
  const { listen } = useSandpack();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = listen((msg: { type?: string }) => {
      if (msg.type === "resize") setReady(true);
    });
    return unsub;
  }, [listen]);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 25000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      data-sandpack-ready={ready ? "true" : undefined}
      aria-hidden
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
    />
  );
}

/** Single-page preview for screenshot capture. No header, full-height Sandpack. */
export default function SinglePagePreview() {
  const params = useParams();
  const projectId = params.projectId as string;
  const pageId = params.pageId as string;
  const [project, setProject] = useState<Awaited<ReturnType<typeof getProject>> | null>(null);
  const [page, setPage] = useState<Awaited<ReturnType<typeof getPage>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // #region agent log
    fetch("http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6e4d16" },
      body: JSON.stringify({ sessionId: "6e4d16", hypothesisId: "H1", location: "preview/[pageId]/page.tsx", message: "fetch_start", data: { projectId, pageId }, timestamp: Date.now() }),
    }).catch(() => {});
    // #endregion
    Promise.all([getProject(projectId), getPage(projectId, pageId)])
      .then(([proj, pg]) => {
        if (!cancelled) {
          setProject(proj);
          setPage(pg);
          // #region agent log
          fetch("http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6e4d16" },
            body: JSON.stringify({ sessionId: "6e4d16", hypothesisId: "H1", message: "fetch_ok", data: { hasProject: !!proj, hasPage: !!pg }, timestamp: Date.now() }),
          }).catch(() => {});
          // #endregion
        }
      })
      .catch((err) => {
        if (!cancelled) setProject(null);
        // #region agent log
        fetch("http://127.0.0.1:7918/ingest/87f31a80-3a7d-4864-9e96-a12de212a7d4", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6e4d16" },
          body: JSON.stringify({ sessionId: "6e4d16", hypothesisId: "H1", message: "fetch_fail", data: { error: String(err) }, timestamp: Date.now() }),
        }).catch(() => {});
        // #endregion
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId, pageId]);

  if (loading || !project || !page || page.code_language !== "tsx") {
    return (
      <div className="flex h-screen items-center justify-center" data-theme="modern-b2b">
        <ThemeInjector />
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
      </div>
    );
  }

  const navLayout = (project.nav_layout ?? "side") as "top" | "side";

  const cfg = project.nav_config as { items?: { label: string; pageId: string }[]; top?: { pageId: string; label: string }[]; side?: { pageId: string; label: string }[] } | null;
  const configItems = (cfg?.items && Array.isArray(cfg.items))
    ? (cfg.items.filter((i) => i.pageId) as { pageId: string; label: string }[])
    : ((cfg?.[navLayout] ?? []) as { pageId: string; label: string }[]);
  const defaultItems = [
    { label: "Dashboard", icon: "LayoutDashboard" },
    { label: "Analytics", icon: "BarChart" },
    { label: "Settings", icon: "Settings" },
  ];
  const navMenuItems =
    configItems.length > 0
      ? configItems.map((item, i) => {
          const hasMatch = configItems.some((c) => c.pageId === page.id);
          const labelMatchIdx = hasMatch ? -1 : configItems.findIndex((c) => c.label === page.nav_label);
          const menuItem = (project.nav_menu_items ?? defaultItems).find((m: { label: string }) => m.label === item.label);
          return {
            label: item.label,
            icon: (menuItem as { icon?: string })?.icon ?? undefined,
            selected:
              item.pageId === page.id ||
              (!hasMatch && (labelMatchIdx === i || (labelMatchIdx < 0 && i === 0))),
          };
        })
      : (project.nav_menu_items ?? defaultItems).map((item: { label: string; icon?: string }, i: number) => ({
          label: item.label,
          icon: item.icon,
          selected: item.label === page.nav_label || (i === 0 && !page.nav_label),
        }));

  const files = generateSandpackFiles({
    appName: project.name,
    logoUrl: project.logo_url ?? "",
    navLayout,
    theme: (project.theme ?? "modern-b2b") as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy",
    customTheme: (project.custom_theme as import("@/lib/themes").ThemeTokens) ?? null,
    navBackgroundColor: project.nav_background_color ?? null,
    appNameFontSize: project.app_name_font_size ?? null,
    appNameColor: project.app_name_color ?? null,
    navMenuItems,
    contentCode: page.code_block,
    extraFiles: (page.extra_files as Record<string, string>) ?? undefined,
  });

  return (
    <div className="h-screen w-screen overflow-hidden" data-theme="modern-b2b">
      <ThemeInjector />
      <SandpackProvider
        template="react-ts"
        files={files}
        customSetup={{
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            recharts: "^2.10.0",
            echarts: "^5.5.0",
            "echarts-for-react": "^3.0.2",
            "lucide-react": "^0.294.0",
          },
        }}
        theme="light"
      >
        <ScreenshotReadyMarker />
        <SandpackLayout>
          <SandpackPreview style={{ height: "100vh", width: "100vw" }} />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
