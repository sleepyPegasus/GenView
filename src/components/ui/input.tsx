import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-9 w-full rounded-md border border-[--gen-border] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-[--gen-muted-fg] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--gen-primary] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
