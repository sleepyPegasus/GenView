"use client";

import mammoth from "mammoth";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listTimeline,
  initTimeline,
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
  reorderTimelineEvents,
  uploadTimelineAttachment,
  getBaseUrl,
  type TimelineEvent,
  type TimelineAttachment,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Download,
  Eye,
  GanttChart,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  Circle,
  CircleDot,
  Pencil,
  Paperclip,
  X,
} from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import html2canvas from "html2canvas";

function getAttachmentType(name: string): "image" | "pdf" | "docx" | "office" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const imageExt = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
  const pdfExt = ["pdf"];
  if (imageExt.includes(ext)) return "image";
  if (pdfExt.includes(ext)) return "pdf";
  if (ext === "docx") return "docx";
  if (["doc", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  return "other";
}

function PendingFilePreviewModal({ file, onClose }: { file: File; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const type = getAttachmentType(file.name);

  useEffect(() => {
    if (type === "docx") {
      setDocxLoading(true);
      setDocxError(null);
      file
        .arrayBuffer()
        .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then((r) => {
          setDocxHtml(r.value);
          setDocxLoading(false);
        })
        .catch((e) => {
          setDocxError(e instanceof Error ? e.message : "转换失败");
          setDocxLoading(false);
        });
    } else {
      setDocxHtml(null);
      setDocxError(null);
    }
  }, [file, type]);

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
      aria-label={`预览: ${file.name}`}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      <div
        className="relative z-10 max-w-[95vw] max-h-[95vh] w-full flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        style={{ background: "var(--gen-background)", color: "var(--gen-foreground)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--gen-border)" }}>
          <span className="text-sm font-medium truncate max-w-[80%]">{file.name}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/10">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {type === "image" && url && <img src={url} alt={file.name} className="max-w-full max-h-[80vh] object-contain mx-auto" />}
          {type === "pdf" && url && <iframe src={url} title={file.name} className="w-full h-[80vh] border-0 rounded" />}
          {type === "docx" && (
            <>
              {docxLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
                </div>
              )}
              {docxError && (
                <div className="py-12 text-center text-sm" style={{ color: "var(--gen-muted-fg)" }}>
                  {docxError}
                </div>
              )}
              {docxHtml && !docxLoading && (
                <div
                  className="text-sm leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_table]:border-collapse [&_th]:border [&_td]:border [&_td]:p-2 [&_th]:p-2"
                  style={{ color: "var(--gen-foreground)" }}
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
            </>
          )}
          {(type === "office" || type === "other") && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm mb-4" style={{ color: "var(--gen-muted-fg)" }}>
                该格式暂不支持预览，保存后将可预览
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreviewModal({
  att,
  url,
  onClose,
}: {
  att: TimelineAttachment;
  url: string;
  onClose: () => void;
}) {
  const type = getAttachmentType(att.name);
  const isPublicUrl = url.startsWith("http") && !url.includes("localhost") && !url.includes("127.0.0.1");
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  useEffect(() => {
    if (type === "docx") {
      setDocxLoading(true);
      setDocxError(null);
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
        .then((r) => {
          setDocxHtml(r.value);
          setDocxLoading(false);
        })
        .catch((e) => {
          setDocxError(e instanceof Error ? e.message : "转换失败");
          setDocxLoading(false);
        });
    } else {
      setDocxHtml(null);
      setDocxError(null);
    }
  }, [url, type]);

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
      aria-label={`预览: ${att.name}`}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      <div
        className="relative z-10 max-w-[95vw] max-h-[95vh] w-full flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        style={{ background: "var(--gen-background)", color: "var(--gen-foreground)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--gen-border)" }}>
          <span className="text-sm font-medium truncate max-w-[80%]">{att.name}</span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-1 rounded"
              style={{ color: "var(--gen-primary)" }}
            >
              下载
            </a>
            <button onClick={onClose} className="p-1 rounded hover:bg-black/10">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {type === "image" && (
            <img src={url} alt={att.name} className="max-w-full max-h-[80vh] object-contain mx-auto" />
          )}
          {type === "pdf" && (
            <iframe src={url} title={att.name} className="w-full h-[80vh] border-0 rounded" />
          )}
          {type === "docx" && (
            <>
              {docxLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
                </div>
              )}
              {docxError && (
                <div className="py-12 text-center text-sm" style={{ color: "var(--gen-muted-fg)" }}>
                  {docxError}
                </div>
              )}
              {docxHtml && !docxLoading && (
                <div
                  className="text-sm leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_table]:border-collapse [&_th]:border [&_td]:border [&_td]:p-2 [&_th]:p-2"
                  style={{ color: "var(--gen-foreground)" }}
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
            </>
          )}
          {type === "office" && (
            <>
              {isPublicUrl ? (
                <iframe
                  src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`}
                  title={att.name}
                  className="w-full h-[80vh] border-0 rounded"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm mb-4" style={{ color: "var(--gen-muted-fg)" }}>
                    Excel/PPT 在线预览需要公网可访问的 URL，当前环境请下载后查看
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{ background: "var(--gen-primary)", color: "#fff" }}
                  >
                    下载文件
                  </a>
                </div>
              )}
            </>
          )}
          {type === "other" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm mb-4" style={{ color: "var(--gen-muted-fg)" }}>
                该格式暂不支持在线预览，请下载后查看
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded text-sm font-medium"
                style={{ background: "var(--gen-primary)", color: "#fff" }}
              >
                下载文件
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableTimelineEventItem({
  ev,
  isSelected,
  onSelect,
  onStatusClick,
  statusColor,
  formatDate,
  phaseOptions,
  children,
}: {
  ev: TimelineEvent;
  isSelected: boolean;
  onSelect: () => void;
  onStatusClick: (e: React.MouseEvent) => void;
  statusColor: (s: string | null | undefined) => string;
  formatDate: (d: string | null | undefined) => string;
  phaseOptions: { value: string; label: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ev.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    border: isDragging ? "2px dashed var(--gen-primary)" : undefined,
    borderRadius: isDragging ? 8 : undefined,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.1)" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative -left-[7px] mb-2 cursor-pointer" onClick={onSelect}>
      <div
        className="flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors"
        style={{ background: isSelected ? "var(--gen-muted)" : isDragging ? "rgba(59,130,246,0.08)" : "transparent" }}
      >
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded cursor-grab active:cursor-grabbing touch-none transition-colors hover:bg-[var(--gen-primary)]/15"
          style={{
            color: "var(--gen-muted-fg)",
            border: "1px solid var(--gen-border)",
            background: isDragging ? "rgba(59,130,246,0.15)" : "var(--gen-background)",
          }}
          title="拖拽排序"
        >
          <GripVertical size={12} style={{ color: "var(--gen-primary)" }} />
          <span className="text-[9px] font-medium" style={{ color: "var(--gen-foreground)" }}>拖拽</span>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {ev.type === "phase" ? (
            <button onClick={onStatusClick} className="p-0.5 rounded" title={ev.status === "completed" ? "已完成" : ev.status === "in_progress" ? "进行中" : "待开始"}>
              {ev.status === "completed" ? (
                <CheckCircle2 size={12} style={{ color: statusColor(ev.status) }} />
              ) : ev.status === "in_progress" ? (
                <CircleDot size={12} style={{ color: statusColor(ev.status) }} />
              ) : (
                <Circle size={12} style={{ color: statusColor(ev.status) }} />
              )}
            </button>
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--gen-primary)" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: "var(--gen-foreground)" }}>
            {ev.type === "phase" ? ev.phase_label : ev.title}
          </div>
          <div className="text-[10px]" style={{ color: "var(--gen-muted-fg)" }}>
            {ev.start_date || ev.event_date ? (
              <>
                开始: {formatDate(ev.start_date || ev.event_date)}
                {(ev.end_date || ev.start_date || ev.event_date) && (
                  <> / 结束: {formatDate(ev.end_date || ev.start_date || ev.event_date)}</>
                )}
                {ev.event_time ? ` ${ev.event_time}` : ""}
              </>
            ) : (
              "-"
            )}
          </div>
          {ev.type === "custom" && ev.phase_key && (
            <span
              className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px]"
              style={{
                border: "1px solid var(--gen-primary)",
                color: "var(--gen-primary)",
                background: "rgba(59, 130, 246, 0.1)",
              }}
            >
              {phaseOptions.find((o) => o.value === ev.phase_key)?.label ?? ev.phase_key}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProjectTimelinePanelProps {
  projectId: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "待开始" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" },
];

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB

const DEFAULT_PHASE_OPTIONS = [
  { value: "requirement_research", label: "需求调研" },
  { value: "proposal_design", label: "方案设计" },
  { value: "proposal_review", label: "方案评审" },
  { value: "architecture_design", label: "架构设计" },
  { value: "prototype_design", label: "原型设计" },
  { value: "detailed_design", label: "详细设计" },
];

const PHASE_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const HOLIDAYS: Array<{ name: string; start: string; end: string }> = [
  { name: "春节", start: "2024-02-10", end: "2024-02-17" },
  { name: "春节", start: "2025-01-28", end: "2025-02-04" },
  { name: "春节", start: "2026-02-17", end: "2026-02-24" },
  { name: "国庆", start: "2024-10-01", end: "2024-10-07" },
  { name: "国庆", start: "2025-10-01", end: "2025-10-07" },
  { name: "国庆", start: "2026-10-01", end: "2026-10-07" },
];

type GanttEventItem = {
  eventId: string;
  name: string;
  startTs: number;
  endTs: number;
  startDate: string;
  endDate: string;
  type: "phase" | "custom";
  fill: string;
};
type GanttRowItem = { phaseKey: string; phaseLabel: string; sortOrder: number; events: GanttEventItem[] };

const PIXELS_PER_DAY_MIN = 5;
const PIXELS_PER_DAY_MAX = 100;
const PIXELS_PER_DAY_DEFAULT = 20;

function GanttCanvas({
  ganttRows,
  ganttMinTs,
  ganttMaxTs,
  selectedId,
  onSelect,
}: {
  ganttRows: GanttRowItem[];
  ganttMinTs: number;
  ganttMaxTs: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRectsRef = useRef<Array<{ eventId: string; x: number; y: number; w: number; h: number }>>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(PIXELS_PER_DAY_DEFAULT);

  const LEFT = 120;
  const RIGHT_PADDING = 50;
  const TOP = 28;
  const ROW_H = 32;
  const BAR_H = 24;
  const dayMs = 24 * 60 * 60 * 1000;
  const totalChartWidth = Math.max(400, ((ganttMaxTs - ganttMinTs) / dayMs) * pixelsPerDay);
  const w = LEFT + totalChartWidth + RIGHT_PADDING;
  const h = Math.max(200, TOP + ganttRows.length * ROW_H);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const range = ganttMaxTs - ganttMinTs || 1;
    const toX = (ts: number) => LEFT + ((ts - ganttMinTs) / dayMs) * pixelsPerDay;

    const mutedFg = getComputedStyle(document.documentElement).getPropertyValue("--gen-muted-fg").trim() || "#6b7280";
    const fg = getComputedStyle(document.documentElement).getPropertyValue("--gen-foreground").trim() || "#111827";
    const border = getComputedStyle(document.documentElement).getPropertyValue("--gen-border").trim() || "#e5e7eb";

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--gen-card").trim() || "#fff";
    ctx.fillRect(0, 0, w, h);

    barRectsRef.current = [];

    // X-axis dates
    const days = Math.ceil(range / dayMs);
    const step = days <= 7 ? 1 : days <= 31 ? 7 : Math.ceil(days / 6);
    const ticks: number[] = [];
    for (let d = 0; d <= days; d += step) ticks.push(ganttMinTs + d * dayMs);
    if (ticks[ticks.length - 1] < ganttMaxTs) ticks.push(ganttMaxTs);

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LEFT, TOP);
    ctx.lineTo(LEFT + totalChartWidth, TOP);
    ctx.stroke();

    ctx.fillStyle = mutedFg;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const ts of ticks) {
      const x = toX(ts);
      const label = new Date(ts).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
      ctx.fillText(label, x, TOP - 6);
    }

    // Rows
    ctx.textAlign = "left";
    for (let i = 0; i < ganttRows.length; i++) {
      const row = ganttRows[i];
      const rowY = TOP + 4 + i * ROW_H;

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = fg;
      ctx.fillText(row.phaseLabel, 8, rowY + BAR_H / 2 + 4);

      const barY = rowY + (ROW_H - BAR_H) / 2;
      const events = row.events;
      const textGap = 4;
      for (let j = 0; j < events.length; j++) {
        const ev = events[j];
        const x1 = toX(ev.startTs);
        const x2 = toX(ev.endTs);
        const barW = Math.max(4, x2 - x1);
        const isSelected = ev.eventId === selectedId;

        ctx.fillStyle = ev.fill;
        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, barY, barW, BAR_H);
        }
        ctx.fillRect(x1, barY, barW, BAR_H);

        ctx.font = "10px system-ui, sans-serif";
        const textWidth = ctx.measureText(ev.name).width;
        const padding = 8;
        const fitsInBar = barW > 20 && textWidth <= barW - padding;

        if (fitsInBar) {
          ctx.fillStyle = "#fff";
          ctx.save();
          ctx.beginPath();
          ctx.rect(x1, barY, barW, BAR_H);
          ctx.clip();
          ctx.fillText(ev.name, x1 + 4, barY + BAR_H / 2 + 3);
          ctx.restore();
        } else {
          ctx.fillStyle = fg;
          const textRightEnd = x1 + barW + textGap + textWidth;
          const nextBarStart = j + 1 < events.length ? toX(events[j + 1].startTs) : Infinity;
          const overlapRight = textRightEnd > nextBarStart;
          if (overlapRight && x1 - textGap - textWidth >= LEFT) {
            ctx.textAlign = "right";
            ctx.fillText(ev.name, x1 - textGap, barY + BAR_H / 2 + 3);
            ctx.textAlign = "left";
          } else {
            ctx.fillText(ev.name, x1 + barW + textGap, barY + BAR_H / 2 + 3);
          }
        }

        barRectsRef.current.push({ eventId: ev.eventId, x: x1, y: barY, w: barW, h: BAR_H });
      }
    }

    // 节假日 overlay（斜删除线）- 按行绘制保证 45°
    const chartTop = TOP + 4;
    const spacing = 6;
    for (const h of HOLIDAYS) {
      const startTs = new Date(h.start).getTime();
      const endTs = new Date(h.end).getTime();
      if (endTs < ganttMinTs || startTs > ganttMaxTs) continue;
      const x1 = toX(Math.max(startTs, ganttMinTs));
      const x2 = toX(Math.min(endTs, ganttMaxTs));
      const rectW = x2 - x1;
      if (rectW < 2) continue;

      for (let rowIdx = 0; rowIdx < ganttRows.length; rowIdx++) {
        const rowY = chartTop + rowIdx * ROW_H;
        ctx.fillStyle = "rgba(200, 200, 200, 0.25)";
        ctx.fillRect(x1, rowY, rectW, ROW_H);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x1, rowY, rectW, ROW_H);
        ctx.clip();
        ctx.strokeStyle = "rgba(150, 150, 150, 0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        for (let j = -ROW_H; j < rectW + ROW_H; j += spacing) {
          ctx.beginPath();
          ctx.moveTo(x1 + j, rowY);
          ctx.lineTo(x1 + j + ROW_H, rowY + ROW_H);
          ctx.stroke();
        }
        ctx.restore();
      }

      const chartBottom = chartTop + ganttRows.length * ROW_H;
      const centerX = x1 + rectW / 2;
      const centerY = chartTop + (chartBottom - chartTop) / 2;
      ctx.save();
      ctx.fillStyle = "rgba(100, 100, 100, 0.8)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(h.name, centerX, centerY);
      ctx.restore();
    }

    // 阶段之间的虚线
    for (let i = 0; i < ganttRows.length - 1; i++) {
      const y = TOP + 4 + (i + 1) * ROW_H;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LEFT, y);
      ctx.lineTo(LEFT + totalChartWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }, [ganttRows, ganttMinTs, ganttMaxTs, selectedId, pixelsPerDay]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    scrollEl.addEventListener("wheel", onWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", onWheel);
  }, []);

  const getEventAt = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    const scrollEl = scrollRef.current;
    if (!canvas || !scrollEl) return null;
    const rect = canvas.getBoundingClientRect();
    const logicalX = scrollEl.scrollLeft + (clientX - rect.left);
    const logicalY = scrollEl.scrollTop + (clientY - rect.top);
    const dpr = window.devicePixelRatio || 1;
    const canvasX = logicalX * (canvas.width / dpr) / rect.width;
    const canvasY = logicalY * (canvas.height / dpr) / rect.height;
    for (let i = barRectsRef.current.length - 1; i >= 0; i--) {
      const r = barRectsRef.current[i];
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        return r.eventId;
      }
    }
    return null;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const id = getEventAt(e.clientX, e.clientY);
      if (id) onSelect(id);
    },
    [getEventAt, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const id = getEventAt(e.clientX, e.clientY);
      if (id) {
        canvas.style.cursor = "pointer";
        const ev = ganttRows.flatMap((row) => row.events).find((ev) => ev.eventId === id);
        if (ev) setTooltip({ x: e.clientX, y: e.clientY, text: `${ev.name}：${ev.startDate} — ${ev.endDate}` });
      } else {
        canvas.style.cursor = "default";
        setTooltip(null);
      }
    },
    [getEventAt, ganttRows]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const canvasX = scrollEl.scrollLeft + localX;
      const tsAtCursor = ganttMinTs + ((canvasX - LEFT) / pixelsPerDay) * dayMs;

      const delta = e.deltaY > 0 ? -2 : 2;
      const next = Math.max(PIXELS_PER_DAY_MIN, Math.min(PIXELS_PER_DAY_MAX, pixelsPerDay + delta));
      setPixelsPerDay(next);

      const newCanvasX = LEFT + ((tsAtCursor - ganttMinTs) / dayMs) * next;
      scrollEl.scrollLeft = Math.max(0, newCanvasX - localX);
    },
    [pixelsPerDay, ganttMinTs]
  );

  return (
    <div ref={containerRef} className="relative min-w-[500px]" style={{ minHeight: 200 }}>
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight: 400 }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block"
        />
      </div>
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1.5 rounded text-xs shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 8,
            background: "var(--gen-card)",
            border: "1px solid var(--gen-border)",
            color: "var(--gen-foreground)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

export function ProjectTimelinePanel({ projectId }: ProjectTimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TimelineEvent>>({});
  const [addingCustom, setAddingCustom] = useState(false);
  const [customForm, setCustomForm] = useState({
    title: "",
    start_date: "",
    end_date: "",
    event_time: "",
    phase_key: "",
    description: "",
    outcome: "",
    participants: "",
    tags: "",
    pendingFiles: [] as File[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<TimelineAttachment | null>(null);
  const [previewPendingFile, setPreviewPendingFile] = useState<File | null>(null);
  const [timelineTab, setTimelineTab] = useState<"timeline" | "gantt">("timeline");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  const sortableSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleTimelineDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !projectId) return;
      const sorted = [...events].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const oldIndex = sorted.findIndex((e) => e.id === active.id);
      const newIndex = sorted.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newOrder = arrayMove(sorted, oldIndex, newIndex);
      setEvents(newOrder);
      try {
        await reorderTimelineEvents(projectId, newOrder.map((e) => e.id));
      } catch {
        setEvents(events);
        toast.error("排序失败");
      }
    },
    [projectId, events]
  );

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await listTimeline(projectId);
      setEvents(list);
    } catch {
      toast.error("加载时间线失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInit = async () => {
    if (!projectId) return;
    setInitLoading(true);
    try {
      const list = await initTimeline(projectId);
      setEvents(list);
      toast.success("已初始化默认阶段");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "初始化失败";
      if (msg.includes("already has events")) {
        toast.info("时间线已有内容，无需初始化");
      } else {
        toast.error(msg);
      }
    } finally {
      setInitLoading(false);
    }
  };

  const handleAddCustom = async () => {
    if (!projectId || !customForm.title.trim() || !customForm.start_date) {
      toast.error("请填写标题和开始日期");
      return;
    }
    const endDate = customForm.end_date || customForm.start_date;
    try {
      const ev = await createTimelineEvent(projectId, {
        type: "custom",
        title: customForm.title.trim(),
        start_date: customForm.start_date,
        end_date: endDate,
        event_date: customForm.start_date,
        event_time: customForm.event_time || undefined,
        phase_key: customForm.phase_key || undefined,
        description: customForm.description.trim() || undefined,
        outcome: customForm.outcome.trim() || undefined,
        participants: customForm.participants.trim() || undefined,
        tags: customForm.tags ? customForm.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : undefined,
      });
      const pendingFiles = [...customForm.pendingFiles];
      setAddingCustom(false);
      setCustomForm({ title: "", start_date: "", end_date: "", event_time: "", phase_key: "", description: "", outcome: "", participants: "", tags: "", pendingFiles: [] });
      let attachments: TimelineAttachment[] = [];
      for (const file of pendingFiles) {
        const u = await uploadTimelineAttachment(projectId, ev.id, file);
        attachments.push(u);
      }
      const finalEv = attachments.length > 0 ? await updateTimelineEvent(projectId, ev.id, { attachments }) : ev;
      setEvents((prev) =>
        [...prev, finalEv].sort((a, b) => {
          const da = a.start_date || a.event_date || "9999-12-31";
          const db = b.start_date || b.event_date || "9999-12-31";
          return da.localeCompare(db);
        })
      );
      setSelectedId(finalEv.id);
      toast.success("已添加");
    } catch {
      toast.error("添加失败");
    }
  };

  const handleStartEdit = (ev: TimelineEvent) => {
    setEditingId(ev.id);
    setEditForm({
      title: ev.title ?? "",
      event_date: ev.event_date ?? undefined,
      start_date: ev.start_date ?? undefined,
      end_date: ev.end_date ?? undefined,
      event_time: ev.event_time ?? undefined,
      phase_key: ev.phase_key ?? undefined,
      description: ev.description ?? "",
      outcome: ev.outcome ?? "",
      participants: ev.participants ?? "",
      tags: ev.tags?.join(", ") ?? "",
      status: ev.status ?? undefined,
      start_date: ev.start_date ?? undefined,
      end_date: ev.end_date ?? undefined,
      phase_label: ev.phase_label ?? undefined,
      attachments: ev.attachments ?? [],
    });
  };

  const handleSaveEdit = async () => {
    if (!projectId || !editingId) return;
    const ev = events.find((e) => e.id === editingId);
    if (!ev) return;
    try {
      const payload: Partial<TimelineEvent> = {};
      if (ev.type === "phase") {
        if (editForm.status !== undefined) payload.status = editForm.status;
        payload.start_date = (editForm.start_date as string) || undefined;
        payload.end_date = (editForm.end_date as string) || undefined;
        if (editForm.phase_label !== undefined) payload.phase_label = editForm.phase_label;
      } else {
        payload.title = editForm.title ?? undefined;
        payload.start_date = (editForm.start_date as string) || undefined;
        payload.end_date = (editForm.end_date as string) || undefined;
        payload.event_date = (editForm.start_date as string) || (editForm.event_date as string) || undefined;
        payload.event_time = editForm.event_time ?? undefined;
        payload.phase_key = editForm.phase_key ?? undefined;
        payload.description = editForm.description ?? undefined;
        payload.outcome = editForm.outcome ?? undefined;
        payload.participants = editForm.participants ?? undefined;
        payload.tags = editForm.tags ? editForm.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : undefined;
        payload.attachments = (editForm.attachments as TimelineAttachment[] | undefined) ?? undefined;
      }
      const updated = await updateTimelineEvent(projectId, editingId, payload);
      setEvents((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
      setEditingId(null);
      setEditForm({});
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const handleUploadAttachment = async (eventId: string, file: File) => {
    if (!projectId) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error(`文件 ${file.name} 超过 50MB 限制`);
      return;
    }
    try {
      const att = await uploadTimelineAttachment(projectId, eventId, file);
      setEditForm((f) => ({
        ...f,
        attachments: [...((f.attachments as TimelineAttachment[]) ?? []), att],
      }));
      toast.success("已上传");
    } catch {
      toast.error("上传失败");
    }
  };

  const addPendingFile = (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error(`文件 ${file.name} 超过 50MB 限制`);
      return;
    }
    setCustomForm((f) => ({ ...f, pendingFiles: [...f.pendingFiles, file] }));
  };

  const removeAttachment = (eventId: string | "add", idx: number) => {
    if (eventId === "add") {
      setCustomForm((f) => ({ ...f, pendingFiles: f.pendingFiles.filter((_, i) => i !== idx) }));
    } else if (editingId === eventId) {
      setEditForm((f) => {
        const list = (f.attachments as TimelineAttachment[]) ?? [];
        return { ...f, attachments: list.filter((_, i) => i !== idx) };
      });
    }
  };

  const handleUpdateStatus = async (ev: TimelineEvent, status: string) => {
    if (!projectId || ev.type !== "phase") return;
    try {
      const updated = await updateTimelineEvent(projectId, ev.id, { status });
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)));
      toast.success("已更新");
    } catch {
      toast.error("更新失败");
    }
  };

  const handleDelete = async (ev: TimelineEvent) => {
    if (!projectId) return;
    try {
      await deleteTimelineEvent(projectId, ev.id);
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      setSelectedId((id) => (id === ev.id ? null : id));
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  const formatDate = (d: string | null | undefined) => (d ? d.replace(/-/g, "/") : "-");
  const exportAsMarkdown = useCallback(() => {
    const sorted = [...events].sort((a, b) => {
      const da = a.start_date || a.event_date || "0000-01-01";
      const db = b.start_date || b.event_date || "0000-01-01";
      return db.localeCompare(da);
    });
    const lines: string[] = ["# 时间线摘要\n"];
    for (const ev of sorted) {
      const title = ev.title || ev.phase_label || "事件";
      const dateRange = ev.start_date && ev.end_date && ev.start_date !== ev.end_date
        ? `${formatDate(ev.start_date)} — ${formatDate(ev.end_date)}`
        : formatDate(ev.start_date || ev.event_date);
      lines.push(`## ${title}`);
      lines.push(`- **时间**: ${dateRange}`);
      if (ev.description) lines.push(`- **描述**: ${ev.description}`);
      if (ev.outcome) lines.push(`- **成果**: ${ev.outcome}`);
      if (ev.participants) lines.push(`- **参与人**: ${ev.participants}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出为 Markdown");
  }, [events, formatDate]);

  const exportAsImage = useCallback(async () => {
    const el = timelineContentRef.current;
    if (!el) {
      toast.error("无法获取内容区域");
      return;
    }
    setExporting(true);
    try {
      let dataUrl: string;
      if (timelineTab === "gantt") {
        const ganttCanvas = el.querySelector("canvas");
        if (ganttCanvas && ganttCanvas.width > 0 && ganttCanvas.height > 0) {
          dataUrl = ganttCanvas.toDataURL("image/png");
        } else {
          throw new Error("甘特图画布未就绪");
        }
      } else {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          allowTaint: false,
        });
        dataUrl = canvas.toDataURL("image/png");
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `timeline-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success("已导出为图片");
    } catch (err) {
      console.error("[Timeline export]", err);
      toast.error("导出图片失败");
    } finally {
      setExporting(false);
    }
  }, [timelineTab]);

  const attachmentUrl = (att: TimelineAttachment) =>
    att.url.startsWith("http") ? att.url : getBaseUrl() + (att.url.startsWith("/") ? att.url : "/" + att.url);
  const statusColor = (s: string | null | undefined) => {
    if (s === "completed") return "var(--gen-primary)";
    if (s === "in_progress") return "#f59e0b";
    return "var(--gen-muted-fg)";
  };

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

  const sortedEvents = [...events].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const selectedEv = selectedId ? events.find((e) => e.id === selectedId) : null;
  const phaseOptionsFromEvents = events
    .filter((e) => e.type === "phase" && e.phase_key && e.phase_label)
    .map((e) => ({ value: e.phase_key!, label: e.phase_label! }));
  const phaseOptions = phaseOptionsFromEvents.length > 0 ? phaseOptionsFromEvents : DEFAULT_PHASE_OPTIONS;

  type GanttEvent = {
    eventId: string;
    name: string;
    startTs: number;
    endTs: number;
    startDate: string;
    endDate: string;
    type: "phase" | "custom";
    fill: string;
  };
  type GanttRow = { phaseKey: string; phaseLabel: string; sortOrder: number; events: GanttEvent[] };

  const { ganttRows, ganttMinTs, ganttMaxTs } = (() => {
    const getPhaseLabel = (key: string | null | undefined) =>
      phaseOptions.find((o) => o.value === key)?.label ?? "未指定";
    const phaseColorMap = new Map<string, number>();
    let colorIdx = 0;
    for (const o of phaseOptions) {
      if (!phaseColorMap.has(o.value)) phaseColorMap.set(o.value, colorIdx++ % PHASE_COLORS.length);
    }
    const getPhaseColor = (key: string) => {
      if (!phaseColorMap.has(key)) phaseColorMap.set(key, colorIdx++ % PHASE_COLORS.length);
      return PHASE_COLORS[phaseColorMap.get(key)!];
    };
    const withDates = events.filter((e) => {
      if (e.type === "phase") return e.start_date || e.end_date;
      return e.start_date || e.event_date;
    });
    if (withDates.length === 0) return { ganttRows: [] as GanttRow[], ganttMinTs: 0, ganttMaxTs: 0 };
    const toTs = (d: string) => new Date(d).getTime();
    const toDateStr = (ts: number) => new Date(ts).toISOString().slice(0, 10).replace(/-/g, "/");
    const dayMs = 24 * 60 * 60 * 1000;
    let minTs = Infinity;
    let maxTs = -Infinity;
    const phases = events.filter((e) => e.type === "phase").sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const phaseOrder = new Map(phases.map((p, i) => [p.phase_key ?? "other", i]));
    const byPhase = new Map<string, GanttEvent[]>();
    for (const p of phases) {
      const start = p.start_date || p.end_date;
      if (!start) continue;
      const phaseKey = p.phase_key || "other";
      const phaseLabel = p.phase_label || getPhaseLabel(phaseKey);
      if (!byPhase.has(phaseKey)) byPhase.set(phaseKey, []);
      const end = p.end_date || p.start_date;
      const startTs = toTs(start);
      const endTs = end ? toTs(end) : startTs + dayMs;
      minTs = Math.min(minTs, startTs);
      maxTs = Math.max(maxTs, endTs);
      byPhase.get(phaseKey)!.push({
        eventId: p.id,
        name: phaseLabel,
        startTs,
        endTs,
        startDate: toDateStr(startTs),
        endDate: toDateStr(endTs),
        type: "phase",
        fill: getPhaseColor(phaseKey),
      });
    }
    for (const c of events.filter((e) => e.type === "custom")) {
      const startStr = c.start_date || c.event_date;
      if (!startStr) continue;
      const endStr = c.end_date || c.start_date || c.event_date;
      const phaseKey = c.phase_key || "other";
      const phaseLabel = getPhaseLabel(phaseKey);
      if (!byPhase.has(phaseKey)) byPhase.set(phaseKey, []);
      const startTs = toTs(startStr);
      const endTs = endStr ? toTs(endStr) : startTs + dayMs * 0.5;
      minTs = Math.min(minTs, startTs);
      maxTs = Math.max(maxTs, endTs);
      byPhase.get(phaseKey)!.push({
        eventId: c.id,
        name: c.title || "事件",
        startTs,
        endTs,
        startDate: toDateStr(startTs),
        endDate: toDateStr(endTs),
        type: "custom",
        fill: getPhaseColor(phaseKey),
      });
    }
    const rows: GanttRow[] = Array.from(byPhase.entries()).map(([key, evs]) => ({
      phaseKey: key,
      phaseLabel: getPhaseLabel(key),
      sortOrder: phaseOrder.get(key) ?? 999,
      events: evs.sort((a, b) => a.startTs - b.startTs),
    }));
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return { ganttRows: rows, ganttMinTs: minTs, ganttMaxTs: maxTs + 15 * dayMs };
  })();

  return (
    <div className="flex flex-col min-h-0">
      {events.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
            暂无时间线，可初始化默认阶段或添加自定义事件
          </p>
          <button
            onClick={handleInit}
            disabled={initLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-full"
            style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}
          >
            {initLoading ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            初始化默认阶段
          </button>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: tab bar */}
          <div
            className="flex flex-col w-12 flex-shrink-0 py-2 gap-1"
            style={{ borderRight: "1px solid var(--gen-border)", background: "var(--gen-muted)" }}
          >
            <button
              type="button"
              onClick={() => setTimelineTab("timeline")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded text-[10px] transition-colors"
              style={{
                background: timelineTab === "timeline" ? "var(--gen-primary)" : "transparent",
                color: timelineTab === "timeline" ? "#fff" : "var(--gen-muted-fg)",
              }}
              title="事件线"
            >
              <Calendar size={18} />
              事件线
            </button>
            <button
              type="button"
              onClick={() => setTimelineTab("gantt")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded text-[10px] transition-colors"
              style={{
                background: timelineTab === "gantt" ? "var(--gen-primary)" : "transparent",
                color: timelineTab === "gantt" ? "#fff" : "var(--gen-muted-fg)",
              }}
              title="甘特图"
            >
              <GanttChart size={18} />
              甘特图
            </button>
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--gen-border)" }}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportMenuOpen((o) => !o)}
                  disabled={exporting || events.length === 0}
                  className="flex flex-col items-center gap-0.5 py-2 px-1 rounded text-[10px] w-full transition-colors disabled:opacity-50"
                  style={{ color: "var(--gen-muted-fg)" }}
                  title="导出"
                >
                  {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  导出
                </button>
                {exportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setExportMenuOpen(false)} />
                    <div
                      className="absolute left-full bottom-0 ml-1 py-1 rounded shadow-lg z-20 min-w-[120px]"
                      style={{
                        background: "var(--gen-background)",
                        border: "1px solid var(--gen-border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => { exportAsMarkdown(); setExportMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--gen-muted)]"
                        style={{ color: "var(--gen-foreground)" }}
                      >
                        导出 Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => { exportAsImage(); setExportMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--gen-muted)]"
                        style={{ color: "var(--gen-foreground)" }}
                      >
                        导出图片
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Right: content */}
          <div ref={timelineContentRef} className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {timelineTab === "timeline" ? (
        <div className="flex flex-1 min-h-0 gap-3">
          {/* Left: vertical timeline */}
          <div className="flex flex-col w-[40%] min-w-0 flex-shrink-0 overflow-hidden">
            <button
              onClick={() => { setAddingCustom(true); setSelectedId(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs w-full mb-2 flex-shrink-0"
              style={{ border: "1px dashed var(--gen-border)", color: "var(--gen-muted-fg)" }}
            >
              <Plus size={14} />
              添加自定义事件
            </button>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="relative pl-3" style={{ borderLeft: "2px solid var(--gen-border)" }}>
                <DndContext sensors={sortableSensors} collisionDetection={closestCenter} onDragEnd={handleTimelineDragEnd}>
                  <SortableContext items={sortedEvents.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    {sortedEvents.map((ev, i) => (
                      <Fragment key={ev.id}>
                        {i > 0 && (() => {
                          const prev = sortedEvents[i - 1];
                          const d1 = prev.start_date || prev.event_date || "";
                          const d2 = ev.start_date || ev.event_date || "";
                          if (!d1 || !d2) return null;
                          const days = Math.round(
                            (new Date(d1).getTime() - new Date(d2).getTime()) / (24 * 60 * 60 * 1000)
                          );
                          return (
                            <div
                              className="pl-2 py-1 text-[10px]"
                              style={{ color: "var(--gen-muted-fg)" }}
                            >
                              间隔 {days} 天
                            </div>
                          );
                        })()}
                        <SortableTimelineEventItem
                          ev={ev}
                          isSelected={selectedId === ev.id}
                          onSelect={() => setSelectedId(ev.id)}
                          onStatusClick={(e) => {
                            e.stopPropagation();
                            if (ev.status === "pending") handleUpdateStatus(ev, "in_progress");
                            else if (ev.status === "in_progress") handleUpdateStatus(ev, "completed");
                            else handleUpdateStatus(ev, "in_progress");
                          }}
                          statusColor={statusColor}
                          formatDate={formatDate}
                          phaseOptions={phaseOptions}
                        />
                      </Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
          {/* Right: event detail */}
          <div className="flex-1 min-w-0 overflow-y-auto rounded-lg flex flex-col" style={{ border: "1px solid var(--gen-border)", background: "var(--gen-card)" }}>
            {addingCustom ? (
              <div className="p-3 space-y-2 flex-1">
                <div className="text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>添加自定义事件</div>
                <Input
                  placeholder="事件标题 *"
                  value={customForm.title}
                  onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))}
                  className="text-xs"
                />
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>开始:</span>
                  <Input
                    type="date"
                    value={customForm.start_date}
                    onChange={(e) => setCustomForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="text-xs flex-1"
                  />
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>结束:</span>
                  <Input
                    type="date"
                    value={customForm.end_date}
                    onChange={(e) => setCustomForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="text-xs flex-1"
                  />
                  <Input
                    placeholder="时间 如 14:00"
                    value={customForm.event_time}
                    onChange={(e) => setCustomForm((f) => ({ ...f, event_time: e.target.value }))}
                    className="text-xs w-20"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>所属阶段:</span>
                  <select
                    value={customForm.phase_key}
                    onChange={(e) => setCustomForm((f) => ({ ...f, phase_key: e.target.value }))}
                    className="text-xs flex-1 px-2 py-1 rounded border"
                    style={{ borderColor: "var(--gen-border)", background: "var(--gen-background)", color: "var(--gen-foreground)" }}
                  >
                    <option value="">未指定</option>
                    {phaseOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Input
                  placeholder="参与人"
                  value={customForm.participants}
                  onChange={(e) => setCustomForm((f) => ({ ...f, participants: e.target.value }))}
                  className="text-xs"
                />
                <Textarea
                  placeholder="过程描述（讨论了什么、推进了什么）"
                  value={customForm.description}
                  onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                  className="text-xs min-h-[140px] resize-y"
                />
                <Textarea
                  placeholder="形成的决议 / 结论"
                  value={customForm.outcome}
                  onChange={(e) => setCustomForm((f) => ({ ...f, outcome: e.target.value }))}
                  className="text-xs min-h-[80px] resize-y"
                />
                <Input
                  placeholder="标签，逗号分隔"
                  value={customForm.tags}
                  onChange={(e) => setCustomForm((f) => ({ ...f, tags: e.target.value }))}
                  className="text-xs"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>附件:</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) for (let i = 0; i < files.length; i++) addPendingFile(files[i]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px]"
                      style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                    >
                      <Paperclip size={12} />
                      上传
                    </button>
                  </div>
                  {customForm.pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customForm.pendingFiles.map((file, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                          style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}
                        >
                          <button
                            type="button"
                            onClick={() => setPreviewPendingFile(file)}
                            className="inline-flex items-center gap-0.5 truncate max-w-[120px] hover:underline"
                            style={{ color: "var(--gen-primary)" }}
                            title="预览"
                          >
                            <Eye size={10} />
                            {file.name}
                          </button>
                          <button type="button" onClick={() => removeAttachment("add", i)} className="p-0.5 rounded hover:bg-black/10">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCustom}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ background: "var(--gen-primary)", color: "#fff" }}
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setAddingCustom(false);
                      setCustomForm({ title: "", start_date: "", end_date: "", event_time: "", phase_key: "", description: "", outcome: "", participants: "", tags: "", pendingFiles: [] });
                    }}
                    className="px-3 py-1.5 rounded text-xs"
                    style={{ color: "var(--gen-muted-fg)" }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : selectedEv && editingId === selectedEv.id ? (
              <div className="p-3 space-y-2">
                {selectedEv.type === "phase" ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>状态:</span>
                              <select
                                value={editForm.status ?? selectedEv.status ?? "pending"}
                                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                                className="text-xs px-2 py-1 rounded border flex-1"
                                style={{ borderColor: "var(--gen-border)", background: "var(--gen-background)", color: "var(--gen-foreground)" }}
                              >
                                {STATUS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>开始:</span>
                              <Input
                                type="date"
                                value={editForm.start_date ?? selectedEv.start_date ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value || undefined }))}
                                className="text-xs flex-1"
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>结束:</span>
                              <Input
                                type="date"
                                value={editForm.end_date ?? selectedEv.end_date ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value || undefined }))}
                                className="text-xs flex-1"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <Input
                              placeholder="事件标题"
                              value={editForm.title ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                              className="text-xs"
                            />
                            <div className="flex gap-2 items-center">
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>开始:</span>
                              <Input
                                type="date"
                                value={editForm.start_date ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value || undefined }))}
                                className="text-xs flex-1"
                              />
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>结束:</span>
                              <Input
                                type="date"
                                value={editForm.end_date ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value || undefined }))}
                                className="text-xs flex-1"
                              />
                              <Input
                                placeholder="时间"
                                value={editForm.event_time ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, event_time: e.target.value }))}
                                className="text-xs w-20"
                              />
                            </div>
                            <div className="flex gap-2 items-center">
                              <span className="text-[11px] flex-shrink-0" style={{ color: "var(--gen-muted-fg)" }}>所属阶段:</span>
                              <select
                                value={editForm.phase_key ?? ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, phase_key: e.target.value || undefined }))}
                                className="text-xs flex-1 px-2 py-1 rounded border"
                                style={{ borderColor: "var(--gen-border)", background: "var(--gen-background)", color: "var(--gen-foreground)" }}
                              >
                                <option value="">未指定</option>
                                {phaseOptions.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <Input
                              placeholder="参与人"
                              value={editForm.participants ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, participants: e.target.value }))}
                              className="text-xs"
                            />
                            <Textarea
                              placeholder="过程描述"
                              value={editForm.description ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                              className="text-xs min-h-[140px] resize-y"
                            />
                            <Textarea
                              placeholder="形成的决议 / 结论"
                              value={editForm.outcome ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, outcome: e.target.value }))}
                              className="text-xs min-h-[80px] resize-y"
                            />
                            <Input
                              placeholder="标签，逗号分隔"
                              value={editForm.tags ?? ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                              className="text-xs"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>附件:</span>
                                <input
                                  ref={editFileInputRef}
                                  type="file"
                                  className="hidden"
                                  multiple
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (files) for (let i = 0; i < files.length; i++) handleUploadAttachment(selectedEv.id, files[i]);
                                    e.target.value = "";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => editFileInputRef.current?.click()}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-[11px]"
                                  style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                                >
                                  <Paperclip size={12} />
                                  上传
                                </button>
                              </div>
                              {((editForm.attachments as TimelineAttachment[]) ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {((editForm.attachments as TimelineAttachment[]) ?? []).map((att, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                                      style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(att)}
                                        className="inline-flex items-center gap-0.5 truncate max-w-[120px] hover:underline"
                                        style={{ color: "var(--gen-primary)" }}
                                        title="预览"
                                      >
                                        <Eye size={10} />
                                        {att.name}
                                      </button>
                                      <button type="button" onClick={() => removeAttachment(selectedEv.id, i)} className="p-0.5 rounded hover:bg-black/10">
                                        <X size={10} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 rounded text-xs font-medium"
                            style={{ background: "var(--gen-primary)", color: "#fff" }}
                          >
                            保存
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditForm({}); }}
                            className="px-3 py-1.5 rounded text-xs"
                            style={{ color: "var(--gen-muted-fg)" }}
                          >
                            取消
                          </button>
                        </div>
              </div>
            ) : selectedEv ? (
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--gen-foreground)" }}>
                      {selectedEv.type === "phase" ? selectedEv.phase_label : selectedEv.title}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>
                      {selectedEv.start_date || selectedEv.event_date ? (
                        <>
                          开始: {formatDate(selectedEv.start_date || selectedEv.event_date)}
                          {(selectedEv.end_date || selectedEv.start_date || selectedEv.event_date) && (
                            <> / 结束: {formatDate(selectedEv.end_date || selectedEv.start_date || selectedEv.event_date)}</>
                          )}
                          {selectedEv.event_time ? ` ${selectedEv.event_time}` : ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(selectedEv)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px]"
                      style={{ color: "var(--gen-muted-fg)" }}
                      title="编辑"
                    >
                      <Pencil size={12} />
                      编辑
                    </button>
                    <button
                      onClick={() => { if (confirm("确定删除？")) handleDelete(selectedEv); }}
                      className="p-1 rounded"
                      style={{ color: "var(--gen-muted-fg)" }}
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {selectedEv.type === "phase" ? (
                  <div className="space-y-1 text-[11px]" style={{ color: "var(--gen-muted-fg)" }}>
                    <div>状态: {STATUS_OPTIONS.find((o) => o.value === selectedEv.status)?.label ?? selectedEv.status}</div>
                    {(selectedEv.start_date || selectedEv.end_date) && (
                      <>
                        <div>
                          <span style={{ color: "var(--gen-muted-fg)" }}>开始: </span>
                          <span style={{ color: "var(--gen-foreground)" }}>{formatDate(selectedEv.start_date || selectedEv.end_date)}</span>
                        </div>
                        {selectedEv.end_date && (
                          <div>
                            <span style={{ color: "var(--gen-muted-fg)" }}>结束: </span>
                            <span style={{ color: "var(--gen-foreground)" }}>{formatDate(selectedEv.end_date)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px]">
                    {(selectedEv.start_date || selectedEv.event_date) && (
                      <>
                        <div>
                          <span style={{ color: "var(--gen-muted-fg)" }}>开始: </span>
                          <span style={{ color: "var(--gen-foreground)" }}>{formatDate(selectedEv.start_date || selectedEv.event_date)}</span>
                        </div>
                        {(selectedEv.end_date || selectedEv.start_date || selectedEv.event_date) && (
                          <div>
                            <span style={{ color: "var(--gen-muted-fg)" }}>结束: </span>
                            <span style={{ color: "var(--gen-foreground)" }}>{formatDate(selectedEv.end_date || selectedEv.start_date || selectedEv.event_date)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedEv.phase_key && (
                      <div>
                        <span style={{ color: "var(--gen-muted-fg)" }}>所属阶段: </span>
                        <span style={{ color: "var(--gen-foreground)" }}>
                          {phaseOptions.find((o) => o.value === selectedEv.phase_key)?.label ?? selectedEv.phase_key}
                        </span>
                      </div>
                    )}
                    {selectedEv.description && (
                      <div>
                        <span style={{ color: "var(--gen-muted-fg)" }}>过程: </span>
                        <span style={{ color: "var(--gen-foreground)", whiteSpace: "pre-wrap" }}>{selectedEv.description}</span>
                      </div>
                    )}
                    {selectedEv.outcome && (
                      <div>
                        <span style={{ color: "var(--gen-muted-fg)" }}>决议: </span>
                        <span style={{ color: "var(--gen-foreground)", whiteSpace: "pre-wrap" }}>{selectedEv.outcome}</span>
                      </div>
                    )}
                    {selectedEv.participants && (
                      <div className="flex items-center gap-1">
                        <Users size={10} style={{ color: "var(--gen-muted-fg)" }} />
                        <span style={{ color: "var(--gen-foreground)" }}>{selectedEv.participants}</span>
                      </div>
                    )}
                    {selectedEv.attachments && selectedEv.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedEv.attachments.map((att, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                            style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(att)}
                              className="inline-flex items-center gap-1 hover:underline"
                              style={{ color: "var(--gen-primary)" }}
                              title="预览"
                            >
                              <Eye size={10} />
                              {att.name}
                            </button>
                            <a href={attachmentUrl(att)} target="_blank" rel="noreferrer" className="text-[10px]" title="下载">
                              ↓
                            </a>
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedEv.tags && selectedEv.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedEv.tags.map((t, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: "var(--gen-muted)", color: "var(--gen-muted-fg)" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                点击左侧时间线选择事件
              </div>
            )}
          </div>
        </div>
            ) : ganttRows.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-auto p-3 rounded-lg" style={{ border: "1px solid var(--gen-border)", background: "var(--gen-card)" }}>
                <GanttCanvas
                  ganttRows={ganttRows}
                  ganttMinTs={ganttMinTs}
                  ganttMaxTs={ganttMaxTs}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs" style={{ color: "var(--gen-muted-fg)" }}>
                暂无带日期的事件，无法展示甘特图
              </div>
            )}
          </div>
        </div>
      )}
      {previewAttachment && (
        <AttachmentPreviewModal
          att={previewAttachment}
          url={attachmentUrl(previewAttachment)}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
      {previewPendingFile && (
        <PendingFilePreviewModal file={previewPendingFile} onClose={() => setPreviewPendingFile(null)} />
      )}
    </div>
  );
}
