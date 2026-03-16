"use client";

import * as Diff from "diff";
import { Undo2, Check } from "lucide-react";

interface AIModifyDiffPreviewProps {
  original: string;
  modified: string;
  onApply: () => void;
  onCancel: () => void;
  /** 是否已应用，为 true 时「应用修改」按钮禁用 */
  applied?: boolean;
}

interface DiffLine {
  type: "removed" | "added";
  lineNum: number;
  content: string;
}

/**
 * Line-level diff preview for AI modify. Shows removed (red) and added (green) lines with line numbers.
 */
export function AIModifyDiffPreview({ original, modified, onApply, onCancel, applied }: AIModifyDiffPreviewProps) {
  const diffLines = Diff.diffLines(original, modified);
  const hasChanges = diffLines.some((p) => p.added || p.removed);

  const lines: DiffLine[] = [];
  let origLine = 1;
  let modLine = 1;
  for (const part of diffLines) {
    let parts = part.value.split("\n");
    if (parts.length > 0 && parts[parts.length - 1] === "" && part.value.endsWith("\n")) parts = parts.slice(0, -1);
    const lastIdx = parts.length - 1;
    for (let i = 0; i < parts.length; i++) {
      const content = i < lastIdx ? parts[i] + "\n" : parts[i];
      if (part.removed) {
        lines.push({ type: "removed", lineNum: origLine++, content });
      } else if (part.added) {
        lines.push({ type: "added", lineNum: modLine++, content });
      } else {
        origLine++;
        modLine++;
      }
    }
  }

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: "var(--gen-background)",
        border: "1px solid var(--gen-border)",
        minWidth: 360,
        maxWidth: 560,
        maxHeight: 420,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-xs flex-shrink-0"
        style={{ background: "var(--gen-muted)", borderBottom: "1px solid var(--gen-border)" }}
      >
        <span style={{ color: "var(--gen-foreground)", fontWeight: 500 }}>Diff 预览</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: "var(--gen-muted-fg)" }}>
            {hasChanges ? "红色=删除 绿色=新增" : "无变更"}
          </span>
          <button
            type="button"
            onClick={onCancel}
            title="返回修改"
            className="p-1 rounded hover:opacity-80"
            style={{ color: "var(--gen-muted-fg)" }}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applied}
            title="应用修改"
            className="p-1 rounded hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: applied ? "var(--gen-muted-fg)" : "var(--gen-primary)" }}
          >
            <Check size={14} />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto p-3 text-xs font-mono leading-relaxed"
        style={{
          background: "var(--gen-muted)",
          color: "var(--gen-foreground)",
          margin: 0,
        }}
      >
        {lines.length === 0 ? (
          <div className="text-center py-4" style={{ color: "var(--gen-muted-fg)" }}>
            无变更
          </div>
        ) : (
        lines.map((item, i) => {
          if (item.type === "added") {
            return (
              <div key={i} className="flex" style={{ background: "rgba(34, 197, 94, 0.2)", color: "var(--gen-foreground)" }}>
                <span className="flex-shrink-0 w-10 text-right pr-2 select-none" style={{ color: "var(--gen-muted-fg)" }}>
                  {item.lineNum}
                </span>
                <span style={{ color: "rgb(34, 197, 94)", marginRight: 6 }}>+</span>
                <span className="flex-1 min-w-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {item.content}
                </span>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "var(--gen-muted-fg)",
                textDecoration: "line-through",
              }}
            >
              <span className="flex-shrink-0 w-10 text-right pr-2 select-none" style={{ color: "var(--gen-muted-fg)" }}>
                {item.lineNum}
              </span>
              <span style={{ color: "rgb(239, 68, 68)", marginRight: 6 }}>-</span>
              <span className="flex-1 min-w-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {item.content}
              </span>
            </div>
          );
        })
        ) }
      </div>
    </div>
  );
}
