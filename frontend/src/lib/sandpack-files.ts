import type { IndustryTheme, NavLayout } from "@/store/app-store";
import type { ThemeTokens } from "./themes";
import { themeMap } from "./themes";

export interface NavMenuItem {
  label: string;
  icon?: string;
  selected?: boolean;
}

export function generateSandpackFiles(opts: {
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;
  customTheme?: ThemeTokens | null;
  /** Override nav/sidebar background; defaults to theme sidebarBg */
  navBackgroundColor?: string | null;
  /** App Name font size in nav; e.g. "14px". null = 14px */
  appNameFontSize?: string | null;
  /** App Name color in nav; e.g. "#fff". null = var(--sidebar-foreground) */
  appNameColor?: string | null;
  contentCode: string;
  /** Extra files for multi-file projects */
  extraFiles?: Record<string, string>;
  /** Nav menu items for Layout; defaults to Dashboard, Analytics, Settings */
  navMenuItems?: NavMenuItem[];
}) {
  const tokens = opts.customTheme ?? themeMap[opts.theme];
  const sidebarBg = opts.navBackgroundColor ?? tokens.sidebarBg;
  const appNameFontSize = opts.appNameFontSize ?? "14px";
  const appNameColor = opts.appNameColor ?? "var(--sidebar-foreground)";
  const navItems = opts.navMenuItems?.length
    ? opts.navMenuItems
    : [
        { label: "Dashboard", icon: "LayoutDashboard", selected: true },
        { label: "Analytics", icon: "BarChart" },
        { label: "Settings", icon: "Settings" },
      ];

  const iconNames = [...new Set(navItems.map((i) => i.icon).filter((n): n is string => !!n))];
  const iconImport =
    iconNames.length > 0
      ? `import { ${iconNames.join(", ")} } from "lucide-react";\nconst ICON_MAP = { ${iconNames.join(", ")} };`
      : "const ICON_MAP = {};";

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
  --sidebar-bg: ${sidebarBg};
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
${iconImport}

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
          <span style={{ fontWeight: 600, fontSize: "${appNameFontSize}", color: "${appNameColor}" }}>${opts.appName}</span>
        </div>
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {${JSON.stringify(navItems)}.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 4, cursor: "pointer", background: (item.selected ?? (i === 0)) ? "rgba(255,255,255,0.08)" : "transparent", opacity: (item.selected ?? (i === 0)) ? 1 : 0.7 }}>
              {item.icon && ICON_MAP && ICON_MAP[item.icon] ? React.createElement(ICON_MAP[item.icon], { size: 16 }) : null}
              <span>{item.label}</span>
            </div>
          ))}
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
${iconImport}

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
          <span style={{ fontWeight: 600, fontSize: "${appNameFontSize}", color: "${appNameColor}" }}>${opts.appName}</span>
        </div>
        <nav style={{ display: "flex", gap: "4px", flex: 1 }}>
          {${JSON.stringify(navItems)}.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", background: (item.selected ?? (i === 0)) ? "rgba(255,255,255,0.08)" : "transparent", opacity: (item.selected ?? (i === 0)) ? 1 : 0.7 }}>
              {item.icon && ICON_MAP && ICON_MAP[item.icon] ? React.createElement(ICON_MAP[item.icon], { size: 16 }) : null}
              <span>{item.label}</span>
            </div>
          ))}
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

export interface NavItem {
  pageId: string;
  label: string;
}

export interface MultiPageSandpackOpts {
  appName: string;
  logoUrl: string;
  navLayout: NavLayout;
  theme: IndustryTheme;
  customTheme?: ThemeTokens | null;
  appNameFontSize?: string | null;
  appNameColor?: string | null;
  /** Flat list: top nav items, then side nav items (based on navLayout) */
  navConfig: { top?: NavItem[]; side?: NavItem[] };
  /** pageId -> { code_block, extra_files } */
  pages: Record<string, { code: string; extraFiles?: Record<string, string> }>;
}

export function generateMultiPageSandpackFiles(opts: MultiPageSandpackOpts) {
  const tokens = opts.customTheme ?? themeMap[opts.theme];
  const appNameFontSize = opts.appNameFontSize ?? "14px";
  const appNameColor = opts.appNameColor ?? "var(--sidebar-foreground)";
  const globalsCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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

body { font-family: 'Inter', system-ui, sans-serif; background: var(--background); color: var(--foreground); min-height: 100vh; }

.bg-primary { background-color: var(--primary); }
.text-primary { color: var(--primary); }
.text-primary-foreground { color: var(--primary-foreground); }
.text-foreground { color: var(--foreground); }
.text-muted-foreground { color: var(--muted-foreground); }
.border-border { border-color: var(--border); }
`;

  const topItems = opts.navConfig.top ?? [];
  const sideItems = opts.navConfig.side ?? [];
  const allItems = opts.navLayout === "side" ? sideItems : topItems;
  const firstPageId = allItems[0]?.pageId ?? null;

  const navItemsJson = JSON.stringify(allItems.map((i) => ({ id: i.pageId, label: i.label })));

  const layoutTsx =
    opts.navLayout === "side"
      ? `
import React from "react";

const NAV_ITEMS = ${navItemsJson};

export default function Layout({ children, currentPageId, onPageChange }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <aside style={{
        width: "220px", flexShrink: 0, background: "var(--sidebar-bg)", color: "var(--sidebar-foreground)",
        display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)"
      }}>
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "10px" }}>
          ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="logo" style={{ width: 28, height: 28, borderRadius: 4 }} />` : `<div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14 }}>${opts.appName.charAt(0)}</div>`}
          <span style={{ fontWeight: 600, fontSize: "${appNameFontSize}", color: "${appNameColor}" }}>${opts.appName}</span>
        </div>
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => onPageChange(item.id)}
              style={{
                padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 4, cursor: "pointer",
                background: currentPageId === item.id ? "rgba(255,255,255,0.08)" : "transparent",
                opacity: currentPageId === item.id ? 1 : 0.7
              }}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>
      <main style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
        {children}
      </main>
    </div>
  );
}
`
      : `
import React from "react";

const NAV_ITEMS = ${navItemsJson};

export default function Layout({ children, currentPageId, onPageChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header style={{
        height: "56px", background: "var(--sidebar-bg)", color: "var(--sidebar-foreground)",
        display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--border)", gap: "24px", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          ${opts.logoUrl ? `<img src="${opts.logoUrl}" alt="logo" style={{ width: 28, height: 28, borderRadius: 4 }} />` : `<div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14 }}>${opts.appName.charAt(0)}</div>`}
          <span style={{ fontWeight: 600, fontSize: "${appNameFontSize}", color: "${appNameColor}" }}>${opts.appName}</span>
        </div>
        <nav style={{ display: "flex", gap: "4px", flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => onPageChange(item.id)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                background: currentPageId === item.id ? "rgba(255,255,255,0.08)" : "transparent",
                opacity: currentPageId === item.id ? 1 : 0.7
              }}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, overflow: "auto", background: "var(--background)" }}>
        {children}
      </main>
    </div>
  );
}
`;

  const pageComponents: string[] = [];
  const pageMap: Record<string, string> = {};
  for (const [pageId, data] of Object.entries(opts.pages)) {
    const safeId = pageId.replace(/[^a-zA-Z0-9]/g, "_");
    const compName = `Page_${safeId}`;
    pageMap[pageId] = compName;
    pageComponents.push(`import ${compName} from "./${compName}.tsx";`);
  }

  const pageSwitchCases = allItems
    .map((item) => {
      const comp = pageMap[item.pageId];
      if (!comp || !opts.pages[item.pageId]) return null;
      return `case "${item.pageId}": return <${comp} />;`;
    })
    .filter(Boolean)
    .join("\n          ");

  const appTsx = `
import React, { useState } from "react";
import Layout from "./Layout";
import "./globals.css";
${pageComponents.join("\n")}

const PAGE_MAP = ${JSON.stringify(pageMap)};

export default function App() {
  const [currentPageId, setCurrentPageId] = useState(${JSON.stringify(firstPageId)});
  const renderPage = () => {
    switch (currentPageId) {
          ${pageSwitchCases}
      default: return <div style={{ padding: 24 }}>Select a page</div>;
    }
  };
  return (
    <Layout currentPageId={currentPageId} onPageChange={setCurrentPageId}>
      {renderPage()}
    </Layout>
  );
}
`;

  const files: Record<string, string> = {
    "/App.tsx": appTsx,
    "/Layout.tsx": layoutTsx,
    "/globals.css": globalsCss,
  };

  for (const [pageId, data] of Object.entries(opts.pages)) {
    const safeId = pageId.replace(/[^a-zA-Z0-9]/g, "_");
    files[`/Page_${safeId}.tsx`] = data.code;
    for (const [path, code] of Object.entries(data.extraFiles ?? {})) {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      if (!files[normalized]) files[normalized] = code;
    }
  }

  return files;
}
