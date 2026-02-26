import { create } from "zustand";

export type NavLayout = "top" | "side";

export type IndustryTheme =
  | "modern-b2b"
  | "dark-dashboard"
  | "steel-metallurgy"
  | "wind-energy";

export type RenderMode = "sandpack" | "mermaid" | null;

export interface AppState {
  // Global settings
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;

  // Current rendered code
  currentCode: string;
  renderMode: RenderMode;

  // Actions
  setAppName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setNavLayout: (layout: NavLayout) => void;
  setTheme: (theme: IndustryTheme) => void;
  setCurrentCode: (code: string) => void;
  setRenderMode: (mode: RenderMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appName: "GenView Dashboard",
  logoUrl: "",
  navLayout: "side",
  theme: "modern-b2b",
  currentCode: "",
  renderMode: null,

  setAppName: (appName) => set({ appName }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setNavLayout: (navLayout) => set({ navLayout }),
  setTheme: (theme) => set({ theme }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setRenderMode: (mode) => set({ renderMode: mode }),
}));
