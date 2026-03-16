"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Copy, AlertTriangle } from "lucide-react";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  onCopyError?: (error: Error) => void;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  constructor(props: PreviewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PreviewErrorBoundary]", error, errorInfo);
  }

  handleCopy = () => {
    const { error } = this.state;
    if (error) {
      const text = `${error.name}: ${error.message}\n${error.stack ?? ""}`;
      navigator.clipboard.writeText(text);
      this.props.onCopyError?.(error);
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      return (
        <div
          className="h-full flex flex-col items-center justify-center p-8"
          style={{ background: "var(--gen-background)" }}
        >
          <div className="text-center max-w-md">
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: "var(--gen-destructive, #ef4444)" }} />
            <p className="text-sm font-medium mb-2" style={{ color: "var(--gen-foreground)" }}>
              预览渲染出错
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--gen-muted-fg)" }}>
              {err.message}
            </p>
            <button
              type="button"
              onClick={this.handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors"
              style={{
                background: "var(--gen-muted)",
                color: "var(--gen-foreground)",
              }}
            >
              <Copy size={12} />
              复制错误信息
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
