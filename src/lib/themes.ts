import type { IndustryTheme } from "@/store/app-store";

export interface ThemeTokens {
  label: string;
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  sidebarBg: string;
  sidebarForeground: string;
}

export const themeMap: Record<IndustryTheme, ThemeTokens> = {
  "modern-b2b": {
    label: "Modern B2B",
    background: "#f8fafc",
    foreground: "#0f172a",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9",
    secondaryForeground: "#334155",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    accent: "#3b82f6",
    accentForeground: "#ffffff",
    card: "#ffffff",
    cardForeground: "#0f172a",
    border: "#e2e8f0",
    sidebarBg: "#1e293b",
    sidebarForeground: "#e2e8f0",
  },
  "dark-dashboard": {
    label: "Dark Dashboard",
    background: "#0a0a0f",
    foreground: "#e2e8f0",
    primary: "#8b5cf6",
    primaryForeground: "#ffffff",
    secondary: "#1e1e2e",
    secondaryForeground: "#a5b4fc",
    muted: "#1a1a2e",
    mutedForeground: "#94a3b8",
    accent: "#6366f1",
    accentForeground: "#ffffff",
    card: "#12121a",
    cardForeground: "#e2e8f0",
    border: "#2a2a3e",
    sidebarBg: "#0d0d14",
    sidebarForeground: "#c7d2fe",
  },
  "steel-metallurgy": {
    label: "Steel & Metallurgy",
    background: "#1c1c1e",
    foreground: "#e5e5e5",
    primary: "#ef4444",
    primaryForeground: "#ffffff",
    secondary: "#292929",
    secondaryForeground: "#d4d4d4",
    muted: "#2a2a2c",
    mutedForeground: "#a3a3a3",
    accent: "#f97316",
    accentForeground: "#ffffff",
    card: "#232325",
    cardForeground: "#e5e5e5",
    border: "#3a3a3c",
    sidebarBg: "#141415",
    sidebarForeground: "#d4d4d4",
  },
  "wind-energy": {
    label: "Wind Energy",
    background: "#f0fdf4",
    foreground: "#052e16",
    primary: "#10b981",
    primaryForeground: "#ffffff",
    secondary: "#ecfdf5",
    secondaryForeground: "#065f46",
    muted: "#f0fdf4",
    mutedForeground: "#6b7280",
    accent: "#06b6d4",
    accentForeground: "#ffffff",
    card: "#ffffff",
    cardForeground: "#052e16",
    border: "#d1fae5",
    sidebarBg: "#064e3b",
    sidebarForeground: "#d1fae5",
  },
};
