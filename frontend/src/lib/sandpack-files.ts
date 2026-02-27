import type { IndustryTheme, NavLayout } from "@/store/app-store";
import type { ThemeTokens } from "./themes";
import { themeMap } from "./themes";

export function generateSandpackFiles(opts: {
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;
  customTheme?: ThemeTokens | null;
  contentCode: string;
  /** Extra files for multi-file projects */
  extraFiles?: Record<string, string>;
}) {
  const tokens = opts.customTheme ?? themeMap[opts.theme];

  const globalsCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary: ${tokens.primary};
  --primary-foreground: ${tokens.primaryForeground};
  --background: ${tokens.background};
  --foreground: ${tokens.foreground};
  --secondary: ${tokens.secondary};
  --secondary-foreground: ${tokens.secondaryForeground};
  --muted: ${tokens.muted};
  --muted-foreground: ${tokens.mutedForeground};
  --accent: ${tokens.accent};
  --accent-foreground: ${tokens.accentForeground};
  --card: ${tokens.card};
  --card-foreground: ${tokens.cardForeground};
  --border: ${tokens.border};
  --sidebar-bg: ${tokens.sidebarBg};
  --sidebar-foreground: ${tokens.sidebarForeground};
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--background);
  color: var(--foreground);
  min-height: 100vh;
}

.bg-primary { background-color: var(--primary); }
.bg-secondary { background-color: var(--secondary); }
.bg-muted { background-color: var(--muted); }
.bg-accent { background-color: var(--accent); }
.bg-card { background-color: var(--card); }
.bg-background { background-color: var(--background); }
.bg-sidebar { background-color: var(--sidebar-bg); }

.text-primary { color: var(--primary); }
.text-primary-foreground { color: var(--primary-foreground); }
.text-foreground { color: var(--foreground); }
.text-secondary-foreground { color: var(--secondary-foreground); }
.text-muted-foreground { color: var(--muted-foreground); }
.text-accent { color: var(--accent); }
.text-accent-foreground { color: var(--accent-foreground); }
.text-card-foreground { color: var(--card-foreground); }
.text-sidebar-foreground { color: var(--sidebar-foreground); }

.border-border { border-color: var(--border); }
`;

  const layoutTsx = opts.navLayout === "side" ? `
import React from "react";

export default function Layout({ children }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{
        width: "220px",
        flexShrink: 0,
        background: "var(--sidebar-bg)",
        color: "var(--sidebar-foreground)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border)"
      }}>
        <div style={{
          padding: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="logo" style={{ width: 28, height: 28, borderRadius: 4 }} />` : `<div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14 }}>${opts.appName.charAt(0)}</div>`}
          <span style={{ fontWeight: 600, fontSize: "14px" }}>${opts.appName}</span>
        </div>
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.08)", fontSize: 13, marginBottom: 4, cursor: "pointer" }}>Dashboard</div>
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 4, cursor: "pointer", opacity: 0.7 }}>Analytics</div>
          <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 4, cursor: "pointer", opacity: 0.7 }}>Settings</div>
        </nav>
      </aside>
      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
        {children}
      </main>
    </div>
  );
}
` : `
import React from "react";

export default function Layout({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top Navigation */}
      <header style={{
        height: "56px",
        background: "var(--sidebar-bg)",
        color: "var(--sidebar-foreground)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: "1px solid var(--border)",
        gap: "24px",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="logo" style={{ width: 28, height: 28, borderRadius: 4 }} />` : `<div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14 }}>${opts.appName.charAt(0)}</div>`}
          <span style={{ fontWeight: 600, fontSize: "14px" }}>${opts.appName}</span>
        </div>
        <nav style={{ display: "flex", gap: "4px", flex: 1 }}>
          <div style={{ padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.08)", fontSize: 13, cursor: "pointer" }}>Dashboard</div>
          <div style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", opacity: 0.7 }}>Analytics</div>
          <div style={{ padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", opacity: 0.7 }}>Settings</div>
        </nav>
      </header>
      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
        {children}
      </main>
    </div>
  );
}
`;

  const appTsx = `
import React from "react";
import Layout from "./Layout";
import DashboardContent from "./DashboardContent";
import "./globals.css";

export default function App() {
  return (
    <Layout>
      <DashboardContent />
    </Layout>
  );
}
`;

  const dashboardContentTsx = opts.contentCode || `
import React from "react";

export default function DashboardContent() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "var(--foreground)" }}>
        Welcome to ${opts.appName}
      </h1>
      <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
        Start a conversation to generate your dashboard UI.
      </p>
    </div>
  );
}
`;

  const files: Record<string, string> = {
    "/App.tsx": appTsx,
    "/Layout.tsx": layoutTsx,
    "/DashboardContent.tsx": dashboardContentTsx,
    "/globals.css": globalsCss,
  };
  // Merge extra files (ensure paths start with /)
  for (const [path, code] of Object.entries(opts.extraFiles ?? {})) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    if (normalized !== "/App.tsx" && normalized !== "/Layout.tsx" && normalized !== "/globals.css") {
      files[normalized] = code;
    }
  }
  return files;
}
