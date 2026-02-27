"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import type { ThemeTokens } from "@/lib/themes";

function tokensToCssVars(tokens: ThemeTokens): string {
  return `
  --gen-primary: ${tokens.primary};
  --gen-primary-fg: ${tokens.primaryForeground};
  --gen-background: ${tokens.background};
  --gen-foreground: ${tokens.foreground};
  --gen-secondary: ${tokens.secondary};
  --gen-secondary-fg: ${tokens.secondaryForeground};
  --gen-muted: ${tokens.muted};
  --gen-muted-fg: ${tokens.mutedForeground};
  --gen-accent: ${tokens.accent};
  --gen-accent-fg: ${tokens.accentForeground};
  --gen-card: ${tokens.card};
  --gen-card-fg: ${tokens.cardForeground};
  --gen-border: ${tokens.border};
  --gen-sidebar-bg: ${tokens.sidebarBg};
  --gen-sidebar-fg: ${tokens.sidebarForeground};
`;
}

export function ThemeInjector() {
  const customTheme = useAppStore((s) => s.customTheme);

  useEffect(() => {
    if (!customTheme) return;
    const id = "genview-custom-theme";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = `[data-theme="custom"] {${tokensToCssVars(customTheme)}}`;
    return () => {
      el?.remove();
    };
  }, [customTheme]);

  return null;
}
