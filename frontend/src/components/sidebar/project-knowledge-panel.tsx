"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildKnowledgeGraphStream,
  getKgDocCount,
  getKnowledgeGraph,
  kgSimpleSearch,
  listKgBuildHistory,
  listKgQueryHistory,
  listKgQuerySessions,
  queryKnowledgeGraphStream,
  type KgBuildHistoryItem,
  type KgQuerySessionItem,
  type KnowledgeGraphData,
} from "@/lib/api";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Database, Download, Loader2, MessageCircle, MessageSquarePlus, Network, Send, X, XCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface ProjectKnowledgePanelProps {
  projectId: string;
  onSelectConversation?: (id: string) => void;
  onSelectPage?: (id: string) => void;
}

interface KgChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUERY_MODES = [
  { value: "hybrid", label: "混合" },
  { value: "local", label: "局部" },
  { value: "global", label: "全局" },
] as const;

const TABS = [
  { id: "query" as const, label: "查询", icon: MessageCircle },
  { id: "graph" as const, label: "图谱", icon: Network },
  { id: "build" as const, label: "构建", icon: Database },
];

const NODE_TYPE_COLORS: Record<string, string> = {
  Person: "#3b82f6",
  Organization: "#10b981",
  Location: "#f59e0b",
  Concept: "#8b5cf6",
  Creature: "#ec4899",
  Event: "#06b6d4",
  Method: "#14b8a6",
  Content: "#a855f7",
  Data: "#6366f1",
  Artifact: "#f97316",
  NaturalObject: "#22c55e",
  Other: "#94a3b8",
  unknown: "#3b82f6",
  default: "#6b7280",
};

export function ProjectKnowledgePanel({ projectId, onSelectConversation, onSelectPage }: ProjectKnowledgePanelProps) {
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildResult, setBuildResult] = useState<{ doc_count: number } | null>(null);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildHistory, setBuildHistory] = useState<KgBuildHistoryItem[]>([]);
  const buildLogRef = useRef<HTMLDivElement>(null);
  const [queryMode, setQueryMode] = useState<"hybrid" | "local" | "global">("hybrid");
  const [queryLoading, setQueryLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<KgChatMessage[]>([]);
  const [sessions, setSessions] = useState<KgQuerySessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; properties: Record<string, unknown> } | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ centerAt: (x?: number, y?: number, ms?: number) => void; zoom: (scale: number, ms?: number) => void; zoomToFit: (ms?: number, padding?: number) => void } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ w: 400, h: 400 });
  const [activeTab, setActiveTab] = useState<"build" | "graph" | "query">("query");
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [useSimpleSearch, setUseSimpleSearch] = useState(false);
  const [simpleSearchResults, setSimpleSearchResults] = useState<{ query: string; chunks: { id: string; type: string; source_id: string; snippet: string }[] } | null>(null);
  const [thinkingText, setThinkingText] = useState<string>("");
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const loadDocCount = useCallback(async () => {
    try {
      const data = await getKgDocCount(projectId);
      setHasDocuments(data.has_documents);
    } catch {
      setHasDocuments(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || activeTab !== "build") return;
    loadDocCount();
  }, [projectId, activeTab, loadDocCount]);

  const handleBuild = async () => {
    setBuildLoading(true);
    setBuildResult(null);
    setBuildProgress(0);
    setBuildLogs([]);
    try {
      let lastError: { message?: string; suggestion?: string } | null = null;
      const result = await buildKnowledgeGraphStream(projectId, (event, data) => {
        if (event === "log" && typeof data.message === "string") {
          setBuildLogs((prev) => [...prev, data.message]);
        } else if (event === "progress" && typeof data.percent === "number") {
          setBuildProgress(data.percent);
        } else if (event === "error") {
          lastError = {
            message: data.message as string | undefined,
            suggestion: data.suggestion as string | undefined,
          };
        }
      });
      setBuildResult(result);
      if (result.status === "no_documents" || result.doc_count === 0) {
        toast.info("暂无文档，请先添加对话或页面", {
          description: "在对话中生成内容或保存页面到 Resources 后再构建",
          action: {
            label: "前往对话",
            onClick: () => window.location.assign(`/projects/${projectId}?tab=conversations`),
          },
        });
        setHasDocuments(false);
      } else if (result.status === "error") {
        toast.error("构建失败", {
          description: lastError?.suggestion ?? lastError?.message ?? "请查看构建日志",
          action: {
            label: "重试",
            onClick: () => handleBuild(),
          },
        });
      } else {
        toast.success(`构建完成，共 ${result.doc_count} 个文档`);
        setGraphData(null);
        setGraphLoading(true);
        const data = await getKnowledgeGraph(projectId, 500);
        setGraphData(data);
        setHasDocuments(true);
      }
    } catch (err) {
      const desc = err instanceof Error ? err.message : "Unknown error";
      toast.error("构建失败", {
        description: desc,
        action: {
          label: "重试",
          onClick: () => handleBuild(),
        },
      });
    } finally {
      setBuildLoading(false);
      setGraphLoading(false);
      loadBuildHistory();
      loadDocCount();
    }
  };

  useEffect(() => {
    const el = buildLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [buildLogs]);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    setGraphData(null);
    try {
      const data = await getKnowledgeGraph(projectId, 500);
      setGraphData(data);
    } catch (err) {
      toast.error("加载图谱失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setGraphLoading(false);
    }
  }, [projectId]);

  const loadBuildHistory = useCallback(async () => {
    try {
      const data = await listKgBuildHistory(projectId, 10);
      setBuildHistory(data);
    } catch {
      setBuildHistory([]);
    }
  }, [projectId]);

  const loadQuerySessions = useCallback(async () => {
    try {
      const data = await listKgQuerySessions(projectId, 50);
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [projectId]);

  const loadMessagesForSession = useCallback(
    async (sessionId: string | null) => {
      if (!sessionId) {
        setMessages([]);
        return;
      }
      try {
        const data = await listKgQueryHistory(projectId, sessionId, 100);
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
      } catch {
        setMessages([]);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId) return;
    loadGraph();
  }, [projectId, loadGraph]);

  useEffect(() => {
    if (!projectId) return;
    loadBuildHistory();
  }, [projectId, loadBuildHistory]);

  useEffect(() => {
    if (!projectId) return;
    setSelectedSessionId(null);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || activeTab !== "query") return;
    loadQuerySessions();
  }, [projectId, activeTab, loadQuerySessions]);

  useEffect(() => {
    if (!projectId || activeTab !== "query") return;
    loadMessagesForSession(selectedSessionId);
  }, [projectId, activeTab, selectedSessionId, loadMessagesForSession]);

  useEffect(() => {
    if (activeTab !== "graph" || !graphContainerRef.current) return;
    const el = graphContainerRef.current;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 400, height: 400 };
      setGraphSize({ w: Math.max(200, width), h: Math.max(200, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  const hasGraphData = graphData != null && graphData.nodes.length > 0;

  const handleSend = async () => {
    const q = inputText.trim();
    if (!q || queryLoading) return;
    setInputText("");
    const userMsg: KgChatMessage = { id: `u-${Date.now()}`, role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setQueryLoading(true);
    setSimpleSearchResults(null);
    try {
      if (useSimpleSearch || !hasGraphData) {
        const { chunks } = await kgSimpleSearch(projectId, q);
        setSimpleSearchResults({ query: q, chunks });
        const summary = chunks.length > 0
          ? `找到 ${chunks.length} 条相关片段：\n\n${chunks.map((c, i) => `${i + 1}. [${c.type}] ${c.snippet}`).join("\n\n")}`
          : "未找到相关片段";
        const assistantMsg: KgChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: summary,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setThinkingText("");
        const { answer, session_id } = await queryKnowledgeGraphStream(
          projectId,
          q,
          (event, data) => {
            if (event === "log" && typeof data.message === "string") {
              setThinkingText((prev) => (prev ? `${prev}\n` : "") + data.message);
            } else if (event === "step" && typeof data.label === "string") {
              setThinkingText((prev) => (prev ? `${prev}\n\n` : "") + data.label);
            } else if (event === "thinking" && typeof data.text === "string") {
              setThinkingText((prev) => (prev ? `${prev}\n` : "") + data.text);
            }
          },
          queryMode,
          selectedSessionId
        );
        setThinkingText("");
        setThinkingExpanded(false);
        const assistantMsg: KgChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: answer,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (!selectedSessionId) setSelectedSessionId(session_id);
        loadQuerySessions();
      }
    } catch (err) {
      setThinkingText("");
      const errMsg: KgChatMessage = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: `查询失败：${err instanceof Error ? err.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errMsg]);
      toast.error("查询失败");
    } finally {
      setQueryLoading(false);
      setThinkingText("");
      setThinkingExpanded(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingText]);

  const graphForRender = useMemo(() => {
    if (!graphData) {
      return { nodes: [] as { id: string; name: string; type: string; properties: Record<string, unknown> }[], links: [] as { source: string; target: string }[] };
    }
    return {
      nodes: graphData.nodes.map((n) => ({
        id: n.id,
        name: n.label,
        type: ((n.properties?.entity_type ?? n.type ?? n.properties?.type ?? n.label) as string) || "default",
        properties: n.properties,
      })),
      links: graphData.edges.map((e) => ({ source: e.source, target: e.target })),
    };
  }, [graphData]);

  const getNodeColor = useCallback((node: { type?: string }) => {
    const t = (node.type ?? "default").toString();
    const key = Object.keys(NODE_TYPE_COLORS).find(
      (k) => k.toLowerCase() === t.toLowerCase()
    );
    return (key ? NODE_TYPE_COLORS[key] : null) ?? NODE_TYPE_COLORS.default;
  }, []);

  const getNodeVal = useCallback(
    (node: { id: string }) => (node.id === selectedNode?.id ? 2.5 : 1),
    [selectedNode?.id]
  );

  const handleNodeClick = useCallback(
    (node: { id: string; name: string; properties?: Record<string, unknown> }) => {
      setSelectedNode({ id: node.id, label: node.name, properties: node.properties ?? {} });
      const x = (node as { x?: number }).x ?? 0;
      const y = (node as { y?: number }).y ?? 0;
      graphRef.current?.centerAt?.(x, y, 300);
      graphRef.current?.zoom?.(2.5, 300);
    },
    []
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    graphRef.current?.zoomToFit?.(300, 20);
  }, []);

  if (!projectId) {
    return (
      <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
        请先选择项目
      </p>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧 Tab 栏 */}
        <div
          className="flex flex-col w-14 flex-shrink-0 py-1 gap-0.5"
          style={{ borderRight: "1px solid var(--gen-border)" }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded transition-colors"
                style={{
                  background: isActive ? "var(--gen-primary)" : "transparent",
                  color: isActive ? "#fff" : "var(--gen-muted-fg)",
                }}
                title={t.label === "构建" ? "构建知识图谱" : t.label === "图谱" ? "图谱可视化" : "知识图谱查询"}
              >
                <Icon size={18} />
                <span className="text-[10px] leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeTab === "build" && (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--gen-border)" }}>
                {hasDocuments === false && (
                  <p className="text-xs flex-1" style={{ color: "var(--gen-muted-fg)" }}>
                    请先创建对话或保存页面
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={buildLoading || hasDocuments === false}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded font-medium transition-colors disabled:opacity-50"
                  style={{ background: "var(--gen-primary)", color: "#fff" }}
                >
                  {buildLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      构建中...
                    </>
                  ) : (
                    "构建知识图谱"
                  )}
                </button>
                {buildResult && !buildLoading && (
                  <span className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                    已处理 {buildResult.doc_count} 个文档
                  </span>
                )}
              </div>
              {buildLoading && (
                <div className="flex-shrink-0 flex flex-col" style={{ maxHeight: 220, borderBottom: "1px solid var(--gen-border)" }}>
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gen-muted)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${buildProgress}%`, background: "var(--gen-primary)" }}
                      />
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>{buildProgress}%</span>
                  </div>
                  <div
                    ref={buildLogRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1.5 text-xs font-mono leading-relaxed"
                    style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)", minHeight: 100 }}
                  >
                    {buildLogs.length === 0 ? (
                      <span style={{ color: "var(--gen-muted-fg)" }}>等待日志...</span>
                    ) : (
                      buildLogs.map((line, i) => <div key={i} className="whitespace-pre-wrap break-all">{line}</div>)
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <div className="text-xs font-medium mb-2" style={{ color: "var(--gen-muted-fg)" }}>构建历史</div>
                {buildHistory.length === 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>暂无构建记录</p>
                    <p className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>点击上方「构建知识图谱」开始</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {buildHistory.map((h) => {
                      const dt = h.created_at ? new Date(h.created_at) : null;
                      const timeStr = dt ? dt.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
                      const isSuccess = h.status === "success";
                      const isNoDoc = h.status === "no_documents";
                      const docBreakdown = [h.msg_count && `${h.msg_count} 对话`, h.page_count && `${h.page_count} 页面`, h.timeline_count && `${h.timeline_count} 事件`].filter(Boolean).join(" · ");
                      return (
                        <div key={h.id} className="rounded px-2 py-1.5 text-xs" style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}>
                          <div className="flex items-center gap-2">
                            {isSuccess ? <CheckCircle2 size={12} style={{ color: "#10b981", flexShrink: 0 }} /> : isNoDoc ? <Clock size={12} style={{ color: "var(--gen-muted-fg)", flexShrink: 0 }} /> : <XCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />}
                            <span className="flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>{timeStr}</span>
                            {h.duration_seconds != null && (
                              <span className="flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>{h.duration_seconds}s</span>
                            )}
                          </div>
                          <div className="mt-0.5 ml-4">
                            {h.doc_count} 文档
                            {docBreakdown && <span style={{ color: "var(--gen-muted-fg)" }}> · {docBreakdown}</span>}
                            {h.node_count != null && h.edge_count != null && (
                              <span style={{ color: "var(--gen-muted-fg)" }}> · {h.node_count} 节点 · {h.edge_count} 边</span>
                            )}
                            {h.status === "error" && h.error && (
                              <div className="mt-0.5 truncate" style={{ color: "#ef4444" }} title={h.error}>{h.error.slice(0, 50)}{h.error.length > 50 ? "…" : ""}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "graph" && (
            <div className="flex flex-col h-full min-h-0 relative">
              <div className="px-2 py-1.5 text-xs font-medium flex-shrink-0" style={{ color: "var(--gen-muted-fg)", borderBottom: "1px solid var(--gen-border)" }}>
                图谱可视化
                {graphData && (
                  <span className="ml-1">
                    {graphData.nodes.length} 节点 · {graphData.edges.length} 边
                    {graphData.is_truncated && " (已截断)"}
                  </span>
                )}
              </div>
              <div ref={graphContainerRef} className="flex-1 min-h-0 relative" style={{ minHeight: 200 }}>
            {/* 节点详情面板：从左侧滑入 */}
            <div
              className="absolute left-0 top-0 bottom-0 z-10 w-56 flex flex-col shadow-lg transition-transform duration-300 ease-out"
              style={{
                background: "var(--gen-background)",
                borderRight: "1px solid var(--gen-border)",
                transform: selectedNode ? "translateX(0)" : "translateX(-100%)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--gen-border)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>
                  节点详情
                </span>
                {selectedNode && (
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded hover:opacity-80"
                    style={{ color: "var(--gen-muted-fg)" }}
                    aria-label="关闭"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 text-xs">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                        标签
                      </div>
                      <div style={{ color: "var(--gen-foreground)" }}>{selectedNode.label}</div>
                    </div>
                    {Object.keys(selectedNode.properties).length > 0 && (
                      <div>
                        <div className="font-medium mb-1" style={{ color: "var(--gen-muted-fg)" }}>
                          属性
                        </div>
                        <div className="space-y-1" style={{ color: "var(--gen-foreground)" }}>
                          {Object.entries(selectedNode.properties).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>
                                {k}:
                              </span>
                              <span className="break-all">
                                {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: "var(--gen-muted-fg)" }}>点击节点查看详情</p>
                )}
              </div>
            </div>
            {graphLoading ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "var(--gen-background)" }}
              >
                <LoadingSpinner size={24} label="加载图谱..." />
              </div>
            ) : graphData && graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphForRender}
                width={graphSize.w}
                height={graphSize.h}
                nodeLabel="name"
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = (node.name || node.id || "").toString();
                  const displayText = label.length > 10 ? label.slice(0, 10) + "…" : label;
                  if (!displayText) return;
                  const fontSize = 11 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillStyle = "rgba(0,0,0,0.85)";
                  ctx.fillText(displayText, node.x, node.y + 12);
                }}
                nodeCanvasObjectMode={() => "after"}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                nodeColor={getNodeColor}
                nodeVal={getNodeVal}
                linkColor={() => "#94a3b8"}
                enableNodeDrag
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs px-4 text-center"
                style={{ color: "var(--gen-muted-fg)" }}
              >
                <p>暂无图谱数据，请先构建知识图谱</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("build")}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: "var(--gen-primary)", color: "#fff" }}
                >
                  前往构建
                </button>
              </div>
            )}
              </div>
            </div>
          )}

          {activeTab === "query" && (
            <div className="flex flex-1 min-h-0 min-w-0">
              {/* 左侧：历史对话列表 */}
              <div
                className="w-44 flex-shrink-0 flex flex-col"
                style={{ borderRight: "1px solid var(--gen-border)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(null);
                    setMessages([]);
                  }}
                  className="flex items-center gap-2 px-2 py-2 text-xs font-medium m-2 rounded transition-colors"
                  style={{
                    background: "var(--gen-primary)",
                    color: "#fff",
                  }}
                >
                  <MessageSquarePlus size={14} />
                  新建对话
                </button>
                <div className="flex-1 overflow-y-auto px-1 pb-2">
                  {sessions.length === 0 ? (
                    <div className="px-2 py-4 text-center space-y-2">
                      <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                        暂无历史对话
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>
                        在下方输入问题开始查询，将自动创建会话
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          className="w-full text-left px-2 py-2 rounded text-xs truncate block"
                          style={{
                            background: selectedSessionId === s.id ? "var(--gen-muted)" : "transparent",
                            color: "var(--gen-foreground)",
                          }}
                          title={s.title}
                        >
                          {s.title || "新对话"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：当前对话 */}
              <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-2 py-1.5 flex-shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--gen-border)" }}>
            <span className="text-xs font-medium flex-1" style={{ color: "var(--gen-muted-fg)" }}>
              知识图谱查询
            </span>
            {messages.length > 0 && selectedSessionId && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportMenuOpen((o) => !o)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ color: "var(--gen-muted-fg)", background: "var(--gen-muted)" }}
                  title="导出当前会话"
                >
                  <Download size={12} />
                  导出
                </button>
                {exportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden="true"
                      onClick={() => setExportMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-20 min-w-[120px]"
                      style={{
                        background: "var(--gen-background)",
                        border: "1px solid var(--gen-border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const md = messages
                            .map((m) =>
                              m.role === "user"
                                ? `## 问\n\n${m.content}`
                                : `## 答\n\n${m.content}`
                            )
                            .join("\n\n---\n\n");
                          const blob = new Blob([`# 知识图谱查询记录\n\n${md}`], { type: "text/markdown" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `kg-query-${selectedSessionId.slice(0, 8)}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("已导出为 Markdown");
                          setExportMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--gen-muted)]"
                        style={{ color: "var(--gen-foreground)" }}
                      >
                        导出为 Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const txt = messages
                            .map((m) => (m.role === "user" ? `问：\n${m.content}` : `答：\n${m.content}`))
                            .join("\n\n");
                          const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `kg-query-${selectedSessionId.slice(0, 8)}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("已导出为文本");
                          setExportMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--gen-muted)]"
                        style={{ color: "var(--gen-foreground)" }}
                      >
                        导出为文本
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {!hasGraphData && hasDocuments && (
              <span className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                简单搜索（图谱未构建）
              </span>
            )}
            {hasGraphData && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--gen-foreground)" }}>
                <input
                  type="checkbox"
                  checked={useSimpleSearch}
                  onChange={(e) => setUseSimpleSearch(e.target.checked)}
                  className="rounded"
                />
                简单搜索
              </label>
            )}
            {hasGraphData && !useSimpleSearch && (
              <select
                value={queryMode}
                onChange={(e) => setQueryMode(e.target.value as "hybrid" | "local" | "global")}
                className="text-xs px-2 py-1 rounded border flex-shrink-0"
                style={{
                  background: "var(--gen-background)",
                  color: "var(--gen-foreground)",
                  borderColor: "var(--gen-border)",
                }}
              >
                {QUERY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-center py-8 space-y-2 px-4" style={{ color: "var(--gen-muted-fg)" }}>
                {!hasDocuments ? (
                  <>
                    <p>请先创建对话或保存页面到 Resources</p>
                    <p className="text-[11px]">有内容后再构建知识图谱进行查询</p>
                  </>
                ) : !hasGraphData ? (
                  <>
                    <p>图谱未构建，可勾选「简单搜索」对对话和页面做关键词检索</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("build")}
                      className="mt-2 px-3 py-1.5 rounded text-xs font-medium"
                      style={{ background: "var(--gen-primary)", color: "#fff" }}
                    >
                      前往构建图谱
                    </button>
                  </>
                ) : (
                  <p>输入问题，基于项目知识图谱进行检索回答</p>
                )}
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[90%] rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: m.role === "user" ? "var(--gen-primary)" : "var(--gen-muted)",
                    color: m.role === "user" ? "#fff" : "var(--gen-foreground)",
                  }}
                >
                  {m.role === "assistant" ? (
                    <div className="[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_a]:underline [&_a]:text-blue-500">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {simpleSearchResults && simpleSearchResults.chunks.length > 0 && (
              <div className="space-y-2 mt-2">
                <div className="text-xs font-medium" style={{ color: "var(--gen-muted-fg)" }}>
                  相关片段（点击跳转）
                </div>
                <div className="space-y-1.5">
                  {simpleSearchResults.chunks.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (c.type === "message" && onSelectConversation) {
                          onSelectConversation(c.source_id);
                        } else if (c.type === "page" && onSelectPage) {
                          onSelectPage(c.source_id);
                        }
                      }}
                      className="w-full text-left px-3 py-2 rounded text-xs block truncate hover:opacity-90 transition-opacity"
                      style={{
                        background: "var(--gen-muted)",
                        color: "var(--gen-foreground)",
                        border: "1px solid var(--gen-border)",
                      }}
                      title={c.snippet}
                    >
                      <span className="font-medium" style={{ color: "var(--gen-muted-fg)" }}>
                        [{c.type === "message" ? "对话" : "页面"}]
                      </span>{" "}
                      {c.snippet}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {queryLoading && (
              <div className="flex justify-start">
                <div
                  className="rounded-lg px-3 py-2 flex flex-col gap-1.5 text-xs max-w-[90%]"
                  style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                >
                  <button
                    type="button"
                    onClick={() => setThinkingExpanded((e) => !e)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <Loader2 size={12} className="animate-spin flex-shrink-0" />
                    <span className="flex-1 truncate">
                      {thinkingExpanded
                        ? "点击收起日志"
                        : thinkingText
                          ? thinkingText.split("\n").slice(-1)[0] || "检索中..."
                          : "检索中..."}
                    </span>
                    {thinkingExpanded ? (
                      <ChevronDown size={12} className="flex-shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="flex-shrink-0" />
                    )}
                  </button>
                  {thinkingExpanded && thinkingText && (
                    <div
                      className="whitespace-pre-wrap break-words font-mono text-[11px] max-h-[200px] overflow-y-auto"
                    >
                      {thinkingText}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div
            className="flex gap-2 px-3 py-2 flex-shrink-0"
            style={{ borderTop: "1px solid var(--gen-border)" }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入问题..."
              className="flex-1 min-w-0 text-xs px-3 py-2 rounded border"
              style={{
                background: "var(--gen-background)",
                color: "var(--gen-foreground)",
                borderColor: "var(--gen-border)",
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={queryLoading || !inputText.trim()}
              className="flex items-center justify-center w-10 h-9 rounded font-medium transition-colors disabled:opacity-50"
              style={{
                background: "var(--gen-primary)",
                color: "#fff",
              }}
            >
              <Send size={14} />
            </button>
          </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
