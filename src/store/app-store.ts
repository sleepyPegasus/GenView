import { create } from "zustand";

export type NavLayout = "top" | "side";

export type IndustryTheme =
  | "modern-b2b"
  | "dark-dashboard"
  | "steel-metallurgy"
  | "wind-energy";

export type RenderMode = "sandpack" | "mermaid" | null;

export interface AppState {
  // Project & conversation tracking
  projectId: string | null;
  conversationId: string | null;

  // Global settings
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;

  // AI model selection (via OpenRouter)
  model: string;

  // Current rendered code
  currentCode: string;
  renderMode: RenderMode;

  // Actions
  setProjectId: (id: string | null) => void;
  setConversationId: (id: string | null) => void;
  setAppName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setNavLayout: (layout: NavLayout) => void;
  setTheme: (theme: IndustryTheme) => void;
  setModel: (model: string) => void;
  setCurrentCode: (code: string) => void;
  setRenderMode: (mode: RenderMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projectId: null,
  conversationId: null,
  appName: "GenView Dashboard",
  logoUrl: "",
  navLayout: "side",
  theme: "modern-b2b",
  model: "anthropic/claude-sonnet-4-20250514",
  currentCode: "",
  renderMode: null,

  setProjectId: (projectId) => set({ projectId }),
  setConversationId: (conversationId) => set({ conversationId }),
  setAppName: (appName) => set({ appName }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setNavLayout: (navLayout) => set({ navLayout }),
  setTheme: (theme) => set({ theme }),
  setModel: (model) => set({ model }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setRenderMode: (mode) => set({ renderMode: mode }),
}));
