"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidPreviewProps {
  code: string;
  showCode: boolean;
}

export function MermaidPreview({ code, showCode }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

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
    <div className="h-full overflow-auto flex items-center justify-center p-8">
      <div
        ref={containerRef}
        className="max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
