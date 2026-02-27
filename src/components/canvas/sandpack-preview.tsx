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
 * Inner component that subscribes to currentCode from the Zustand store
 * and dynamically updates the DashboardContent.tsx file via Sandpack API.
 *
 * This is deliberately isolated from SandpackProvider's render cycle —
 * when currentCode changes, only this component re-renders (via store
 * subscription), NOT the SandpackProvider itself. This prevents the
 * Provider from resetting its internal file state.
 */
function SandpackFileUpdater() {
  const { sandpack } = useSandpack();
  const currentCode = useAppStore((s) => s.currentCode);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCodeRef = useRef<string>("");

  useEffect(() => {
    if (!currentCode || currentCode === lastCodeRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      lastCodeRef.current = currentCode;
      sandpack.updateFile("/DashboardContent.tsx", currentCode, true);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentCode, sandpack]);

  return null;
}

interface SandpackRendererProps {
  showCode: boolean;
}

/**
 * Memoized Sandpack wrapper. Only re-renders when `showCode` changes
 * (Preview ↔ Code tab switch). Code updates go through SandpackFileUpdater
 * which calls sandpack.updateFile() without causing the Provider to remount.
 */
export const SandpackRenderer = React.memo(function SandpackRenderer({
  showCode,
}: SandpackRendererProps) {
  const { appName, logoUrl, navLayout, theme } = useAppStore();

  // Capture current code at mount time for initial files (non-reactive)
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
      <div className="h-full flex flex-col">
        {showCode ? (
          <SandpackCodeEditor
            style={{ flex: 1 }}
            showLineNumbers
            showTabs
            readOnly
          />
        ) : (
          <SandpackPreview
            style={{ flex: 1 }}
            showNavigator={false}
            showRefreshButton
          />
        )}
      </div>
    </SandpackProvider>
  );
});
