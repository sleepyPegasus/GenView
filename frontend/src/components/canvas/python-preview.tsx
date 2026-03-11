"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Loader2 } from "lucide-react";

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/";

interface PythonPreviewProps {
  code: string;
  showCode: boolean;
}

export function PythonPreview({ code, showCode }: PythonPreviewProps) {
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const pyodideRef = useRef<{ runPythonAsync: (code: string) => Promise<unknown> } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 通过 CDN 脚本加载 Pyodide，避免 Next.js 打包器对 npm 包动态导入的兼容问题
        const loadPyodide = await (async () => {
          if (typeof window === "undefined") return null;
          const w = window as Window & { loadPyodide?: (opts: { indexURL: string }) => Promise<unknown> };
          if (w.loadPyodide) return w.loadPyodide;
          return new Promise<(opts: { indexURL: string }) => Promise<unknown>>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `${PYODIDE_CDN}pyodide.js`;
            script.async = true;
            script.onload = () => {
              if (w.loadPyodide) resolve(w.loadPyodide);
              else reject(new Error("loadPyodide not found on window"));
            };
            script.onerror = () => reject(new Error("Failed to load Pyodide script"));
            document.head.appendChild(script);
          });
        })();
        if (!loadPyodide || cancelled) return;
        const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
        if (!cancelled) {
          pyodideRef.current = pyodide as { runPythonAsync: (code: string) => Promise<unknown> };
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Pyodide 加载失败: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const runCode = useCallback(async () => {
    if (!code || !pyodideRef.current || running) return;

    setRunning(true);
    setError("");
    setOutput("");

    try {
      const pyodide = pyodideRef.current;

      // Setup stdout/stderr capture - run each time to ensure clean state
      await pyodide.runPythonAsync(`
import sys
from io import StringIO
_pyodide_stdout = StringIO()
_pyodide_stderr = StringIO()
sys.stdout = _pyodide_stdout
sys.stderr = _pyodide_stderr
`);
      await pyodide.runPythonAsync(code);

      const out = await pyodide.runPythonAsync("_pyodide_stdout.getvalue()");
      const err = await pyodide.runPythonAsync("_pyodide_stderr.getvalue()");
      const outStr = String(out ?? "").trim();
      const errStr = String(err ?? "").trim();

      if (errStr) setError(errStr);
      if (outStr) setOutput(outStr);
      if (!outStr && !errStr) setOutput("(无输出)");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [code, running]);

  if (showCode) {
    return (
      <div className="h-full overflow-auto p-4">
        <pre
          className="text-sm font-mono whitespace-pre-wrap text-[--gen-foreground] bg-[--gen-muted] rounded-lg p-4"
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          {code}
        </pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
          <span className="text-sm" style={{ color: "var(--gen-muted-fg)" }}>
            正在加载 Python 运行环境...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)", color: "var(--gen-muted-fg)" }}
      >
        <button
          type="button"
          onClick={runCode}
          disabled={running || !code}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "var(--gen-primary)",
            color: "#fff",
          }}
        >
          {running ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          {running ? "运行中..." : "运行"}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 min-h-0">
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#dc2626" }}>
            <div className="font-medium mb-1">错误</div>
            <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
          </div>
        )}
        {output && (
          <div className="rounded-lg p-3 text-sm" style={{ background: "var(--gen-muted)", color: "var(--gen-foreground)" }}>
            <div className="font-medium mb-1">输出</div>
            <pre className="whitespace-pre-wrap font-mono text-xs">{output}</pre>
          </div>
        )}
        {!output && !error && !running && (
          <p className="text-sm" style={{ color: "var(--gen-muted-fg)" }}>
            点击「运行」执行 Python 代码
          </p>
        )}
      </div>
    </div>
  );
}
