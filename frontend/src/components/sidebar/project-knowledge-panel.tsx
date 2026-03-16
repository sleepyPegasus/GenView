"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildKnowledgeGraphStream,
  getKnowledgeGraph,
  listKgBuildHistory,
  listKgQueryHistory,
  listKgQuerySessions,
  queryKnowledgeGraph,
  type KgBuildHistoryItem,
  type KgQuerySessionItem,
  type KnowledgeGraphData,
} from "@/lib/api";
import { CheckCircle2, Clock, Database, Loader2, MessageCircle, MessageSquarePlus, Network, Send, X, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface ProjectKnowledgePanelProps {
  projectId: string;
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
  { id: "build" as const, label: "构建", icon: Database },
  { id: "graph" as const, label: "图谱", icon: Network },
  { id: "query" as const, label: "查询", icon: MessageCircle },
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

export function ProjectKnowledgePanel({ projectId }: ProjectKnowledgePanelProps) {
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
  const [activeTab, setActiveTab] = useState<"build" | "graph" | "query">("build");

  const handleBuild = async () => {
    setBuildLoading(true);
    setBuildResult(null);
    setBuildProgress(0);
    setBuildLogs([]);
    try {
      const result = await buildKnowledgeGraphStream(projectId, (event, data) => {
        if (event === "log" && typeof data.message === "string") {
          setBuildLogs((prev) => [...prev, data.message]);
        } else if (event === "progress" && typeof data.percent === "number") {
          setBuildProgress(data.percent);
        }
      });
      setBuildResult(result);
      toast.success(`构建完成，共 ${result.doc_count} 个文档`);
      setGraphData(null);
      setGraphLoading(true);
      const data = await getKnowledgeGraph(projectId, 500);
      setGraphData(data);
    } catch (err) {
      toast.error("构建失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBuildLoading(false);
      setGraphLoading(false);
      loadBuildHistory();
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

  const handleSend = async () => {
    const q = inputText.trim();
    if (!q || queryLoading) return;
    setInputText("");
    const userMsg: KgChatMessage = { id: `u-${Date.now()}`, role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setQueryLoading(true);
    try {
      const { answer, session_id } = await queryKnowledgeGraph(projectId, q, queryMode, selectedSessionId);
      const assistantMsg: KgChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: answer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (!selectedSessionId) setSelectedSessionId(session_id);
      loadQuerySessions();
    } catch (err) {
      const errMsg: KgChatMessage = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: `查询失败：${err instanceof Error ? err.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errMsg]);
      toast.error("查询失败");
    } finally {
      setQueryLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
                <button
                  type="button"
                  onClick={handleBuild}
                  disabled={buildLoading}
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
                  <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>暂无构建记录</p>
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
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
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
                className="absolute inset-0 flex items-center justify-center text-xs px-4 text-center"
                style={{ color: "var(--gen-muted-fg)" }}
              >
                暂无图谱数据，请先构建知识图谱
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
                    <p className="text-xs px-2 py-4 text-center" style={{ color: "var(--gen-muted-fg)" }}>
                      暂无历史对话
                    </p>
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
          <div className="flex items-center gap-2 px-2 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--gen-border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--gen-muted-fg)" }}>
              知识图谱查询
            </span>
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
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: "var(--gen-muted-fg)" }}>
                输入问题，基于项目知识图谱进行检索回答
              </p>
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
            {queryLoading && (
              <div className="flex justify-start">
                <div
                  className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs"
                  style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                >
                  <Loader2 size={12} className="animate-spin" />
                  检索中...
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
