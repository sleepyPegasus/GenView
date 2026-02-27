import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ThemeTokens } from "@/lib/themes";

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
  /** Increment to trigger sidebar conversation list refresh */
  conversationListVersion: number;

  // Global settings
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;
  /** Custom theme override; when set, used instead of themeMap[theme] */
  customTheme: ThemeTokens | null;

  // AI model selection (via OpenRouter)
  model: string;

  // Current rendered code (main entry: DashboardContent.tsx)
  currentCode: string;
  /** Extra files for multi-file projects: path -> code */
  extraFiles: Record<string, string>;
  renderMode: RenderMode;

  // Streaming state (shared between ChatPanel → RenderCanvas)
  isStreaming: boolean;

  // Actions
  setProjectId: (id: string | null) => void;
  setConversationId: (id: string | null) => void;
  invalidateConversationList: () => void;
  setAppName: (name: string) => void;
  setLogoUrl: (url: string) => void;
  setNavLayout: (layout: NavLayout) => void;
  setTheme: (theme: IndustryTheme) => void;
  setCustomTheme: (tokens: ThemeTokens | null) => void;
  setModel: (model: string) => void;
  setCurrentCode: (code: string) => void;
  setExtraFiles: (files: Record<string, string>) => void;
  setRenderMode: (mode: RenderMode) => void;
  setIsStreaming: (streaming: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  projectId: null,
  conversationId: null,
  conversationListVersion: 0,
  appName: "GenView Dashboard",
  logoUrl: "",
  navLayout: "side",
  theme: "modern-b2b",
  customTheme: null,
  model: "google/gemini-3.1-pro-preview",
  currentCode: "",
  extraFiles: {},
  renderMode: null,
  isStreaming: false,

  setProjectId: (projectId) => set({ projectId }),
  setConversationId: (conversationId) => set({ conversationId }),
  invalidateConversationList: () =>
    set((s) => ({ conversationListVersion: s.conversationListVersion + 1 })),
  setAppName: (appName) => set({ appName }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setNavLayout: (navLayout) => set({ navLayout }),
  setTheme: (theme) => set({ theme }),
  setCustomTheme: (customTheme) => set({ customTheme }),
  setModel: (model) => set({ model }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setExtraFiles: (extraFiles) => set({ extraFiles }),
  setRenderMode: (mode) => set({ renderMode: mode }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
}),
    {
      name: "genview-app-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ model: s.model }),
    }
  )
);
