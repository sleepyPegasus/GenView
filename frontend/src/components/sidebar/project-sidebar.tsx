"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import {
  listProjects,
  listConversations,
  createProject,
  createConversation,
  getProject,
  getConversation,
  listMessages,
  deleteConversation,
  updateConversation,
  type Project,
  type Conversation,
} from "@/lib/api";
import { MessageSquarePlus, ChevronLeft, ChevronRight, Trash2, Loader2, Pencil } from "lucide-react";

export function ProjectSidebar() {
  const {
    projectId,
    conversationId,
    conversationListVersion,
    setProjectId,
    setConversationId,
    appName,
    logoUrl,
    navLayout,
    theme,
    setAppName,
    setLogoUrl,
    setNavLayout,
    setTheme,
    setCurrentCode,
    setExtraFiles,
    setRenderMode,
  } = useAppStore();

  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Ensure we have a project and conversation on mount
  useEffect(() => {
    let cancelled = false;

    async function ensureProjectAndConversation() {
      try {
        setLoading(true);
        setError(null);

        let pid = projectId;
        let cid = conversationId;

        if (!pid) {
          const existing = await listProjects();
          if (existing.length > 0) {
            pid = existing[0].id;
            setProjectId(pid);
          } else {
            const created = await createProject({
              name: appName,
              logo_url: logoUrl,
              nav_layout: navLayout,
              theme,
            });
            pid = created.id;
            setProjectId(pid);
          }
        }

        if (!cid) {
          const created = await createConversation(pid!, "New Conversation");
          cid = created.id;
          setConversationId(cid);
        }

        if (!cancelled) {
          const convs = await listConversations(pid!);
          setConversations(convs);
          // Load project settings into store for persistence
          const proj = await getProject(pid!);
          setAppName(proj.name);
          setLogoUrl(proj.logo_url);
          setNavLayout(proj.nav_layout as "top" | "side");
          setTheme(proj.theme as "modern-b2b" | "dark-dashboard" | "steel-metallurgy" | "wind-energy");
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load";
          setError(msg);
          toast.error("Failed to load projects", { description: msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    ensureProjectAndConversation();
    return () => { cancelled = true; };
  }, []);

  // Refresh conversations when project, conversation, or list invalidated
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    listConversations(projectId).then((conv) => {
      if (!cancelled) setConversations(conv);
    });

    return () => { cancelled = true; };
  }, [projectId, conversationId, conversationListVersion]);

  const handleNewConversation = async () => {
    if (!projectId) return;
    try {
      const conv = await createConversation(projectId, "New Conversation");
      setConversationId(conv.id);
      setConversations((prev) => [conv, ...prev]);
      setCurrentCode("");
      setExtraFiles({});
      setRenderMode(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create";
      setError(msg);
      toast.error("Failed to create conversation", { description: msg });
    }
  };

  const handleSelectConversation = async (cid: string) => {
    setConversationId(cid);
    try {
      const msgs = await listMessages(cid);
      const lastWithCode = [...msgs].reverse().find((m) => m.code_block);
      if (lastWithCode?.code_block) {
        setCurrentCode(lastWithCode.code_block);
        setExtraFiles({});
        setRenderMode(lastWithCode.code_language === "tsx" ? "sandpack" : "mermaid");
      } else {
        setCurrentCode("");
        setExtraFiles({});
        setRenderMode(null);
      }
    } catch {
      setCurrentCode("");
      setExtraFiles({});
      setRenderMode(null);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, c: Conversation) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateConversation(editingId, { title: editingTitle.trim() });
      setConversations((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, title: editingTitle.trim() } : c))
      );
    } catch (err) {
      toast.error("Failed to rename", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, cid: string) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await deleteConversation(cid);
      setConversations((prev) => prev.filter((c) => c.id !== cid));
      if (conversationId === cid) {
        const remaining = conversations.filter((c) => c.id !== cid);
        if (remaining.length > 0) {
          handleSelectConversation(remaining[0].id);
        } else {
          await handleNewConversation();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setError(msg);
      toast.error("Failed to delete conversation", { description: msg });
    }
  };

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-2 flex-shrink-0"
        style={{ width: 40, borderRight: "1px solid var(--gen-border)" }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-md transition-colors"
          style={{ color: "var(--gen-muted-fg)" }}
          title="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 220, borderRight: "1px solid var(--gen-border)" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--gen-border)" }}
      >
        <span className="text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>
          Conversations
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--gen-muted-fg)" }}
          title="Collapse sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--gen-primary)" }} />
          </div>
        ) : error ? (
          <p className="text-xs py-4" style={{ color: "var(--gen-muted-fg)" }}>
            {error}
          </p>
        ) : (
          <>
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-2"
              style={{
                background: "var(--gen-primary)",
                color: "#fff",
              }}
            >
              <MessageSquarePlus size={14} />
              New Conversation
            </button>
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => !editingId && handleSelectConversation(c.id)}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: conversationId === c.id ? "var(--gen-muted)" : "transparent",
                    color: conversationId === c.id ? "var(--gen-foreground)" : "var(--gen-muted-fg)",
                  }}
                >
                  {editingId === c.id ? (
                    <input
                      className="flex-1 min-w-0 text-xs px-2 py-1 rounded border"
                      style={{
                        background: "var(--gen-background)",
                        color: "var(--gen-foreground)",
                        borderColor: "var(--gen-border)",
                      }}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={handleSaveEdit}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate text-xs">{c.title}</span>
                      <button
                        onClick={(e) => handleStartEdit(e, c)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                        style={{ color: "var(--gen-muted-fg)" }}
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(e, c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                        style={{ color: "var(--gen-muted-fg)" }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
