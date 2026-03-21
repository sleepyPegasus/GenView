"use client";

import { useState } from "react";
import { ProjectList } from "@/components/project-list/project-list";
import { CustomerManagementPanel } from "@/components/customer/customer-management-panel";
import { FolderOpen, Users } from "lucide-react";

type HomeTab = "projects" | "customers";

export default function Home() {
  const [activeTab, setActiveTab] = useState<HomeTab>("projects");

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      data-theme="modern-b2b"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      {/* 左侧边栏 */}
      <aside
        className="w-48 flex-shrink-0 flex flex-col"
        style={{
          borderRight: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <h1 className="text-lg font-bold" style={{ color: "#f1f5f9" }}>
            GenView
          </h1>
        </div>
        <nav className="p-3 space-y-1">
          <button
            onClick={() => setActiveTab("projects")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === "projects" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "projects" ? "#f1f5f9" : "#94a3b8",
            }}
          >
            <FolderOpen size={18} />
            项目管理
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === "customers" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "customers" ? "#f1f5f9" : "#94a3b8",
            }}
          >
            <Users size={18} />
            客户管理
          </button>
        </nav>
      </aside>
      {/* 主内容 */}
      <main className="flex-1 min-w-0 min-h-0 overflow-auto flex flex-col">
        {activeTab === "projects" && <ProjectList />}
        {activeTab === "customers" && <CustomerManagementPanel />}
      </main>
    </div>
  );
}
