"""
项目导出服务：将多页项目导出为可部署的 Vite React 工程。
"""

import io
import json
import re
import zipfile
from typing import Any

THEME_MAP = {
    "modern-b2b": {
        "primary": "#2563eb",
        "primaryForeground": "#ffffff",
        "background": "#f8fafc",
        "foreground": "#0f172a",
        "secondary": "#f1f5f9",
        "secondaryForeground": "#334155",
        "muted": "#f1f5f9",
        "mutedForeground": "#64748b",
        "accent": "#3b82f6",
        "accentForeground": "#ffffff",
        "card": "#ffffff",
        "cardForeground": "#0f172a",
        "border": "#e2e8f0",
        "sidebarBg": "#1e293b",
        "sidebarForeground": "#e2e8f0",
    },
    "dark-dashboard": {
        "primary": "#8b5cf6",
        "primaryForeground": "#ffffff",
        "background": "#0a0a0f",
        "foreground": "#e2e8f0",
        "secondary": "#1e1e2e",
        "secondaryForeground": "#a5b4fc",
        "muted": "#1a1a2e",
        "mutedForeground": "#94a3b8",
        "accent": "#6366f1",
        "accentForeground": "#ffffff",
        "card": "#12121a",
        "cardForeground": "#e2e8f0",
        "border": "#2a2a3e",
        "sidebarBg": "#0d0d14",
        "sidebarForeground": "#c7d2fe",
    },
    "steel-metallurgy": {
        "primary": "#ef4444",
        "primaryForeground": "#ffffff",
        "background": "#1c1c1e",
        "foreground": "#e5e5e5",
        "secondary": "#292929",
        "secondaryForeground": "#d4d4d4",
        "muted": "#2a2a2c",
        "mutedForeground": "#a3a3a3",
        "accent": "#f97316",
        "accentForeground": "#ffffff",
        "card": "#232325",
        "cardForeground": "#e5e5e5",
        "border": "#3a3a3c",
        "sidebarBg": "#141415",
        "sidebarForeground": "#d4d4d4",
    },
    "wind-energy": {
        "primary": "#22c55e",
        "primaryForeground": "#ffffff",
        "background": "#f0fdf4",
        "foreground": "#052e16",
        "secondary": "#dcfce7",
        "secondaryForeground": "#166534",
        "muted": "#dcfce7",
        "mutedForeground": "#15803d",
        "accent": "#16a34a",
        "accentForeground": "#ffffff",
        "card": "#ffffff",
        "cardForeground": "#052e16",
        "border": "#bbf7d0",
        "sidebarBg": "#14532d",
        "sidebarForeground": "#dcfce7",
    },
}


def _get_tokens(theme: str, custom_theme: dict | None) -> dict[str, str]:
    if custom_theme:
        base = THEME_MAP.get("modern-b2b", {})
        return {**base, **{k: v for k, v in custom_theme.items() if isinstance(v, str)}}
    return THEME_MAP.get(theme, THEME_MAP["modern-b2b"]).copy()


def _flatten_nav_items(cfg: dict | None, nav_layout: str) -> list[dict]:
    if not cfg:
        return []
    items = cfg.get("items") or []
    if items:
        result = []
        for it in items:
            if it.get("pageId"):
                result.append({"pageId": it["pageId"], "label": it.get("label", "Page")})
            for ch in it.get("children") or []:
                if ch.get("pageId"):
                    result.append({"pageId": ch["pageId"], "label": ch.get("label", "Page")})
        return result
    top = cfg.get("top") or []
    side = cfg.get("side") or []
    lst = side if nav_layout == "side" else top
    return [{"pageId": x.get("pageId", ""), "label": x.get("label", "Page")} for x in lst if x.get("pageId")]


def generate_vite_project(
    project: dict,
    pages: list[dict],
    page_map: dict[str, dict],
) -> bytes:
    """生成 Vite React 项目 zip。"""
    theme = project.get("theme") or "modern-b2b"
    custom_theme = project.get("custom_theme")
    tokens = _get_tokens(theme, custom_theme)
    app_name = project.get("name") or "GenView Dashboard"
    logo_url = project.get("logo_url") or ""
    nav_layout = project.get("nav_layout") or "side"
    nav_config = project.get("nav_config") or {}
    app_name_font_size = project.get("app_name_font_size") or "14px"
    app_name_color = project.get("app_name_color") or "var(--sidebar-foreground)"

    all_items = _flatten_nav_items(nav_config, nav_layout)
    first_page_id = all_items[0]["pageId"] if all_items else None

    globals_css = f"""
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

:root {{
  --primary: {tokens.get('primary', '#2563eb')};
  --primary-foreground: {tokens.get('primaryForeground', '#ffffff')};
  --background: {tokens.get('background', '#f8fafc')};
  --foreground: {tokens.get('foreground', '#0f172a')};
  --secondary: {tokens.get('secondary', '#f1f5f9')};
  --secondary-foreground: {tokens.get('secondaryForeground', '#334155')};
  --muted: {tokens.get('muted', '#f1f5f9')};
  --muted-foreground: {tokens.get('mutedForeground', '#64748b')};
  --accent: {tokens.get('accent', '#3b82f6')};
  --accent-foreground: {tokens.get('accentForeground', '#ffffff')};
  --card: {tokens.get('card', '#ffffff')};
  --card-foreground: {tokens.get('cardForeground', '#0f172a')};
  --border: {tokens.get('border', '#e2e8f0')};
  --sidebar-bg: {tokens.get('sidebarBg', '#1e293b')};
  --sidebar-foreground: {tokens.get('sidebarForeground', '#e2e8f0')};
}}

body {{ font-family: 'Inter', system-ui, sans-serif; background: var(--background); color: var(--foreground); min-height: 100vh; }}
"""

    nav_items_json = json.dumps([{"id": i["pageId"], "label": i["label"]} for i in all_items])
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="logo" style={{{{ width: 28, height: 28, borderRadius: 4 }}}} />'
    else:
        first_char = app_name[0] if app_name else "G"
        logo_html = f'<div style={{{{ width: 28, height: 28, borderRadius: 4, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-foreground)", fontWeight: 700, fontSize: 14 }}}}>{first_char}</div>'

    if nav_layout == "side":
        layout_tsx = f'''import React from "react";

const NAV_ITEMS = {nav_items_json};

export default function Layout({{ children, currentPageId, onPageChange }}: {{ children: React.ReactNode; currentPageId: string; onPageChange: (id: string) => void }}) {{
  return (
    <div style={{{{ display: "flex", height: "100vh", overflow: "hidden" }}}}>
      <aside style={{{{ width: "220px", flexShrink: 0, background: "var(--sidebar-bg)", color: "var(--sidebar-foreground)",
        display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)"
      }}}}>
        <div style={{{{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "10px" }}}}>
          {logo_html}
          <span style={{{{ fontWeight: 600, fontSize: "{app_name_font_size}", color: "{app_name_color}" }}}}>{app_name}</span>
        </div>
        <nav style={{{{ padding: "12px 8px", flex: 1 }}}}>
          {{NAV_ITEMS.map((item) => (
            <div
              key={{item.id}}
              onClick={{() => onPageChange(item.id)}}
              style={{{{ padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 4, cursor: "pointer",
                background: currentPageId === item.id ? "rgba(255,255,255,0.08)" : "transparent",
                opacity: currentPageId === item.id ? 1 : 0.7
              }}}}
            >
              {{item.label}}
            </div>
          ))}}
        </nav>
      </aside>
      <main style={{{{ flex: 1, overflow: "auto", background: "var(--background)" }}}}>
        {{children}}
      </main>
    </div>
  );
}}
'''
    else:
        layout_tsx = f'''import React from "react";

const NAV_ITEMS = {nav_items_json};

export default function Layout({{ children, currentPageId, onPageChange }}: {{ children: React.ReactNode; currentPageId: string; onPageChange: (id: string) => void }}) {{
  return (
    <div style={{{{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}}}>
      <header style={{{{ height: "56px", background: "var(--sidebar-bg)", color: "var(--sidebar-foreground)",
        display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--border)", gap: "24px", flexShrink: 0
      }}}}>
        <div style={{{{ display: "flex", alignItems: "center", gap: "10px" }}}}>
          {logo_html}
          <span style={{{{ fontWeight: 600, fontSize: "{app_name_font_size}", color: "{app_name_color}" }}}}>{app_name}</span>
        </div>
        <nav style={{{{ display: "flex", gap: "4px", flex: 1 }}}}>
          {{NAV_ITEMS.map((item) => (
            <div
              key={{item.id}}
              onClick={{() => onPageChange(item.id)}}
              style={{{{ padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                background: currentPageId === item.id ? "rgba(255,255,255,0.08)" : "transparent",
                opacity: currentPageId === item.id ? 1 : 0.7
              }}}}
            >
              {{item.label}}
            </div>
          ))}}
        </nav>
      </header>
      <main style={{{{ flex: 1, overflow: "auto", background: "var(--background)" }}}}>
        {{children}}
      </main>
    </div>
  );
}}
'''

    page_imports = []
    page_map_ts = {}
    for item in all_items:
        pid = item["pageId"]
        if pid and pid in page_map and page_map[pid].get("code_block"):
            safe_id = re.sub(r"[^a-zA-Z0-9]", "_", pid)
            comp = f"Page_{safe_id}"
            page_map_ts[pid] = comp
            page_imports.append(f'import {comp} from "./Page_{safe_id}.tsx";')

    switch_cases = []
    for item in all_items:
        pid = item["pageId"]
        comp = page_map_ts.get(pid)
        if comp and pid in page_map:
            switch_cases.append(f'case "{pid}": return <{comp} />;')

    app_tsx = f'''
import {{ useState }} from "react";
import Layout from "./Layout";
import "./globals.css";
{chr(10).join(page_imports)}

export default function App() {{
  const [currentPageId, setCurrentPageId] = useState({json.dumps(first_page_id)});
  const renderPage = () => {{
    switch (currentPageId) {{
      {chr(10).join("      " + c for c in switch_cases)}
      default: return <div style={{{{ padding: 24 }}}}>Select a page</div>;
    }}
  }};
  return (
    <Layout currentPageId={{currentPageId}} onPageChange={{setCurrentPageId}}>
      {{renderPage()}}
    </Layout>
  );
}}
'''.replace("{{currentPageId}}", "{currentPageId}").replace("{{setCurrentPageId}}", "{setCurrentPageId}").replace("{{renderPage()}}", "{renderPage()}")

    package_json = {
        "name": "genview-export",
        "private": True,
        "version": "0.0.1",
        "type": "module",
        "scripts": {
            "dev": "vite",
            "build": "tsc -b && vite build",
            "preview": "vite preview",
        },
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "recharts": "^2.10.0",
            "echarts": "^5.5.0",
            "echarts-for-react": "^3.0.2",
            "lucide-react": "^0.400.0",
        },
        "devDependencies": {
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            "@vitejs/plugin-react": "^4.2.0",
            "typescript": "^5.0.0",
            "vite": "^5.0.0",
        },
    }

    index_html = """<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GenView Export</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

    main_tsx = """import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"""

    vite_config = """import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
"""

    tsconfig = """{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("package.json", json.dumps(package_json, indent=2))
        zf.writestr("index.html", index_html)
        zf.writestr("vite.config.ts", vite_config)
        zf.writestr("tsconfig.json", tsconfig)
        zf.writestr("src/globals.css", globals_css)
        zf.writestr("src/main.tsx", main_tsx)
        zf.writestr("src/App.tsx", app_tsx)
        zf.writestr("src/Layout.tsx", layout_tsx)
        for item in all_items:
            pid = item["pageId"]
            if pid in page_map:
                data = page_map[pid]
                code = data.get("code_block") or ""
                # Sanitize: ">" in JSX text breaks parser; replace common text patterns
                code = code.replace(" -> ", " → ").replace(" <- ", " ← ")
                # "目标 > 70%" etc: replace when preceded by Chinese or % (avoid breaking JS like "a > b")
                code = re.sub(r"([\u4e00-\u9fff%])\s*>\s*", r"\1 › ", code)
                # "数值 < 100" in text: "<" parsed as tag start; only when preceded by Chinese (avoid breaking "a < b")
                code = re.sub(r"([\u4e00-\u9fff])\s*<\s*(\d)", r"\1 ‹ \2", code)
                extra = data.get("extra_files") or {}
                safe_id = re.sub(r"[^a-zA-Z0-9]", "_", pid)
                zf.writestr(f"src/Page_{safe_id}.tsx", code)
                for path, content in (extra if isinstance(extra, dict) else {}).items():
                    p = path if path.startswith("/") else f"/{path}"
                    if p.startswith("/"):
                        p = "src" + p
                    if p and not p.endswith("/"):
                        clean = p.lstrip("/").replace("//", "/")
                        zf.writestr(clean, content)

    return buf.getvalue()
