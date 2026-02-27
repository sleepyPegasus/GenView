import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, style, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    style={{
      border: "1px solid var(--gen-border)",
      background: "transparent",
      color: "var(--gen-foreground)",
      ...style,
    }}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
