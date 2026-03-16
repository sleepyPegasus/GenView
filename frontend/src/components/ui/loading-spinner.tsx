"use client";

import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  /** Optional label below the spinner */
  label?: string;
}

export function LoadingSpinner({ size = 24, className = "", label }: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${className}`}
      style={{ color: "var(--gen-primary)" }}
    >
      <Loader2 size={size} className="animate-spin flex-shrink-0" />
      {label && (
        <span className="text-xs" style={{ color: "var(--gen-muted-fg)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
