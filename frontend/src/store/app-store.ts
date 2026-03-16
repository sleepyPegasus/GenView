import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ThemeTokens } from "@/lib/themes";
import type { NavMenuItem } from "@/lib/api";

export type NavLayout = "top" | "side";

export type IndustryTheme =
  | "modern-b2b"
  | "dark-dashboard"
  | "steel-metallurgy"
  | "wind-energy";

export type RenderMode = "sandpack" | "mermaid" | "python" | null;

export interface AppState {
  // Project & conversation tracking
  projectId: string | null;
  conversationId: string | null;
  /** Increment to trigger sidebar conversation list refresh */
  conversationListVersion: number;
  /** Increment to trigger sidebar pages list refresh */
  pagesListVersion: number;

  // Global settings
  appName: string;
  /** App Name font size in nav; e.g. "14px". null = use default */
  appNameFontSize: string | null;
  /** App Name color in nav; e.g. "#ffffff". null = use var(--sidebar-foreground) */
  appNameColor: string | null;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;
  /** Custom theme override; when set, used instead of themeMap[theme] */
  customTheme: ThemeTokens | null;

  // AI model selection (via OpenRouter)
  model: string;

  /** Knowledge graph LLM (optional; when null uses model) */
  kgModel: string | null;

  /** Conversation mode: plan = 对话/灵感, agent = 生成页面 */
  conversationMode: "plan" | "agent";

  /** Nav menu items for chat preview layout; supports children for secondary menu */
  navMenuItems: NavMenuItem[];

  /** Navigation background color (overrides theme sidebarBg); e.g. #1e293b */
  navBackgroundColor: string | null;

  // Current rendered code (main entry: DashboardContent.tsx)
  currentCode: string;
  /** Extra files for multi-file projects: path -> code */
  extraFiles: Record<string, string>;
  renderMode: RenderMode;

  // Streaming state (shared between ChatPanel → RenderCanvas)
  isStreaming: boolean;

  /** Prompt to send from quick-start; ChatPanel picks up and sends, then clears */
  pendingPromptToSend: string | null;

  // Actions
  setProjectId: (id: string | null) => void;
  setConversationId: (id: string | null) => void;
  invalidateConversationList: () => void;
  invalidatePagesList: () => void;
  setAppName: (name: string) => void;
  setAppNameFontSize: (size: string | null) => void;
  setAppNameColor: (color: string | null) => void;
  setLogoUrl: (url: string) => void;
  setNavLayout: (layout: NavLayout) => void;
  setTheme: (theme: IndustryTheme) => void;
  setCustomTheme: (tokens: ThemeTokens | null) => void;
  setModel: (model: string) => void;
  setKgModel: (model: string | null) => void;
  setConversationMode: (mode: "plan" | "agent") => void;
  setNavMenuItems: (items: NavMenuItem[]) => void;
  setNavBackgroundColor: (color: string | null) => void;
  setCurrentCode: (code: string) => void;
  setExtraFiles: (files: Record<string, string>) => void;
  setRenderMode: (mode: RenderMode) => void;
  setIsStreaming: (streaming: boolean) => void;
  setPendingPromptToSend: (prompt: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  projectId: null,
  conversationId: null,
  conversationListVersion: 0,
  pagesListVersion: 0,
  appName: "GenView Dashboard",
  appNameFontSize: null,
  appNameColor: null,
  logoUrl: "",
  navLayout: "side",
  theme: "modern-b2b",
  customTheme: null,
  model: "google/gemini-3.1-pro-preview",
  kgModel: null,
  conversationMode: "agent",
  navMenuItems: [
    { label: "Dashboard", icon: "LayoutDashboard", selected: true },
    { label: "Analytics", icon: "BarChart" },
    { label: "Settings", icon: "Settings" },
  ],
  navBackgroundColor: null,
  currentCode: "",
  extraFiles: {},
  renderMode: null,
  isStreaming: false,
  pendingPromptToSend: null,

  setProjectId: (projectId) => set({ projectId }),
  setConversationId: (conversationId) => set({ conversationId }),
  invalidateConversationList: () =>
    set((s) => ({ conversationListVersion: s.conversationListVersion + 1 })),
  invalidatePagesList: () =>
    set((s) => ({ pagesListVersion: s.pagesListVersion + 1 })),
  setAppName: (appName) => set({ appName }),
  setAppNameFontSize: (appNameFontSize) => set({ appNameFontSize }),
  setAppNameColor: (appNameColor) => set({ appNameColor }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setNavLayout: (navLayout) => set({ navLayout }),
  setTheme: (theme) => set({ theme }),
  setCustomTheme: (customTheme) => set({ customTheme }),
  setModel: (model) => set({ model }),
  setKgModel: (kgModel) => set({ kgModel }),
  setConversationMode: (conversationMode) => set({ conversationMode }),
  setNavMenuItems: (navMenuItems) => set({ navMenuItems }),
  setNavBackgroundColor: (navBackgroundColor) => set({ navBackgroundColor }),
  setCurrentCode: (code) => set({ currentCode: code }),
  setExtraFiles: (extraFiles) => set({ extraFiles }),
  setRenderMode: (mode) => set({ renderMode: mode }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setPendingPromptToSend: (prompt) => set({ pendingPromptToSend: prompt }),
}),
    {
      name: "genview-app-store",
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({}), // No persist: config comes from conversation
    }
  )
);
