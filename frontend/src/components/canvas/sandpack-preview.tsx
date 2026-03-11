"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useAppStore } from "@/store/app-store";
import { generateSandpackFiles } from "@/lib/sandpack-files";

/**
 * Syncs currentCode from the Zustand store into the Sandpack sandbox.
 *
 * This component is only active when streaming is finished (the parent
 * SandpackRenderer is unmounted during streaming). It handles the case
 * where currentCode changes after Sandpack is already mounted (e.g.
 * settings change or a subsequent completed response).
 */
function SandpackFileUpdater() {
  const { sandpack } = useSandpack();
  const currentCode = useAppStore((s) => s.currentCode);
  const extraFiles = useAppStore((s) => s.extraFiles);
  const lastCodeRef = useRef("");
  const lastExtraRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!currentCode || currentCode === lastCodeRef.current) return;
    lastCodeRef.current = currentCode;
    sandpack.updateFile("/DashboardContent.tsx", currentCode, true);
  }, [currentCode, sandpack]);

  useEffect(() => {
    if (JSON.stringify(extraFiles) === JSON.stringify(lastExtraRef.current)) return;
    lastExtraRef.current = extraFiles;
    for (const [path, code] of Object.entries(extraFiles)) {
      const p = path.startsWith("/") ? path : `/${path}`;
      sandpack.updateFile(p, code, true);
    }
  }, [extraFiles, sandpack]);

  return null;
}

interface SandpackRendererProps {
  showCode: boolean;
}

/**
 * Sandpack wrapper that is only mounted after streaming completes.
 * It captures the final code at mount time via getState() for initial files.
 * Subsequent code changes are handled by SandpackFileUpdater.
 */
export const SandpackRenderer = React.memo(function SandpackRenderer({
  showCode,
}: SandpackRendererProps) {
  const { appName, logoUrl, navLayout, theme, customTheme, navMenuItems, navBackgroundColor, appNameFontSize, appNameColor, extraFiles } = useAppStore();

  // Capture current code at mount time (non-reactive — no re-render on code change)
  const initialCodeRef = useRef(useAppStore.getState().currentCode);
  const initialExtraRef = useRef(useAppStore.getState().extraFiles);

  const initialFiles = useMemo(
    () =>
      generateSandpackFiles({
        appName,
        logoUrl,
        navLayout,
        theme,
        customTheme,
        navBackgroundColor,
        appNameFontSize,
        appNameColor,
        navMenuItems,
        contentCode: initialCodeRef.current,
        extraFiles: initialExtraRef.current,
      }),
    [appName, logoUrl, navLayout, theme, customTheme, navBackgroundColor, appNameFontSize, appNameColor, navMenuItems]
  );

  return (
    <SandpackProvider
      template="react-ts"
      files={initialFiles}
      customSetup={{
        dependencies: {
          recharts: "^2.12.0",
          echarts: "^5.5.0",
          "echarts-for-react": "^3.0.2",
          "lucide-react": "^0.400.0",
        },
      }}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
        visibleFiles: ["/DashboardContent.tsx"],
        activeFile: "/DashboardContent.tsx",
        classes: {
          "sp-layout": "gen-sandpack-layout",
          "sp-editor": "gen-sandpack-editor",
        },
      }}
    >
      <SandpackFileUpdater />
      <div className="h-full flex flex-col min-h-0">
        <SandpackLayout>
          {/* 始终挂载两者，用 CSS 控制显示，确保 bundler 持续运行、Preview 不空白 */}
          <div
            className={showCode ? "h-full min-h-0 flex-1 flex flex-col" : "hidden"}
          >
            <SandpackCodeEditor
              style={{ flex: 1, minHeight: 0, height: "100%" }}
              showLineNumbers
              showTabs
              readOnly
            />
          </div>
          <div
            className={!showCode ? "h-full min-h-0 flex-1 flex flex-col" : "hidden"}
          >
            <SandpackPreview
              style={{ flex: 1, minHeight: 0 }}
              showNavigator={false}
              showRefreshButton
            />
          </div>
        </SandpackLayout>
      </div>
    </SandpackProvider>
  );
});
