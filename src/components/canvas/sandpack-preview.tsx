"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
  SandpackProvider,
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
  const lastCodeRef = useRef("");

  useEffect(() => {
    if (!currentCode || currentCode === lastCodeRef.current) return;
    lastCodeRef.current = currentCode;
    sandpack.updateFile("/DashboardContent.tsx", currentCode, true);
  }, [currentCode, sandpack]);

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
  const { appName, logoUrl, navLayout, theme } = useAppStore();

  // Capture current code at mount time (non-reactive — no re-render on code change)
  const initialCodeRef = useRef(useAppStore.getState().currentCode);

  const initialFiles = useMemo(
    () =>
      generateSandpackFiles({
        appName,
        logoUrl,
        navLayout,
        theme,
        contentCode: initialCodeRef.current,
      }),
    [appName, logoUrl, navLayout, theme]
  );

  return (
    <SandpackProvider
      template="react-ts"
      files={initialFiles}
      customSetup={{
        dependencies: {
          recharts: "^2.12.0",
          "lucide-react": "^0.400.0",
        },
      }}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
        visibleFiles: ["/DashboardContent.tsx"],
        activeFile: "/DashboardContent.tsx",
      }}
    >
      <SandpackFileUpdater />
      <div className="h-full flex flex-col min-h-0">
        {showCode ? (
          <SandpackCodeEditor
            style={{ flex: 1, minHeight: 0 }}
            showLineNumbers
            showTabs
            readOnly
          />
        ) : (
          <SandpackPreview
            style={{ flex: 1, minHeight: 0 }}
            showNavigator={false}
            showRefreshButton
          />
        )}
      </div>
    </SandpackProvider>
  );
});
