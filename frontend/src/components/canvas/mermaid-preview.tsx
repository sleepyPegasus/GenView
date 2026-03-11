"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.25;

interface MermaidPreviewProps {
  code: string;
  showCode: boolean;
}

const PADDING = 32; // p-8

export function MermaidPreview({ code, showCode }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [scale, setScale] = useState(1);

  const fitToView = () => {
    const container = scrollContainerRef.current;
    const svgEl = containerRef.current?.querySelector?.("svg");
    if (!container || !svgEl) return;
    const rect = container.getBoundingClientRect();
    const cw = rect.width - PADDING * 2;
    const ch = rect.height - PADDING * 2;
    if (cw <= 0 || ch <= 0) return;
    let sw = 0;
    let sh = 0;
    const svgRect = svgEl.getBBox?.();
    if (svgRect && svgRect.width > 0 && svgRect.height > 0) {
      sw = svgRect.width;
      sh = svgRect.height;
    } else {
      const viewBox = svgEl.getAttribute("viewBox");
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(Number);
        if (parts.length >= 4) {
          sw = parts[2];
          sh = parts[3];
        }
      }
      if (sw <= 0 || sh <= 0) {
        sw = parseInt(svgEl.getAttribute("width") || "0", 10);
        sh = parseInt(svgEl.getAttribute("height") || "0", 10);
      }
    }
    if (sw > 0 && sh > 0) {
      const fit = Math.min(cw / sw, ch / sh);
      setScale(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, fit)));
    }
  };

  useEffect(() => {
    if (!svg) return;
    const timer = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(timer);
  }, [svg]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !svg) return;
    const ro = new ResizeObserver(() => fitToView());
    ro.observe(container);
    return () => ro.disconnect();
  }, [svg]);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });
        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (showCode) {
    return (
      <div className="h-full overflow-auto p-4">
        <pre className="text-sm font-mono whitespace-pre-wrap text-[--gen-foreground] bg-[--gen-muted] rounded-lg p-4">
          {code}
        </pre>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Mermaid Render Error</p>
          <pre className="text-xs text-[--gen-muted-fg] max-w-md overflow-auto">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div
        className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-muted-fg)" }}
      >
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP))}
          disabled={scale <= ZOOM_MIN}
          className="p-1 rounded hover:bg-[var(--gen-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="缩小"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs tabular-nums min-w-[3rem] text-center" style={{ color: "var(--gen-foreground)" }}>
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP))}
          disabled={scale >= ZOOM_MAX}
          className="p-1 rounded hover:bg-[var(--gen-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="放大"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="text-[10px] px-2 py-0.5 rounded hover:bg-[var(--gen-muted)] transition-colors"
          title="适应画布"
        >
          适应画布
        </button>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-0 flex items-center justify-center p-8">
        <div
          ref={containerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
