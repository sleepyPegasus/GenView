"use client";

import { useEffect, useRef, useMemo } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useAppStore } from "@/store/app-store";
import { generateSandpackFiles } from "@/lib/sandpack-files";

interface SandpackRendererProps {
  code: string;
  showCode: boolean;
}

/**
 * Inner component that dynamically updates the DashboardContent.tsx file
 * using the Sandpack API, without remounting the entire provider.
 */
function SandpackFileUpdater({ code }: { code: string }) {
  const { sandpack } = useSandpack();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCodeRef = useRef<string>("");

  useEffect(() => {
    // Skip if code hasn't actually changed
    if (code === lastCodeRef.current) return;

    // Debounce updates during streaming (300ms) to avoid overwhelming Sandpack
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      lastCodeRef.current = code;
      sandpack.updateFile("/DashboardContent.tsx", code, true);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, sandpack]);

  return null;
}

export function SandpackRenderer({ code, showCode }: SandpackRendererProps) {
  const { appName, logoUrl, navLayout, theme } = useAppStore();

  // Generate initial files once — subsequent code updates go through updateFile()
  const initialFiles = useMemo(
    () =>
      generateSandpackFiles({
        appName,
        logoUrl,
        navLayout,
        theme,
        contentCode: code,
      }),
    // Only regenerate when shell config changes, NOT when code changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <SandpackFileUpdater code={code} />
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
}
