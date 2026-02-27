"use client";

import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
} from "@codesandbox/sandpack-react";
import { useAppStore } from "@/store/app-store";
import { generateSandpackFiles } from "@/lib/sandpack-files";

interface SandpackRendererProps {
  code: string;
  showCode: boolean;
}

export function SandpackRenderer({ code, showCode }: SandpackRendererProps) {
  const { appName, logoUrl, navLayout, theme } = useAppStore();

  const files = generateSandpackFiles({
    appName,
    logoUrl,
    navLayout,
    theme,
    contentCode: code,
  });

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      customSetup={{
        dependencies: {
          recharts: "^2.12.0",
          "lucide-react": "^0.400.0",
        },
      }}
      options={{
        externalResources: [
          "https://cdn.tailwindcss.com",
        ],
        visibleFiles: ["/DashboardContent.tsx"],
        activeFile: "/DashboardContent.tsx",
      }}
    >
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
