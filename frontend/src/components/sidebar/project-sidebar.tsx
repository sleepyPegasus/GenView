"use client";

import { useCallback, useEffect, useState, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import {
  listProjects,
  listConversations,
  createProject,
  createConversation,
  getProject,
  getConversation,
  getPage,
  listMessages,
  listPages,
  createPage,
  deleteConversation,
  deletePage,
  updatePage,
  updateConversation,
  searchProject,
  exportPageHtml,
  getBaseUrl,
  flattenNavConfigItems,
  flattenNavMenuLabels,
  type Project,
  type Conversation,
  type Page,
  type SearchResult,
} from "@/lib/api";
import Link from "next/link";
import { MessageSquarePlus, GripVertical, Trash2, Loader2, Pencil, ArrowLeft, FileCode, FileText, Settings2, Eye, X, Copy, Save, Download, Maximize2, Minimize2, Search, ImageOff, RotateCcw, LayoutDashboard, BarChart3, Table, GitBranch } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProjectSettingsPanel } from "./project-settings-panel";
import { ProjectTimelinePanel } from "./project-timeline-panel";
import { ProjectKnowledgePanel } from "./project-knowledge-panel";
import { ProjectDesignPanel } from "./project-design-panel";
import { ConversationNavMenuPanel } from "./conversation-nav-menu-panel";
import { MermaidPreview } from "@/components/canvas/mermaid-preview";
import { SandpackProvider, SandpackLayout, SandpackPreview, SandpackCodeEditor, useSandpack } from "@codesandbox/sandpack-react";
import { generateSandpackFiles } from "@/lib/sandpack-files";
import { PAGE_TEMPLATES } from "@/lib/page-templates";

export type ProjectSidebarTab = "conversations" | "resources" | "design" | "timeline" | "knowledge" | "settings";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightKeywords(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = escapeRegExp(query.trim());
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  const qLower = query.trim().toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === qLower ? (
      <mark key={i} className="font-medium" style={{ background: "rgba(59,130,246,0.25)", color: "inherit" }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function ProjectSearchModal({
  open,
  onClose,
  projectId,
  onSelectConversation,
  onSelectPage,
  onSelectTimeline,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSelectConversation: (id: string) => void;
  onSelectPage: (id: string) => void;
  onSelectTimeline: (id: string) => void;
  onTabChange: (tab: ProjectSidebarTab) => void;
}) {
  const SEARCH_HISTORY_KEY = "genview-search-history";
  const SEARCH_HISTORY_MAX = 10;
  const getSearchHistory = useCallback(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`${SEARCH_HISTORY_KEY}-${projectId}`);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, SEARCH_HISTORY_MAX) : [];
    } catch {
      return [];
    }
  }, [projectId]);
  const addSearchHistory = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      const prev = getSearchHistory();
      const next = [q.trim(), ...prev.filter((x) => x !== q.trim())].slice(0, SEARCH_HISTORY_MAX);
      try {
        localStorage.setItem(`${SEARCH_HISTORY_KEY}-${projectId}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [projectId, getSearchHistory]
  );

  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "conversations" | "pages" | "timeline">("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSearchType("all");
      setSelectedIndex(0);
      setSearchHistory(getSearchHistory());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, projectId, getSearchHistory]);

  useEffect(() => {
    if (!open || !projectId || !debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchProject(projectId, debouncedQuery, searchType)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setSelectedIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, projectId, debouncedQuery, searchType]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        addSearchHistory(debouncedQuery.trim());
        const r = results[selectedIndex];
        if (r.type === "conversation") {
          onTabChange("conversations");
          onSelectConversation(r.id);
        } else if (r.type === "page") {
          onTabChange("resources");
          onSelectPage(r.id);
        } else {
          onTabChange("timeline");
          onSelectTimeline(r.id);
        }
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, results, selectedIndex, debouncedQuery, addSearchHistory, onClose, onTabChange, onSelectConversation, onSelectPage, onSelectTimeline]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="项目内搜索"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        className="relative z-10 w-full max-w-lg rounded-lg shadow-xl overflow-hidden"
        style={{
          background: "var(--gen-background)",
          border: "1px solid var(--gen-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--gen-border)" }}>
          <Search size={18} style={{ color: "var(--gen-muted-fg)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话、页面、时间线..."
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            style={{ color: "var(--gen-foreground)" }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}>Esc</kbd>
        </div>
        <div className="flex gap-0.5 px-3 py-1.5" style={{ borderBottom: "1px solid var(--gen-border)" }}>
          {(["all", "conversations", "pages", "timeline"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSearchType(t)}
              className="px-2 py-1 text-xs rounded"
              style={{
                background: searchType === t ? "var(--gen-muted)" : "transparent",
                color: searchType === t ? "var(--gen-foreground)" : "var(--gen-muted-fg)",
              }}
            >
              {t === "all" ? "全部" : t === "conversations" ? "对话" : t === "pages" ? "页面" : "时间线"}
            </button>
          ))}
        </div>
        <div ref={listRef} className="max-h-[240px] overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
            </div>
          ) : results.length === 0 && debouncedQuery.trim() ? (
            <div className="py-6 px-4 text-center">
              <p className="text-xs mb-2" style={{ color: "var(--gen-muted-fg)" }}>未找到相关结果</p>
              <p className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>
                尝试其他关键词，或切换到「全部」类型扩大搜索范围
              </p>
            </div>
          ) : results.length === 0 && !debouncedQuery.trim() ? (
            <div className="py-4 px-3">
              {searchHistory.length > 0 ? (
                <div>
                  <p className="text-[10px] font-medium mb-2 px-1" style={{ color: "var(--gen-muted-fg)" }}>最近搜索</p>
                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setQuery(h);
                          inputRef.current?.focus();
                        }}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          background: "var(--gen-muted)",
                          color: "var(--gen-foreground)",
                          border: "1px solid var(--gen-border)",
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs py-4 text-center" style={{ color: "var(--gen-muted-fg)" }}>输入关键词搜索</p>
              )}
            </div>
          ) : (
            (() => {
              const groups = searchType === "all"
                ? [
                    { label: "对话", type: "conversation" as const, items: results.filter((r) => r.type === "conversation") },
                    { label: "页面", type: "page" as const, items: results.filter((r) => r.type === "page") },
                    { label: "时间线", type: "timeline" as const, items: results.filter((r) => r.type === "timeline") },
                  ].filter((g) => g.items.length > 0)
                : [{ label: searchType === "conversations" ? "对话" : searchType === "pages" ? "页面" : "时间线", type: searchType === "conversations" ? "conversation" as const : searchType === "pages" ? "page" as const : "timeline" as const, items: results }];
              let flatIdx = 0;
              return groups.flatMap((g) => [
                searchType === "all" && (
                  <div key={`h-${g.type}`} className="px-3 py-1.5 text-[10px] font-medium" style={{ color: "var(--gen-muted-fg)" }}>
                    {g.label}
                  </div>
                ),
                ...g.items.map((r) => {
                  const i = flatIdx++;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      data-index={i}
                      type="button"
                      title={r.summary ? `${r.title}\n\n${r.summary}` : r.title}
                      onClick={() => {
                        addSearchHistory(debouncedQuery.trim());
                        if (r.type === "conversation") {
                          onTabChange("conversations");
                          onSelectConversation(r.id);
                        } else if (r.type === "page") {
                          onTabChange("resources");
                          onSelectPage(r.id);
                        } else {
                          onTabChange("timeline");
                          onSelectTimeline(r.id);
                        }
                        onClose();
                      }}
                      className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-[var(--gen-muted)] transition-colors"
                      style={{
                        background: selectedIndex === i ? "var(--gen-muted)" : "transparent",
                        color: "var(--gen-foreground)",
                      }}
                    >
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{
                          color: r.type === "conversation" ? "#3b82f6" : r.type === "page" ? "#10b981" : "#8b5cf6",
                          background: r.type === "conversation" ? "rgba(59,130,246,0.15)" : r.type === "page" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)",
                        }}
                      >
                        {r.type === "conversation" ? "对话" : r.type === "page" ? "页面" : "时间线"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{highlightKeywords(r.title, debouncedQuery)}</p>
                        {r.summary && (
                          <p
                            className={`text-xs mt-0.5 ${selectedIndex === i ? "" : "truncate"}`}
                            style={{
                              color: "var(--gen-muted-fg)",
                              ...(selectedIndex === i
                                ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
                                : {}),
                            }}
                          >
                            {highlightKeywords(r.summary, debouncedQuery)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                }),
              ]);
            })()
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ThumbnailLightbox({
  imageUrl,
  loading,
  pageName,
  onClose,
}: {
  imageUrl?: string;
  loading?: boolean;
  pageName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`缩略图放大: ${pageName}`}
    >
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
      />
      <div
        className="relative z-10 max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <Loader2 size={48} className="animate-spin text-white" />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={pageName}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <p className="text-sm text-white/80">加载中...</p>
        )}
      </div>
    </div>
  );
}

interface ProjectSidebarProps {
  /** When on project route, pass projectId from URL so sidebar uses it */
  projectIdFromRoute?: string | null;
  /** Initial tab when entering from project list (e.g. ?tab=resources) */
  initialTab?: ProjectSidebarTab;
  /** Controlled mode: current tab from parent */
  activeTab?: ProjectSidebarTab;
  /** Controlled mode: called when tab changes */
  onTabChange?: (tab: ProjectSidebarTab) => void;
  /** Main content when on Chat tab (conversation list shown on left, this on right) */
  children?: React.ReactNode;
}

interface SortablePageCardProps {
  page: Page;
  projectIdFromRoute: string | null | undefined;
  screenshotLoadingPageIds: Set<string>;
  setScreenshotLoadingPageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  htmlExportLoadingPageIds: Set<string>;
  setHtmlExportLoadingPageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onPreview: (p: Page) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  selected?: boolean;
  onToggleSelect?: (pageId: string) => void;
  onCopy: (e: React.MouseEvent, code: string) => void;
  onSettingsClick: (pageId: string, rect: { top: number; left: number }) => void;
  onThumbnailClick?: (pageId: string, pageName: string) => void;
  getBaseUrl: () => string;
  thumbnailUrl?: string;
  thumbnailLoading?: boolean;
  thumbnailFailed?: boolean;
  onFetchThumbnail?: (pageId: string) => void;
  onRetryThumbnail?: (pageId: string) => void;
}

function SortablePageCard({
  page,
  projectIdFromRoute,
  screenshotLoadingPageIds,
  setScreenshotLoadingPageIds,
  htmlExportLoadingPageIds,
  setHtmlExportLoadingPageIds,
  onPreview,
  onDelete,
  onCopy,
  selected,
  onToggleSelect,
  onSettingsClick,
  onThumbnailClick,
  getBaseUrl,
  thumbnailUrl,
  thumbnailLoading,
  thumbnailFailed,
  onFetchThumbnail,
  onRetryThumbnail,
}: SortablePageCardProps) {
  useEffect(() => {
    if (
      (page.code_language === "tsx" || page.code_language === "mermaid") &&
      onFetchThumbnail &&
      !thumbnailUrl &&
      !thumbnailLoading &&
      !thumbnailFailed
    ) {
      onFetchThumbnail(page.id);
    }
  }, [page.id, page.code_language, onFetchThumbnail, thumbnailUrl, thumbnailLoading, thumbnailFailed]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const resourceType =
    page.code_language === "mermaid"
      ? { label: "Diagram", color: "#10b981", bgColor: "rgba(16,185,129,0.15)" }
      : page.code_language === "tsx"
        ? { label: "Page", color: "#3b82f6", bgColor: "rgba(59,130,246,0.15)" }
        : { label: page.code_language, color: "var(--gen-muted-fg)", bgColor: "var(--gen-muted)" };
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderColor: selected ? "var(--gen-primary)" : isDragging ? "var(--gen-primary)" : "var(--gen-border)",
    borderWidth: selected || isDragging ? 2 : 1,
    borderStyle: isDragging ? "dashed" : "solid",
    background: "var(--gen-background)",
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.15)" : undefined,
    zIndex: isDragging ? 1000 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-lg overflow-hidden border flex flex-col"
    >
      {/* Thumbnail area */}
      <div
        role={(page.code_language === "tsx" || page.code_language === "mermaid") && onThumbnailClick ? "button" : undefined}
        tabIndex={(page.code_language === "tsx" || page.code_language === "mermaid") && onThumbnailClick ? 0 : undefined}
        onClick={
          (page.code_language === "tsx" || page.code_language === "mermaid") && onThumbnailClick
            ? (e) => {
                e.stopPropagation();
                onThumbnailClick(page.id, page.name || "page");
              }
            : undefined
        }
        onKeyDown={
          (page.code_language === "tsx" || page.code_language === "mermaid") && onThumbnailClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onThumbnailClick(page.id, page.name || "page");
                }
              }
            : undefined
        }
        className={`relative aspect-video flex items-center justify-center flex-shrink-0 ${
          (page.code_language === "tsx" || page.code_language === "mermaid") && onThumbnailClick ? "cursor-pointer" : ""
        }`}
        style={{
          background: "var(--gen-muted)",
          borderBottom: "1px solid var(--gen-border)",
        }}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={() => onToggleSelect?.(page.id)}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1 right-1 z-10 w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: "var(--gen-primary)" }}
            title="多选"
          />
        )}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing touch-none transition-all hover:bg-[var(--gen-primary)]/20"
          style={{
            color: "var(--gen-muted-fg)",
            background: isDragging ? "rgba(59,130,246,0.2)" : "var(--gen-background)",
            border: "1px solid var(--gen-border)",
          }}
          title="拖拽排序"
        >
          <GripVertical size={14} style={{ color: "var(--gen-primary)" }} />
          <span className="text-[10px] font-medium" style={{ color: "var(--gen-foreground)" }}>拖拽</span>
        </div>
        {(page.code_language === "tsx" || page.code_language === "mermaid") ? (
          thumbnailLoading ? (
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-muted-fg)" }} />
          ) : thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
          ) : thumbnailFailed && onRetryThumbnail ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
              <ImageOff size={24} style={{ color: "var(--gen-muted-fg)" }} />
              <span className="text-[10px] text-center" style={{ color: "var(--gen-muted-fg)" }}>
                截图加载失败
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryThumbnail(page.id);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium"
                style={{ background: "var(--gen-primary)", color: "#fff" }}
              >
                <RotateCcw size={10} />
                重试
              </button>
            </div>
          ) : page.code_language === "mermaid" ? (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
              <FileCode size={24} style={{ color: "#10b981" }} />
            </div>
          ) : (
            <FileCode size={24} style={{ color: "var(--gen-muted-fg)" }} />
          )
        ) : (
          <FileCode size={24} style={{ color: "var(--gen-muted-fg)" }} />
        )}
      </div>
      {/* Card body */}
      <div className="p-2 flex-1 min-w-0 flex flex-col gap-1.5">
        <p className="text-xs font-medium truncate" style={{ color: "var(--gen-foreground)" }}>
          {page.name}
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
            style={{ color: resourceType.color, background: resourceType.bgColor }}
          >
            {resourceType.label}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {(page.code_language === "tsx" || page.code_language === "mermaid") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(page);
                }}
                className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                style={{ color: "var(--gen-muted-fg)" }}
                title="Preview"
              >
                <Eye size={12} />
              </button>
            )}
            {(page.code_language === "tsx" || page.code_language === "mermaid") && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!projectIdFromRoute) return;
                  setScreenshotLoadingPageIds((prev) => new Set(prev).add(page.id));
                  try {
                    const res = await fetch(
                      `${getBaseUrl()}/api/projects/${encodeURIComponent(projectIdFromRoute)}/pages/${encodeURIComponent(page.id)}/screenshot`
                    );
                    if (!res.ok) throw new Error(res.statusText);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${(page.name || "page").replace(/[/\\?%*:|"<>]/g, "-")}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("截图已下载");
                  } catch {
                    toast.error("截图下载失败");
                  } finally {
                    setScreenshotLoadingPageIds((prev) => {
                      const next = new Set(prev);
                      next.delete(page.id);
                      return next;
                    });
                  }
                }}
                disabled={screenshotLoadingPageIds.has(page.id)}
                className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors disabled:opacity-70"
                style={{ color: "var(--gen-muted-fg)" }}
                title="下载截图"
              >
                {screenshotLoadingPageIds.has(page.id) ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
              </button>
            )}
            {page.code_language === "mermaid" && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!projectIdFromRoute) return;
                  setHtmlExportLoadingPageIds((prev) => new Set(prev).add(page.id));
                  try {
                    const { blob, filename } = await exportPageHtml(projectIdFromRoute, page.id);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("HTML 已导出");
                  } catch {
                    toast.error("HTML 导出失败");
                  } finally {
                    setHtmlExportLoadingPageIds((prev) => {
                      const next = new Set(prev);
                      next.delete(page.id);
                      return next;
                    });
                  }
                }}
                disabled={htmlExportLoadingPageIds.has(page.id)}
                className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors disabled:opacity-70"
                style={{ color: "var(--gen-muted-fg)" }}
                title="导出 HTML"
              >
                {htmlExportLoadingPageIds.has(page.id) ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(e, page.code_block);
              }}
              className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
              style={{ color: "var(--gen-muted-fg)" }}
              title="复制代码"
            >
              <Copy size={12} />
            </button>
            {page.code_language === "tsx" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onSettingsClick(page.id, { top: rect.bottom + 4, left: rect.right + 4 });
                }}
                className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                style={{ color: "var(--gen-muted-fg)" }}
                title="设置默认菜单"
              >
                <Settings2 size={12} />
              </button>
            )}
            <button
              onClick={(e) => onDelete(e, page.id)}
              className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
              style={{ color: "var(--gen-muted-fg)" }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectSidebar({ projectIdFromRoute, initialTab, activeTab: controlledTab, onTabChange, children }: ProjectSidebarProps = {}) {
  const {
    projectId,
    conversationId,
    conversationListVersion,
    pagesListVersion,
    invalidatePagesList,
    setProjectId,
    setConversationId,
    setAppName,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setCustomTheme,
    setModel,
    setKgModel,
    setConversationMode,
    setNavMenuItems,
    setNavBackgroundColor,
    setAppNameFontSize,
    setAppNameColor,
    setCurrentCode,
    setExtraFiles,
    setRenderMode,
    appName,
    logoUrl,
    navLayout,
    theme,
  } = useAppStore();

  const [internalTab, setInternalTab] = useState<ProjectSidebarTab>(initialTab ?? "conversations");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = useCallback(
    (tab: ProjectSidebarTab) => {
      if (onTabChange) onTabChange(tab);
      else setInternalTab(tab);
    },
    [onTabChange]
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [navMenuOpenForConvId, setNavMenuOpenForConvId] = useState<string | null>(null);
  const [navMenuPopoverRect, setNavMenuPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const navMenuPopoverRef = useRef<HTMLDivElement>(null);
  const [previewPage, setPreviewPage] = useState<Page | null>(null);
  const [projectForPreview, setProjectForPreview] = useState<Project | null>(null);
  const [pageSettingsOpenForId, setPageSettingsOpenForId] = useState<string | null>(null);
  const [pageSettingsPopoverRect, setPageSettingsPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const [projectForPages, setProjectForPages] = useState<Project | null>(null);
  const [screenshotLoadingPageIds, setScreenshotLoadingPageIds] = useState<Set<string>>(new Set());
  const [htmlExportLoadingPageIds, setHtmlExportLoadingPageIds] = useState<Set<string>>(new Set());
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [thumbnailLoadingPageIds, setThumbnailLoadingPageIds] = useState<Set<string>>(new Set());
  const [thumbnailFailedPageIds, setThumbnailFailedPageIds] = useState<Set<string>>(new Set());
  const [lightboxPageId, setLightboxPageId] = useState<string | null>(null);
  const [lightboxPageName, setLightboxPageName] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [templateCreatingId, setTemplateCreatingId] = useState<string | null>(null);

  const thumbnailRequestedRef = useRef<Set<string>>(new Set());
  const thumbnailUrlsRef = useRef<Set<string>>(new Set());
  const fetchThumbnail = useCallback(
    async (pageId: string) => {
      const pid = projectIdFromRoute ?? projectId;
      if (!pid || thumbnailRequestedRef.current.has(pageId)) return;
      thumbnailRequestedRef.current.add(pageId);
      setThumbnailLoadingPageIds((prev) => new Set(prev).add(pageId));
      try {
        const res = await fetch(
          `${getBaseUrl()}/api/projects/${encodeURIComponent(pid)}/pages/${encodeURIComponent(pageId)}/screenshot`
        );
        if (!res.ok) throw new Error(res.statusText);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        thumbnailUrlsRef.current.add(url);
        setThumbnailUrls((prev) => ({ ...prev, [pageId]: url }));
      } catch {
        setThumbnailFailedPageIds((prev) => new Set(prev).add(pageId));
      } finally {
        setThumbnailLoadingPageIds((prev) => {
          const next = new Set(prev);
          next.delete(pageId);
          return next;
        });
      }
    },
    [projectIdFromRoute, projectId]
  );

  const retryThumbnail = useCallback(
    (pageId: string) => {
      thumbnailRequestedRef.current.delete(pageId);
      setThumbnailFailedPageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
      fetchThumbnail(pageId);
    },
    [fetchThumbnail]
  );

  // Revoke thumbnail object URLs and reset when leaving Resources tab or project changes
  const prevProjectIdRefForThumb = useRef<string | null>(null);
  const togglePageSelect = useCallback((pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "resources") {
      setSelectedPageIds(new Set());
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbnailUrlsRef.current.clear();
      setThumbnailUrls({});
      setThumbnailFailedPageIds(new Set());
      thumbnailRequestedRef.current.clear();
    }
  }, [activeTab]);

  useEffect(() => {
    if (projectIdFromRoute && prevProjectIdRefForThumb.current !== projectIdFromRoute) {
      prevProjectIdRefForThumb.current = projectIdFromRoute;
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbnailUrlsRef.current.clear();
      setThumbnailUrls({});
      setThumbnailFailedPageIds(new Set());
      thumbnailRequestedRef.current.clear();
    } else if (projectIdFromRoute) {
      prevProjectIdRefForThumb.current = projectIdFromRoute;
    }
  }, [projectIdFromRoute]);

  useEffect(() => {
    return () => {
      thumbnailUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbnailUrlsRef.current.clear();
    };
  }, []);

  const sortableSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!onTabChange && initialTab) setInternalTab(initialTab);
  }, [initialTab, onTabChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const pid = projectIdFromRoute ?? projectId;
        if (pid) setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [projectIdFromRoute, projectId]);

  // Click outside to close nav menu popover
  useEffect(() => {
    if (!navMenuOpenForConvId) return;
    const handleClick = (e: MouseEvent) => {
      if (navMenuPopoverRef.current?.contains(e.target as Node)) return;
      setNavMenuOpenForConvId(null);
      setNavMenuPopoverRect(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [navMenuOpenForConvId]);

  // Clear canvas only when switching from one project to another (not on first entry)
  const prevProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (projectIdFromRoute) {
      if (prevProjectIdRef.current != null && prevProjectIdRef.current !== projectIdFromRoute) {
        prevProjectIdRef.current = projectIdFromRoute;
        setConversationId(null);
        setCurrentCode("");
        setExtraFiles({});
        setRenderMode(null);
      } else {
        prevProjectIdRef.current = projectIdFromRoute;
      }
    }
  }, [projectIdFromRoute, setConversationId, setCurrentCode, setExtraFiles, setRenderMode]);

  // Ensure we have a project and conversation on mount
  useEffect(() => {
    let cancelled = false;

    async function ensureProjectAndConversation() {
      try {
        setLoading(true);
        setError(null);

        let pid = projectIdFromRoute ?? projectId;
        let cid = conversationId;

        // 当项目来自路由（含项目切换）时，始终使用该项目的第一个对话
        if (projectIdFromRoute) {
          cid = null;
        }

        if (pid) {
          setProjectId(pid);
        }

        if (!pid) {
          const existing = await listProjects();
          if (existing.length > 0) {
            pid = existing[0].id;
            setProjectId(pid);
          } else {
            const created = await createProject({
              name: appName,
              logo_url: logoUrl,
              nav_layout: navLayout,
              theme,
            });
            pid = created.id;
            setProjectId(pid);
          }
        }

        if (!cid) {
          const convs = await listConversations(pid!);
          if (convs.length > 0) {
            cid = convs[0].id;
            setConversationId(cid);
            const [msgs, proj] = await Promise.all([listMessages(cid), getProject(pid!)]);
            const lastWithCode = [...msgs].reverse().find((m) => m.code_block);
            if (
              lastWithCode?.code_block &&
              proj.conversation_mode !== "plan" &&
              !cancelled
            ) {
              setCurrentCode(lastWithCode.code_block);
              setExtraFiles({});
              setRenderMode(
                lastWithCode.code_language === "tsx"
                  ? "sandpack"
                  : lastWithCode.code_language === "python"
                    ? "python"
                    : "mermaid"
              );
            }
          } else {
            const created = await createConversation(pid!, "New Conversation");
            cid = created.id;
            setConversationId(cid);
          }
        }

        if (!cancelled) {
          const convs = await listConversations(pid!);
          setConversations(convs);
          // Load project config (project-level) + conversation nav_menu_items (conversation-level)
          const [proj, conv] = await Promise.all([getProject(pid!), getConversation(cid!)]);
          applyProjectConfig(proj);
          applyConversationNavMenu(conv, proj);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load";
          setError(msg);
          toast.error("Failed to load projects", { description: msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    ensureProjectAndConversation();
    return () => { cancelled = true; };
  }, [projectIdFromRoute]);

  // Refresh conversations when project, conversation, or list invalidated
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    listConversations(projectId).then((conv) => {
      if (!cancelled) setConversations(conv);
    });

    return () => { cancelled = true; };
  }, [projectId, conversationId, conversationListVersion]);

  // Load resources when on resources tab
  useEffect(() => {
    if (!projectId || activeTab !== "resources") return;
    let cancelled = false;
    listPages(projectId).then((p) => {
      if (!cancelled) setPages(p);
    });
    return () => { cancelled = true; };
  }, [projectId, activeTab, pagesListVersion]);

  // Load project when opening page preview modal
  useEffect(() => {
    if (!previewPage || !projectIdFromRoute) return;
    let cancelled = false;
    getProject(projectIdFromRoute).then((proj) => {
      if (!cancelled) setProjectForPreview(proj);
    });
    return () => { cancelled = true; };
  }, [previewPage, projectIdFromRoute]);

  // Load project when on Resources tab (for page settings menu items)
  useEffect(() => {
    if (!projectIdFromRoute || activeTab !== "resources") return;
    let cancelled = false;
    getProject(projectIdFromRoute).then((proj) => {
      if (!cancelled) setProjectForPages(proj);
    });
    return () => { cancelled = true; };
  }, [projectIdFromRoute, activeTab]);

  const defaultNavMenuItems = [
    { label: "Dashboard", icon: "LayoutDashboard" },
    { label: "Analytics", icon: "BarChart" },
    { label: "Settings", icon: "Settings" },
  ];

  const applyProjectConfig = (proj: Project) => {
    setAppName(proj.name ?? "GenView Dashboard");
    setLogoUrl(proj.logo_url ?? "");
    setNavLayout((proj.nav_layout ?? "side") as "top" | "side");
    setTheme((proj.theme ?? "modern-b2b") as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy");
    setCustomTheme((proj.custom_theme as unknown as import("@/lib/themes").ThemeTokens) ?? null);
    setModel(proj.model ?? "google/gemini-3.1-pro-preview");
    setKgModel(proj.kg_model ?? null);
    setConversationMode((proj.conversation_mode === "plan" ? "plan" : "agent"));
    setNavBackgroundColor(proj.nav_background_color ?? null);
    setAppNameFontSize(proj.app_name_font_size ?? null);
    setAppNameColor(proj.app_name_color ?? null);
    const baseItems = (proj.nav_menu_items?.length ? proj.nav_menu_items : defaultNavMenuItems).map((it) => {
      const item = it as { label: string; icon?: string; children?: { label: string; icon?: string }[] };
      return {
        label: item.label,
        icon: item.icon ?? undefined,
        ...(item.children ? { children: item.children.map((c) => ({ label: c.label, icon: c.icon ?? undefined })) } : {}),
      };
    });
    setNavMenuItems(baseItems);
  };

  const applyConversationNavMenu = (conv: Conversation, proj: Project) => {
    const baseItems = (proj.nav_menu_items?.length ? proj.nav_menu_items : defaultNavMenuItems).map((it) => {
      const item = it as { label: string; icon?: string; children?: { label: string; icon?: string }[] };
      return {
        label: item.label,
        icon: item.icon ?? undefined,
        ...(item.children ? { children: item.children.map((c) => ({ label: c.label, icon: c.icon ?? undefined })) } : {}),
      };
    });
    const convItems = conv.nav_menu_items ?? [];
    let selectedIdx = 0;
    let flatIdx = 0;
    outer: for (const it of convItems as { label: string; selected?: boolean; children?: { label: string; selected?: boolean }[] }[]) {
      if (it.selected) {
        selectedIdx = flatIdx;
        break;
      }
      if (it.children?.length) {
        for (const ch of it.children) {
          if (ch.selected) {
            selectedIdx = flatIdx;
            break outer;
          }
          flatIdx++;
        }
      } else {
        flatIdx++;
      }
    }
    let idx = 0;
    const withSelected = baseItems.map((it, i) => {
      if (it.children?.length) {
        const ch = it.children.map((c, j) => {
          const sel = idx === selectedIdx;
          idx++;
          return { ...c, selected: sel };
        });
        return { ...it, selected: false, children: ch };
      }
      const sel = idx === selectedIdx;
      idx++;
      return { ...it, selected: sel };
    });
    setNavMenuItems(withSelected);
  };

  const handleNewConversation = async () => {
    if (!projectId) return;
    try {
      const [proj, conv] = await Promise.all([getProject(projectId), createConversation(projectId, "New Conversation")]);
      setConversationId(conv.id);
      setConversations((prev) => [conv, ...prev]);
      applyProjectConfig(proj);
      applyConversationNavMenu(conv, proj);
      if (proj.conversation_mode !== "plan") {
        setCurrentCode("");
        setExtraFiles({});
        setRenderMode(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create";
      setError(msg);
      toast.error("Failed to create conversation", { description: msg });
    }
  };

  const handleSelectConversation = async (cid: string) => {
    setConversationId(cid);
    try {
      const [conv, msgs] = await Promise.all([getConversation(cid), listMessages(cid)]);
      const pid = projectId ?? conv.project_id;
      if (!pid) throw new Error("No project");
      const proj = await getProject(pid);
      applyProjectConfig(proj);
      applyConversationNavMenu(conv, proj);
      if (proj.conversation_mode !== "plan") {
        const lastWithCode = [...msgs].reverse().find((m) => m.code_block);
        if (lastWithCode?.code_block) {
          setCurrentCode(lastWithCode.code_block);
          setExtraFiles({});
          setRenderMode(
            lastWithCode.code_language === "tsx"
              ? "sandpack"
              : lastWithCode.code_language === "python"
                ? "python"
                : "mermaid"
          );
        } else {
          setCurrentCode("");
          setExtraFiles({});
          setRenderMode(null);
        }
      }
    } catch {
      setCurrentCode("");
      setExtraFiles({});
      setRenderMode(null);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, c: Conversation) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateConversation(editingId, { title: editingTitle.trim() });
      setConversations((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, title: editingTitle.trim() } : c))
      );
    } catch (err) {
      toast.error("Failed to rename", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeletePage = async (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    if (!projectId) return;
    if (!confirm("Delete this page?")) return;
    try {
      await deletePage(projectId, pageId);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      toast.success("Page deleted");
    } catch (err) {
      toast.error("Failed to delete page", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !projectId) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const newPages = arrayMove(pages, oldIndex, newIndex);
    setPages(newPages);
    try {
      await Promise.all(
        newPages.map((p, i) => updatePage(projectId, p.id, { sort_order: i }))
      );
      invalidatePagesList();
    } catch (err) {
      setPages(pages);
      toast.error("Failed to reorder pages", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handlePreviewPage = (p: Page) => {
    if (p.code_language !== "tsx" && p.code_language !== "mermaid") {
      toast.info("Only Page and Diagram can be previewed");
      return;
    }
    setPreviewPage(p);
    setProjectForPreview(null);
  };

  const handleSelectPageFromKnowledge = async (pageId: string) => {
    const pid = projectIdFromRoute ?? projectId;
    if (!pid) return;
    const existing = pages.find((p) => p.id === pageId);
    if (existing) {
      handlePreviewPage(existing);
      setActiveTab("resources");
      return;
    }
    try {
      const p = await getPage(pid, pageId);
      handlePreviewPage(p);
      setActiveTab("resources");
    } catch {
      toast.error("无法加载页面");
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, cid: string) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(cid);
      setConversations((prev) => prev.filter((c) => c.id !== cid));
      if (conversationId === cid) {
        const remaining = conversations.filter((c) => c.id !== cid);
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          await handleNewConversation();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setError(msg);
      toast.error("Failed to delete conversation", { description: msg });
    }
  };

  const tabBtn = (tab: ProjectSidebarTab, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-2 py-1 text-xs rounded ${activeTab === tab ? "font-medium" : ""}`}
      style={{
        color: activeTab === tab ? "var(--gen-foreground)" : "var(--gen-muted-fg)",
        background: activeTab === tab ? "var(--gen-muted)" : "transparent",
      }}
    >
      {label}
    </button>
  );

  const showDropdown = ["resources", "timeline", "knowledge", "settings", "design"].includes(activeTab);
  const isNonChatTab = ["resources", "timeline", "knowledge", "settings", "design"].includes(activeTab);
  const isChatTab = activeTab === "conversations";

  return (
    <div
      className={`flex flex-col w-full ${isNonChatTab || isChatTab ? "flex-1 min-h-0" : "flex-shrink-0"}`}
      style={{ borderBottom: isChatTab ? undefined : "1px solid var(--gen-border)" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 min-w-0" style={isChatTab ? { borderBottom: "1px solid var(--gen-border)" } : undefined}>
        {projectIdFromRoute && (
          <Link
            href="/"
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: "var(--gen-muted-fg)" }}
            title="Back to projects"
          >
            <ArrowLeft size={14} />
          </Link>
        )}
        {(projectIdFromRoute ?? projectId) && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
            style={{ color: "var(--gen-muted-fg)", background: "var(--gen-muted)" }}
            title="搜索 (⌘K)"
          >
            <Search size={14} />
            <span className="hidden sm:inline">搜索</span>
            <kbd className="text-[10px] opacity-70">⌘K</kbd>
          </button>
        )}
        <div className="flex gap-0.5 flex-wrap">
          {tabBtn("conversations", "Chat")}
          {tabBtn("resources", "Resources")}
          {projectId && tabBtn("design", "Design")}
          {tabBtn("timeline", "时间线")}
          {tabBtn("knowledge", "知识图谱")}
          {tabBtn("settings", "设置")}
        </div>
      </div>

      {isChatTab ? (
        <div className="flex flex-1 min-h-0 min-w-0">
          <div
            className="flex flex-col w-48 md:w-56 flex-shrink-0 overflow-y-auto px-3 py-3"
            style={{ borderRight: "1px solid var(--gen-border)", background: "var(--gen-background)" }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
              </div>
            ) : error ? (
              <p className="text-xs py-4" style={{ color: "var(--gen-muted-fg)" }}>{error}</p>
            ) : (
              <>
                <button
                  onClick={handleNewConversation}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-2"
                  style={{ background: "var(--gen-primary)", color: "#fff" }}
                >
                  <MessageSquarePlus size={14} />
                  New Conversation
                </button>
                <div className="space-y-0.5">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => !editingId && handleSelectConversation(c.id)}
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        background: conversationId === c.id ? "var(--gen-muted)" : "transparent",
                        color: conversationId === c.id ? "var(--gen-foreground)" : "var(--gen-muted-fg)",
                      }}
                    >
                      {editingId === c.id ? (
                        <input
                          className="flex-1 min-w-0 text-xs px-2 py-1 rounded border"
                          style={{ background: "var(--gen-background)", color: "var(--gen-foreground)", borderColor: "var(--gen-border)" }}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span className="flex-1 truncate text-xs">{c.title}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const target = e.currentTarget as HTMLElement;
                              await handleSelectConversation(c.id);
                              const rect = target.getBoundingClientRect();
                              setNavMenuPopoverRect({ top: rect.bottom + 4, left: rect.right + 4 });
                              setNavMenuOpenForConvId(c.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                            style={{ color: "var(--gen-muted-fg)" }}
                            title="Navigation Menu"
                          >
                            <Settings2 size={12} />
                          </button>
                          <button
                            onClick={(e) => handleStartEdit(e, c)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                            style={{ color: "var(--gen-muted-fg)" }}
                            title="Rename"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteConversation(e, c.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                            style={{ color: "var(--gen-muted-fg)" }}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {children}
          </div>
        </div>
      ) : showDropdown ? (
        <div
          className={`overflow-y-auto px-4 py-3 min-w-0 ${isNonChatTab ? "flex-1 min-h-0" : "flex-shrink-0"}`}
          style={isNonChatTab ? { borderTop: "1px solid var(--gen-border)", background: "var(--gen-background)" } : { maxHeight: "50vh", borderTop: "1px solid var(--gen-border)", background: "var(--gen-background)" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
            </div>
          ) : error ? (
            <p className="text-xs py-4" style={{ color: "var(--gen-muted-fg)" }}>
              {error}
            </p>
          ) : activeTab === "settings" ? (
            <ProjectSettingsPanel key="settings" />
          ) : activeTab === "timeline" ? (
            <ProjectTimelinePanel key="timeline" projectId={projectIdFromRoute ?? projectId} />
          ) : activeTab === "knowledge" ? (
            <ProjectKnowledgePanel
              key="knowledge"
              projectId={projectIdFromRoute ?? projectId ?? ""}
              onSelectConversation={(id) => {
                setActiveTab("conversations");
                handleSelectConversation(id);
              }}
              onSelectPage={handleSelectPageFromKnowledge}
            />
          ) : activeTab === "design" ? (
            <ProjectDesignPanel key="design" projectId={projectIdFromRoute ?? projectId} />
          ) : (
            <Fragment key="resources">
              {selectedPageIds.size > 0 && (
                <div
                  className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
                  style={{ background: "var(--gen-muted)", border: "1px solid var(--gen-border)" }}
                >
                  <span className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                    已选 {selectedPageIds.size} 项
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const pid = projectIdFromRoute ?? projectId;
                      if (!pid) return;
                      const ids = [...selectedPageIds];
                      try {
                        for (const id of ids) await deletePage(pid, id);
                        setPages((prev) => prev.filter((p) => !selectedPageIds.has(p.id)));
                        setSelectedPageIds(new Set());
                        invalidatePagesList();
                        toast.success(`已删除 ${ids.length} 个页面`);
                      } catch {
                        toast.error("批量删除失败");
                      }
                    }}
                    className="px-2 py-1 text-xs rounded"
                    style={{ background: "rgba(239,68,68,0.2)", color: "#dc2626" }}
                  >
                    批量删除
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const pid = projectIdFromRoute ?? projectId;
                      if (!pid) return;
                      const mermaidPages = pages.filter((p) => p.code_language === "mermaid" && selectedPageIds.has(p.id));
                      if (mermaidPages.length === 0) {
                        toast.error("请选择 Mermaid 页面");
                        return;
                      }
                      setHtmlExportLoadingPageIds((prev) => new Set([...prev, ...mermaidPages.map((p) => p.id)]));
                      try {
                        for (const p of mermaidPages) {
                          const { blob, filename } = await exportPageHtml(pid, p.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        }
                        toast.success(`已导出 ${mermaidPages.length} 个 HTML`);
                      } catch {
                        toast.error("批量导出失败");
                      } finally {
                        setHtmlExportLoadingPageIds((prev) => {
                          const next = new Set(prev);
                          mermaidPages.forEach((p) => next.delete(p.id));
                          return next;
                        });
                      }
                    }}
                    className="px-2 py-1 text-xs rounded"
                    style={{ background: "var(--gen-primary)", color: "#fff" }}
                  >
                    批量导出 HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPageIds(new Set())}
                    className="px-2 py-1 text-xs rounded"
                    style={{ color: "var(--gen-muted-fg)" }}
                  >
                    取消选择
                  </button>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {PAGE_TEMPLATES.map((tpl) => {
                    const Icon = tpl.id === "blank-dashboard" ? LayoutDashboard : tpl.id === "chart-page" ? BarChart3 : tpl.id === "table-page" ? Table : GitBranch;
                    const creating = templateCreatingId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        disabled={creating || !(projectIdFromRoute ?? projectId)}
                        onClick={async () => {
                          const pid = projectIdFromRoute ?? projectId;
                          if (!pid) return;
                          setTemplateCreatingId(tpl.id);
                          try {
                            const created = await createPage(pid, {
                              name: tpl.name,
                              code_block: tpl.code_block,
                              code_language: tpl.code_language,
                              extra_files: tpl.extra_files,
                            });
                            setPages((prev) => [...prev, created]);
                            invalidatePagesList();
                            toast.success(`已创建「${tpl.name}」`);
                          } catch {
                            toast.error("创建失败");
                          } finally {
                            setTemplateCreatingId(null);
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: "var(--gen-muted)",
                          color: "var(--gen-foreground)",
                          border: "1px solid var(--gen-border)",
                          opacity: creating ? 0.7 : 1,
                        }}
                        title={tpl.description}
                      >
                        {creating ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                        {tpl.name}
                      </button>
                    );
                  })}
                </div>
                <div className={pages.length === 0 ? "" : "grid grid-cols-4 gap-3"}>
                {pages.length === 0 ? (
                  <p className="text-xs py-4" style={{ color: "var(--gen-muted-fg)" }}>
                    暂无资源。可从上方模板创建，或在对话中保存。
                  </p>
                ) : (
                  <DndContext
                    sensors={sortableSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                      {pages.map((p) => (
                        <SortablePageCard
                          key={p.id}
                          page={p}
                          projectIdFromRoute={projectIdFromRoute}
                          screenshotLoadingPageIds={screenshotLoadingPageIds}
                          setScreenshotLoadingPageIds={setScreenshotLoadingPageIds}
                          htmlExportLoadingPageIds={htmlExportLoadingPageIds}
                          setHtmlExportLoadingPageIds={setHtmlExportLoadingPageIds}
                          onPreview={handlePreviewPage}
                          onDelete={handleDeletePage}
                          selected={selectedPageIds.has(p.id)}
                          onToggleSelect={togglePageSelect}
                          onThumbnailClick={(pageId, pageName) => {
                            setLightboxPageId(pageId);
                            setLightboxPageName(pageName);
                            if (!thumbnailUrls[pageId] && !thumbnailLoadingPageIds.has(pageId)) {
                              fetchThumbnail(pageId);
                            }
                          }}
                          thumbnailUrl={thumbnailUrls[p.id]}
                          thumbnailLoading={thumbnailLoadingPageIds.has(p.id)}
                          thumbnailFailed={thumbnailFailedPageIds.has(p.id)}
                          onFetchThumbnail={fetchThumbnail}
                          onRetryThumbnail={retryThumbnail}
                          onCopy={async (e, code) => {
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(code);
                              toast.success("已复制");
                            } catch {
                              toast.error("复制失败");
                            }
                          }}
                          onSettingsClick={(pageId, rect) => {
                            setPageSettingsOpenForId(pageId);
                            setPageSettingsPopoverRect(rect);
                          }}
                          getBaseUrl={getBaseUrl}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
                </div>
              </div>
            </Fragment>
          )}
        </div>
      ) : null}
      {navMenuOpenForConvId &&
        navMenuPopoverRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={navMenuPopoverRef}
            className="fixed rounded-lg shadow-lg z-[9999] min-w-[200px] max-h-[70vh] overflow-y-auto"
            style={{
              top: navMenuPopoverRect.top,
              left: navMenuPopoverRect.left,
              background: "var(--gen-background)",
              border: "1px solid var(--gen-border)",
            }}
          >
            <ConversationNavMenuPanel
              conversationId={navMenuOpenForConvId}
              conversationTitle={conversations.find((c) => c.id === navMenuOpenForConvId)?.title ?? "Conversation"}
              onClose={() => {
                setNavMenuOpenForConvId(null);
                setNavMenuPopoverRect(null);
              }}
            />
          </div>,
          document.body
        )}

      {/* Page default menu settings popover */}
      {pageSettingsOpenForId &&
        pageSettingsPopoverRect &&
        pages.find((p) => p.id === pageSettingsOpenForId) &&
        typeof document !== "undefined" &&
        createPortal(
          <PageDefaultMenuPopover
            page={pages.find((p) => p.id === pageSettingsOpenForId)!}
            project={projectForPages}
            onClose={() => {
              setPageSettingsOpenForId(null);
              setPageSettingsPopoverRect(null);
            }}
            onSelect={async (label) => {
              if (!projectIdFromRoute) return;
              try {
                await updatePage(projectIdFromRoute, pageSettingsOpenForId, { nav_label: label });
                setPages((prev) =>
                  prev.map((p) => (p.id === pageSettingsOpenForId ? { ...p, nav_label: label } : p))
                );
                invalidatePagesList();
                toast.success("已设置默认菜单");
              } catch (err) {
                toast.error("设置失败", { description: err instanceof Error ? err.message : "Unknown error" });
              } finally {
                setPageSettingsOpenForId(null);
                setPageSettingsPopoverRect(null);
              }
            }}
            rect={pageSettingsPopoverRect}
          />,
          document.body
        )}

      {/* Page Preview Modal */}
      {previewPage &&
        typeof document !== "undefined" &&
        createPortal(
          <PagePreviewModal
            page={previewPage}
            project={projectForPreview}
            projectId={projectIdFromRoute ?? null}
            onClose={() => {
              setPreviewPage(null);
              setProjectForPreview(null);
            }}
            onSaved={(updatedPage) => {
              setPages((prev) => prev.map((p) => (p.id === updatedPage.id ? updatedPage : p)));
              setPreviewPage(updatedPage);
            }}
          />,
          document.body
        )}

      {/* Thumbnail Lightbox */}
      {lightboxPageId &&
        typeof document !== "undefined" &&
        createPortal(
          <ThumbnailLightbox
            imageUrl={thumbnailUrls[lightboxPageId]}
            loading={thumbnailLoadingPageIds.has(lightboxPageId)}
            pageName={lightboxPageName}
            onClose={() => {
              setLightboxPageId(null);
              setLightboxPageName("");
            }}
          />,
          document.body
        )}

      {/* Project Search Modal */}
      {(projectIdFromRoute ?? projectId) && (
        <ProjectSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          projectId={projectIdFromRoute ?? projectId!}
          onSelectConversation={handleSelectConversation}
          onSelectPage={() => {}}
          onSelectTimeline={() => {}}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  );
}

function PageSaveButton({
  projectId,
  page,
  onSaved,
}: {
  projectId: string | null;
  page: Page;
  onSaved?: (updatedPage: Page) => void;
}) {
  const { sandpack } = useSandpack();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const files = sandpack.files as Record<string, { code: string }>;
      const code = files["/DashboardContent.tsx"]?.code ?? page.code_block;
      const extraPaths = ["/App.tsx", "/Layout.tsx", "/globals.css", "/index.tsx", "/DashboardContent.tsx"];
      const extraFiles: Record<string, string> = {};
      for (const [path, file] of Object.entries(files)) {
        if (!extraPaths.includes(path) && path.startsWith("/")) {
          const key = path.slice(1);
          extraFiles[key] = file.code;
        }
      }
      const updated = await updatePage(projectId, page.id, {
        code_block: code,
        ...(Object.keys(extraFiles).length > 0 ? { extra_files: extraFiles } : {}),
      });
      toast.success("已保存");
      onSaved?.(updated);
    } catch (err) {
      toast.error("保存失败", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors disabled:opacity-50"
      style={{
        background: "var(--gen-primary)",
        color: "#fff",
      }}
    >
      <Save size={12} />
      {saving ? "保存中..." : "保存"}
    </button>
  );
}

function PagePreviewSandpackContent({ mode }: { mode: "preview" | "edit" }) {
  if (mode === "preview") {
    return (
      <SandpackLayout>
        <SandpackPreview
          style={{ height: "100%", flex: 1, minHeight: 0 }}
          showNavigator={false}
          showRefreshButton
        />
      </SandpackLayout>
    );
  }
  return (
    <SandpackLayout>
      <div className="h-full min-h-0 flex-1 flex flex-col">
        <SandpackCodeEditor
          style={{ flex: 1, minHeight: 0, height: "100%" }}
          showLineNumbers
          showTabs
        />
      </div>
      <div className="h-full min-h-0 flex-1 flex flex-col">
        <SandpackPreview
          style={{ flex: 1, minHeight: 0 }}
          showNavigator={false}
          showRefreshButton
        />
      </div>
    </SandpackLayout>
  );
}

function PageDefaultMenuPopover({
  page,
  project,
  onClose,
  onSelect,
  rect,
}: {
  page: Page;
  project: Project | null;
  onClose: () => void;
  onSelect: (label: string) => void | Promise<void>;
  rect: { top: number; left: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const defaultItems = [
    { label: "Dashboard", icon: "LayoutDashboard" },
    { label: "Analytics", icon: "BarChart" },
    { label: "Settings", icon: "Settings" },
  ];
  const navLayout = (project?.nav_layout ?? "side") as "top" | "side";
  const cfg = project?.nav_config as { items?: import("@/lib/api").NavConfigItem[]; top?: { pageId: string; label: string }[]; side?: { pageId: string; label: string }[] } | undefined;
  const configItems = (cfg?.items && Array.isArray(cfg.items))
    ? flattenNavConfigItems(cfg.items)
    : ((cfg?.[navLayout] ?? []) as { pageId: string; label: string }[]);
  const menuItems =
    configItems.length > 0
      ? configItems.map((item) => item.label)
      : flattenNavMenuLabels(project?.nav_menu_items ?? defaultItems);
  const uniqueLabels = [...new Set(menuItems)];

  return (
    <div
      ref={ref}
      className="fixed rounded-lg shadow-lg z-[9999] min-w-[160px] max-h-[50vh] overflow-y-auto py-1"
      style={{
        top: rect.top,
        left: rect.left,
        background: "var(--gen-background)",
        border: "1px solid var(--gen-border)",
      }}
    >
      <div className="px-3 py-1.5 text-[10px] font-medium" style={{ color: "var(--gen-muted-fg)" }}>
        默认选中菜单
      </div>
      {uniqueLabels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(label)}
          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--gen-muted)] transition-colors flex items-center gap-2"
          style={{
            color: page.nav_label === label ? "var(--gen-primary)" : "var(--gen-foreground)",
            fontWeight: page.nav_label === label ? 600 : 400,
          }}
        >
          {page.nav_label === label && <span className="text-[10px]">✓</span>}
          {label}
        </button>
      ))}
    </div>
  );
}

function PagePreviewModal({
  page,
  project,
  projectId,
  onClose,
  onSaved,
}: {
  page: Page;
  project: Project | null;
  projectId: string | null;
  onClose: () => void;
  onSaved?: (updatedPage: Page) => void;
}) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedMermaidCode, setEditedMermaidCode] = useState(page.code_block);
  const [mermaidSaving, setMermaidSaving] = useState(false);

  useEffect(() => {
    setEditedMermaidCode(page.code_block);
    setMode("preview");
  }, [page.id, page.code_block]);

  const toggleFullscreen = useCallback(() => {
    if (!previewRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      previewRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="gen-page-preview-modal rounded-lg overflow-hidden shadow-xl w-[calc(100vw-24px)] max-w-none mx-3 flex flex-col h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)]"
        style={{
          background: "var(--gen-background)",
          border: "1px solid var(--gen-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!project && page.code_language !== "mermaid" ? (
          <>
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-2"
              style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
            >
              <span className="text-sm font-medium truncate">预览: {page.name}</span>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
            </div>
          </>
        ) : page.code_language === "mermaid" ? (
          <>
            <div
              className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-2"
              style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
            >
              <span className="text-sm font-medium truncate">
                {mode === "preview" ? "预览" : "编辑"}: {page.name}
              </span>
              <div className="flex items-center gap-1">
                {mode === "preview" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("edit")}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                      style={{ color: "var(--gen-muted-fg)" }}
                    >
                      <Pencil size={12} />
                      编辑代码
                    </button>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                      style={{ color: "var(--gen-muted-fg)" }}
                      title={isFullscreen ? "退出全屏 (Esc)" : "全屏预览"}
                    >
                      {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      全屏
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("preview")}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                      style={{ color: "var(--gen-muted-fg)" }}
                    >
                      <Eye size={12} />
                      预览
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!projectId) return;
                        setMermaidSaving(true);
                        try {
                          const updated = await updatePage(projectId, page.id, { code_block: editedMermaidCode });
                          toast.success("已保存");
                          onSaved?.(updated);
                        } catch (err) {
                          toast.error("保存失败", { description: err instanceof Error ? err.message : "Unknown error" });
                        } finally {
                          setMermaidSaving(false);
                        }
                      }}
                      disabled={mermaidSaving}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors disabled:opacity-50"
                      style={{ background: "var(--gen-primary)", color: "#fff" }}
                    >
                      <Save size={12} />
                      {mermaidSaving ? "保存中..." : "保存"}
                    </button>
                  </>
                )}
                <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div
              ref={previewRef}
              className="flex-1 min-h-0 overflow-hidden flex flex-col p-4"
              style={{ minHeight: "calc(100dvh - 6rem)", height: "calc(100dvh - 6rem)" }}
            >
              {mode === "preview" ? (
                <MermaidPreview code={editedMermaidCode} showCode={false} />
              ) : (
                <div className="flex-1 flex min-h-0 gap-4">
                  <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <label className="text-xs font-medium mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                      Mermaid 代码
                    </label>
                    <textarea
                      value={editedMermaidCode}
                      onChange={(e) => setEditedMermaidCode(e.target.value)}
                      className="flex-1 w-full min-h-[200px] p-3 text-sm font-mono rounded-lg resize-none"
                      style={{
                        background: "var(--gen-muted)",
                        color: "var(--gen-foreground)",
                        border: "1px solid var(--gen-border)",
                      }}
                      spellCheck={false}
                      placeholder="graph TD&#10;  A --> B"
                    />
                  </div>
                  <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <label className="text-xs font-medium mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                      预览
                    </label>
                    <div className="flex-1 min-h-0 overflow-hidden rounded-lg" style={{ border: "1px solid var(--gen-border)" }}>
                      <MermaidPreview code={editedMermaidCode} showCode={false} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <SandpackProvider
            key={page.id}
            template="react-ts"
              files={generateSandpackFiles({
                appName: project.name ?? "Preview",
                logoUrl: project.logo_url ?? "",
                navLayout: (project.nav_layout ?? "side") as "top" | "side",
                theme: (project.theme ?? "modern-b2b") as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy",
                customTheme: (project.custom_theme as unknown as import("@/lib/themes").ThemeTokens) ?? null,
                navBackgroundColor: project.nav_background_color ?? null,
                appNameFontSize: project.app_name_font_size ?? null,
                appNameColor: project.app_name_color ?? null,
                navMenuItems: (() => {
                  const cfg = project.nav_config as { items?: import("@/lib/api").NavConfigItem[]; top?: { pageId: string; label: string }[]; side?: { pageId: string; label: string }[] } | undefined;
                  const configItems = (cfg?.items && Array.isArray(cfg.items))
                    ? flattenNavConfigItems(cfg.items)
                    : ((cfg?.side ?? cfg?.top ?? []) as { pageId: string; label: string }[]);
                  const defaultItems = [
                    { label: "Dashboard", icon: "LayoutDashboard" },
                    { label: "Analytics", icon: "BarChart" },
                    { label: "Settings", icon: "Settings" },
                  ];
                  const menuItems = (project.nav_menu_items ?? defaultItems) as { label: string; icon?: string; children?: { label: string; icon?: string }[] }[];
                  const hasExactMatch = configItems.some((c) => c.pageId === page.id);
                  const firstConfigLabel = configItems[0]?.label;
                  return menuItems.map((item) => {
                    const hasChildren = (item.children?.length ?? 0) > 0;
                    if (!hasChildren) {
                      const sel = hasExactMatch ? configItems.some((c) => c.pageId === page.id && c.label === item.label) : (item.label === page.nav_label || (firstConfigLabel === item.label && !page.nav_label));
                      return { label: item.label, icon: item.icon ?? undefined, selected: sel };
                    }
                    return {
                      label: item.label,
                      icon: item.icon ?? undefined,
                      selected: false,
                      children: (item.children ?? []).map((ch) => ({
                        label: ch.label,
                        icon: ch.icon ?? undefined,
                        selected: hasExactMatch
                          ? configItems.some((c) => c.pageId === page.id && c.label === ch.label)
                          : (ch.label === page.nav_label || (firstConfigLabel === ch.label && !page.nav_label)),
                      })),
                    };
                  });
                })(),
                contentCode: page.code_block,
                extraFiles: (page.extra_files as Record<string, string>) ?? undefined,
              })}
              customSetup={{
                dependencies: {
                  recharts: "^2.12.0",
                  echarts: "^5.5.0",
                  "echarts-for-react": "^3.0.2",
                  "lucide-react": "^0.400.0",
                },
              }}
              options={{
                externalResources: ["https://cdn.tailwindcss.com"],
                visibleFiles: ["/DashboardContent.tsx"],
                activeFile: "/DashboardContent.tsx",
                classes: {
                  "sp-layout": "gen-sandpack-layout",
                  "sp-editor": "gen-sandpack-editor",
                },
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-2"
                style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-foreground)" }}
              >
                <span className="text-sm font-medium truncate">
                  {mode === "preview" ? "预览" : "编辑"}: {page.name}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {mode === "preview" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode("edit")}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                        style={{ color: "var(--gen-muted-fg)" }}
                      >
                        <Pencil size={12} />
                        编辑代码
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!projectId) return;
                          setScreenshotLoading(true);
                          try {
                            const res = await fetch(
                              `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(page.id)}/screenshot`
                            );
                            if (!res.ok) throw new Error(res.statusText);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${(page.name || "page").replace(/[/\\?%*:|"<>]/g, "-")}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("截图已下载");
                          } catch {
                            toast.error("截图下载失败");
                          } finally {
                            setScreenshotLoading(false);
                          }
                        }}
                        disabled={screenshotLoading}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors disabled:opacity-70"
                        style={{ color: "var(--gen-muted-fg)" }}
                      >
                        {screenshotLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <Download size={12} />
                            下载截图
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                        style={{ color: "var(--gen-muted-fg)" }}
                        title={isFullscreen ? "退出全屏 (Esc)" : "全屏预览"}
                      >
                        {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        全屏
                      </button>
                    </>
                  ) : (
                    <>
                    <button
                      type="button"
                      onClick={() => setMode("preview")}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-[var(--gen-muted)] transition-colors"
                      style={{ color: "var(--gen-muted-fg)" }}
                    >
                      <Eye size={12} />
                      预览
                    </button>
                    <PageSaveButton projectId={projectId} page={page} onSaved={onSaved} />
                  </>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded hover:bg-[var(--gen-muted)] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div
                ref={previewRef}
                className="flex-1 min-h-0 overflow-hidden flex flex-col"
                style={{ minHeight: "calc(100dvh - 6rem)", height: "calc(100dvh - 6rem)" }}
              >
                <PagePreviewSandpackContent mode={mode} />
              </div>
            </SandpackProvider>
        )}
      </div>
    </div>
  );
}
