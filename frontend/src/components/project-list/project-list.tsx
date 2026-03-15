"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  restoreProject,
  purgeProject,
  listTimeline,
  type Project,
  type TimelineEvent,
} from "@/lib/api";
import Link from "next/link";
import { ThemeInjector } from "@/components/theme-injector";
import { Plus, Pencil, Trash2, Loader2, FolderOpen, RotateCcw, Trash } from "lucide-react";

type TabType = "active" | "deleted";

export function ProjectList() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("active");
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState<Project | null>(null);
  const [timelinesByProject, setTimelinesByProject] = useState<Record<string, TimelineEvent[]>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProjects(), listProjects({ deleted: true })])
      .then(([active, deleted]) => {
        if (!cancelled) {
          setProjects(active);
          setDeletedProjects(deleted);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const displayProjects = tab === "active" ? projects : deletedProjects;

  useEffect(() => {
    if (displayProjects.length === 0) return;
    let cancelled = false;
    const ids = displayProjects.map((p) => p.id);
    Promise.all(ids.map((id) => listTimeline(id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, TimelineEvent[]> = {};
        ids.forEach((id, i) => {
          map[id] = results[i] ?? [];
        });
        setTimelinesByProject(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [displayProjects.length > 0 ? displayProjects.map((p) => p.id).join(",") : ""]);

  const formatDate = (d: string | null | undefined) => (d ? d.replace(/-/g, "/") : "-");

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

  const handleDeleteClick = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setDeleteConfirm(p);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const p = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteProject(p.id);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      setDeletedProjects((prev) => [...prev, { ...p, deleted_at: new Date().toISOString() }]);
      toast.success("项目已移至回收站");
    } catch (err) {
      toast.error("删除失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleRestore = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    try {
      const restored = await restoreProject(p.id);
      setDeletedProjects((prev) => prev.filter((x) => x.id !== p.id));
      setProjects((prev) => [restored, ...prev]);
      toast.success("项目已恢复");
    } catch (err) {
      toast.error("恢复失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handlePurgeClick = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setPurgeConfirm(p);
  };

  const handlePurgeConfirm = async () => {
    if (!purgeConfirm) return;
    const p = purgeConfirm;
    setPurgeConfirm(null);
    try {
      await purgeProject(p.id);
      setDeletedProjects((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("项目已永久删除");
    } catch (err) {
      toast.error("永久删除失败", {
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
          className="w-full max-w-5xl rounded-2xl p-8 backdrop-blur-xl border"
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

          <div className="flex gap-2 mb-6">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
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
            <button
              onClick={() => setTab(tab === "active" ? "deleted" : "active")}
              className="px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Trash size={18} />
              {tab === "active" ? "回收站" : "返回"}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
            </div>
          ) : displayProjects.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#94a3b8" }}
            >
              <FolderOpen size={48} className="mb-4 opacity-50" />
              <p className="text-sm font-medium mb-1">
                {tab === "deleted" ? "回收站为空" : "No projects yet"}
              </p>
              <p className="text-xs">
                {tab === "deleted" ? "已删除的项目会显示在这里" : "Create your first project to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => !editingId && tab === "active" && handleOpen(p)}
                  className="group flex flex-col p-5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {editingId === p.id && tab === "active" ? (
                    <input
                      className="w-full text-sm px-3 py-2 rounded border"
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
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <FolderOpen size={24} style={{ color: "#94a3b8" }} />
                          </div>
                          <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: "#f1f5f9" }}>
                            {p.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {tab === "active" ? (
                            <>
                              <Link
                                href={`/projects/${p.id}?tab=resources`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-1.5 rounded text-xs transition-colors hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="页面集"
                              >
                                页面集
                              </Link>
                              <Link
                                href={`/projects/${p.id}/design`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-1.5 rounded text-xs transition-colors hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="Design"
                              >
                                Design
                              </Link>
                              <button
                                onClick={(e) => handleStartEdit(e, p)}
                                className="p-2 rounded transition-colors hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="Rename"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, p)}
                                className="p-2 rounded transition-colors hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => handleRestore(e, p)}
                                className="p-2 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
                                style={{ color: "#94a3b8" }}
                                title="Restore"
                              >
                                <RotateCcw size={14} />
                                <span className="text-xs">恢复</span>
                              </button>
                              <button
                                onClick={(e) => handlePurgeClick(e, p)}
                                className="p-2 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
                                style={{ color: "#ef4444" }}
                                title="Permanently delete"
                              >
                                <Trash size={14} />
                                <span className="text-xs">永久删除</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className={`mt-3 pt-3 ${tab === "active" ? "cursor-pointer" : ""}`}
                        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tab === "active") router.push(`/projects/${p.id}?tab=timeline`);
                        }}
                      >
                        {(timelinesByProject[p.id] ?? []).length === 0 ? (
                          <p className="text-xs" style={{ color: "#64748b" }}>
                            暂无时间线
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {(timelinesByProject[p.id] ?? [])
                              .filter((ev) => ev.start_date || ev.event_date)
                              .sort((a, b) =>
                                (b.start_date || b.event_date || "").localeCompare(a.start_date || a.event_date || "")
                              )
                              .slice(0, 5)
                              .map((ev) => (
                                <div key={ev.id} className="text-xs flex gap-2" style={{ color: "#94a3b8" }}>
                                  <span className="shrink-0">{formatDate(ev.start_date || ev.event_date)}</span>
                                  <span className="truncate">{ev.phase_label || ev.title || "事件"}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: "#f1f5f9" }}>
              确认删除
            </h3>
            <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>
              将项目「{deleteConfirm.name}」移至回收站？可在回收站中恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                移至回收站
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge confirmation dialog */}
      {purgeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setPurgeConfirm(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: "#f1f5f9" }}>
              永久删除
            </h3>
            <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>
              确定要永久删除「{purgeConfirm.name}」？此操作不可恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPurgeConfirm(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handlePurgeConfirm}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                永久删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
