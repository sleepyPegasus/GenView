import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

const sizeClasses = {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-10 px-6",
  icon: "h-9 w-9",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", style, ...props }, ref) => {
    const variantStyle: React.CSSProperties =
      variant === "default"
        ? { background: "var(--gen-primary)", color: "#ffffff" }
        : variant === "secondary"
        ? { background: "var(--gen-secondary)", color: "var(--gen-secondary-fg)" }
        : variant === "outline"
        ? { border: "1px solid var(--gen-border)", background: "transparent", color: "var(--gen-foreground)" }
        : { background: "transparent", color: "var(--gen-foreground)" };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50",
          sizeClasses[size],
          className
        )}
        style={{ ...variantStyle, ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
