"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type Project,
} from "@/lib/api";
import Link from "next/link";
import { ThemeInjector } from "@/components/theme-injector";
import { Plus, Pencil, Trash2, Loader2, FolderOpen } from "lucide-react";

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((p) => {
        if (!cancelled) setProjects(p);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const p = await createProject({ name: "New Project" });
      setProjects((prev) => [p, ...prev]);
      router.push(`/projects/${p.id}`);
    } catch (err) {
      toast.error("Failed to create project", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = (p: Project) => {
    router.push(`/projects/${p.id}`);
  };

  const handleStartEdit = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditingName(p.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateProject(editingId, { name: editingName.trim() });
      setProjects((prev) =>
        prev.map((x) => (x.id === editingId ? { ...x, name: updated.name } : x))
      );
    } catch (err) {
      toast.error("Failed to rename", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (!confirm(`Delete project "${p.name}"? All conversations will be lost.`)) return;
    try {
      await deleteProject(p.id);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Project deleted");
    } catch (err) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div
      className="relative flex h-screen w-screen overflow-hidden"
      data-theme="modern-b2b"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      <ThemeInjector />
      {/* 背景光斑 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.35) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 40%), radial-gradient(ellipse 50% 30% at 20% 80%, rgba(37, 99, 235, 0.2) 0%, transparent 40%)",
        }}
      />
      {/* 网格 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-8">
        <div
          className="w-full max-w-2xl rounded-2xl p-8 backdrop-blur-xl border"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f1f5f9" }}>
            GenView
          </h1>
          <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
            Select a project or create a new one to start designing dashboards with AI.
          </p>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium mb-6 transition-colors"
            style={{
              background: "var(--gen-primary)",
              color: "#fff",
            }}
          >
            {creating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {creating ? "Creating..." : "Create Project"}
          </button>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
            </div>
          ) : projects.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#94a3b8" }}
            >
              <FolderOpen size={48} className="mb-4 opacity-50" />
              <p className="text-sm font-medium mb-1">No projects yet</p>
              <p className="text-xs">Create your first project to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => !editingId && handleOpen(p)}
                  className="group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-white/10"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {editingId === p.id ? (
                    <input
                      className="flex-1 min-w-0 text-sm px-3 py-2 rounded border"
                      style={{
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "#f1f5f9",
                        borderColor: "rgba(255,255,255,0.2)",
                      }}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <FolderOpen size={20} style={{ color: "#94a3b8" }} />
                      <span className="flex-1 truncate text-sm font-medium" style={{ color: "#f1f5f9" }}>
                        {p.name}
                      </span>
                      <Link
                        href={`/projects/${p.id}?tab=pages`}
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1.5 rounded text-xs transition-opacity hover:bg-white/10"
                        style={{ color: "#94a3b8" }}
                        title="页面集"
                      >
                        页面集
                      </Link>
                      <Link
                        href={`/projects/${p.id}/design`}
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1.5 rounded text-xs transition-opacity hover:bg-white/10"
                        style={{ color: "#94a3b8" }}
                        title="Design"
                      >
                        Design
                      </Link>
                      <button
                        onClick={(e) => handleStartEdit(e, p)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded transition-opacity hover:bg-white/10"
                        style={{ color: "#94a3b8" }}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded transition-opacity hover:bg-white/10"
                        style={{ color: "#94a3b8" }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
