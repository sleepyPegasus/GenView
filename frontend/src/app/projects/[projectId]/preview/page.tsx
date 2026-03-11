"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { getProject, listPages } from "@/lib/api";
import { generateMultiPageSandpackFiles } from "@/lib/sandpack-files";
import { ThemeInjector } from "@/components/theme-injector";
import { ArrowLeft, Loader2, Maximize2, Minimize2 } from "lucide-react";

export default function SystemPreviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Awaited<ReturnType<typeof getProject>> | null>(null);
  const [pages, setPages] = useState<Awaited<ReturnType<typeof listPages>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!previewRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      previewRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProject(projectId), listPages(projectId)])
      .then(([proj, pgs]) => {
        if (!cancelled) {
          setProject(proj);
          setPages(pgs);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading || !project || !pages) {
    return (
      <div className="flex h-screen items-center justify-center" data-theme="modern-b2b">
        <ThemeInjector />
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
      </div>
    );
  }

  const cfg = project.nav_config as {
    items?: { label: string; pageId: string }[];
    top?: { pageId: string; label: string }[];
    side?: { pageId: string; label: string }[];
  } | undefined;
  const navLayout = (project.nav_layout as "top" | "side") ?? "side";

  let allItems: { pageId: string; label: string }[];
  if (cfg?.items && Array.isArray(cfg.items)) {
    allItems = cfg.items.filter((i) => i.pageId).map((i) => ({ pageId: i.pageId, label: i.label }));
  } else {
    const topItems = cfg?.top ?? [];
    const sideItems = cfg?.side ?? [];
    allItems = navLayout === "side" ? sideItems : topItems;
  }

  if (allItems.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center" data-theme="modern-b2b">
        <ThemeInjector />
        <p className="text-sm mb-4" style={{ color: "var(--gen-muted-fg)" }}>
          No pages in navigation. Configure in System Design first.
        </p>
        <Link
          href={`/projects/${projectId}/design`}
          className="flex items-center gap-2 px-4 py-2 rounded"
          style={{ background: "var(--gen-primary)", color: "#fff" }}
        >
          <ArrowLeft size={16} />
          System Design
        </Link>
      </div>
    );
  }

  const pageMap: Record<string, { code: string; extraFiles?: Record<string, string> }> = {};
  for (const item of allItems) {
    const p = pages.find((x) => x.id === item.pageId);
    if (p && p.code_language === "tsx") {
      pageMap[p.id] = {
        code: p.code_block,
        extraFiles: (p.extra_files as Record<string, string>) ?? undefined,
      };
    }
  }

  const files = generateMultiPageSandpackFiles({
    appName: project.name,
    logoUrl: project.logo_url,
    navLayout,
    theme: project.theme as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy",
    navConfig: { top: allItems, side: allItems },
    pages: pageMap,
  });

  return (
    <div
      className="flex flex-col w-full min-h-0"
      style={{ height: "100vh", minHeight: "100dvh" }}
      data-theme="modern-b2b"
    >
      <ThemeInjector />
      <header
        className="flex items-center gap-4 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)" }}
      >
        <Link
          href={`/projects/${projectId}/design`}
          className="flex items-center gap-1 text-sm"
          style={{ color: "var(--gen-muted-fg)" }}
        >
          <ArrowLeft size={16} />
          Back to Design
        </Link>
        <span className="text-sm font-medium flex-1" style={{ color: "var(--gen-foreground)" }}>
          Preview: {project.name}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors"
          style={{ color: "var(--gen-muted-fg)" }}
          title={isFullscreen ? "退出全屏" : "全屏预览"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </header>
      <div
        ref={previewRef}
        className="flex flex-col flex-1 min-h-0 overflow-hidden flex-grow"
        style={{
          background: "var(--gen-background)",
          height: "calc(100vh - 48px)",
          minHeight: "calc(100dvh - 48px)",
        }}
      >
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
          <SandpackLayout
            style={{
              flex: 1,
              minHeight: "calc(100dvh - 48px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <SandpackPreview
              style={{ flex: 1, minHeight: 0 }}
              showNavigator={false}
              showRefreshButton
            />
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
