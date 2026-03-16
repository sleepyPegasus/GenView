/**
 * API client for projects, conversations, and messages.
 * Uses NEXT_PUBLIC_BACKEND_URL when available to avoid proxy buffering.
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }
  return "";
}

export interface Project {
  id: string;
  name: string;
  logo_url: string;
  nav_layout: string;
  theme: string;
  custom_theme?: Record<string, unknown> | null;
  model?: string;
  kg_model?: string | null;
  conversation_mode?: string;
  nav_background_color?: string | null;
  app_name_font_size?: string | null;
  app_name_color?: string | null;
  nav_config?: {
    items?: NavConfigItem[];
    top?: { pageId: string; label: string }[];
    side?: { pageId: string; label: string }[];
  } | null;
  nav_menu_items?: NavMenuItem[] | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Page {
  id: string;
  project_id: string;
  name: string;
  nav_label: string;
  code_block: string;
  code_language: string;
  extra_files?: Record<string, string> | null;
  source_conversation_id?: string | null;
  source_message_id?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NavMenuChild {
  label: string;
  icon?: string;
  selected?: boolean;
}

export interface NavMenuItem {
  label: string;
  icon?: string;
  selected?: boolean;
  /** Secondary menu items (nested under this item) */
  children?: NavMenuChild[];
}

/** For nav_config: leaf has pageId, group has children with pageIds */
export interface NavConfigItem {
  label: string;
  pageId?: string;
  children?: { label: string; pageId: string }[];
}

/** Flatten nav_config.items to { pageId, label }[] for routing/preview */
export function flattenNavConfigItems(items: NavConfigItem[] | undefined): { pageId: string; label: string }[] {
  if (!items?.length) return [];
  const result: { pageId: string; label: string }[] = [];
  for (const item of items) {
    if (item.pageId) result.push({ pageId: item.pageId, label: item.label });
    if (item.children) {
      for (const ch of item.children) {
        if (ch.pageId) result.push({ pageId: ch.pageId, label: ch.label });
      }
    }
  }
  return result;
}

/** Flatten nav_menu_items to get all labels (for page assignment when no config) */
export function flattenNavMenuLabels(items: NavMenuItem[] | undefined): string[] {
  if (!items?.length) return [];
  return items.flatMap((i) => [i.label, ...(i.children ?? []).map((c) => c.label)]);
}

export interface Conversation {
  id: string;
  title: string;
  project_id: string;
  app_name: string;
  logo_url: string;
  nav_layout: string;
  theme: string;
  custom_theme?: Record<string, unknown> | null;
  model: string;
  conversation_mode?: string;
  nav_background_color?: string | null;
  app_name_font_size?: string | null;
  app_name_color?: string | null;
  nav_menu_items?: NavMenuItem[] | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  code_block: string | null;
  code_language: string | null;
  created_at: string;
}

export async function listProjects(options?: { deleted?: boolean }): Promise<Project[]> {
  const params = new URLSearchParams();
  if (options?.deleted) params.set("deleted", "true");
  const url = `${getBaseUrl()}/api/projects${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list projects: ${res.statusText}`);
  return res.json();
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to get project: ${res.statusText}`);
  return res.json();
}

export interface SearchResult {
  id: string;
  type: "conversation" | "page" | "timeline";
  title: string;
  summary: string | null;
}

export async function searchProject(
  projectId: string,
  q: string,
  type: "all" | "conversations" | "pages" | "timeline" = "all"
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: q.trim(), type });
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/search?${params}`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  return res.json();
}

export async function exportProject(
  projectId: string,
  format: "vite" = "vite"
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/export?format=${format}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Failed to export: ${res.statusText}`);
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  const filename = match ? match[1].trim() : "genview-export.zip";
  return { blob, filename };
}

export async function createProject(data: {
  name?: string;
  logo_url?: string;
  nav_layout?: string;
  theme?: string;
}): Promise<Project> {
  const res = await fetch(`${getBaseUrl()}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: data.name ?? "GenView Dashboard",
      logo_url: data.logo_url ?? "",
      nav_layout: data.nav_layout ?? "side",
      theme: data.theme ?? "modern-b2b",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
  return res.json();
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    logo_url?: string;
    nav_layout?: string;
    theme?: string;
    custom_theme?: Record<string, unknown> | null;
    model?: string;
    kg_model?: string | null;
    conversation_mode?: string;
    nav_background_color?: string | null;
    app_name_font_size?: string | null;
    app_name_color?: string | null;
    nav_config?: {
      items?: NavConfigItem[];
      top?: { pageId: string; label: string }[];
      side?: { pageId: string; label: string }[];
    } | null;
    nav_menu_items?: NavMenuItem[] | null;
  }
): Promise<Project> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Failed to update project: ${res.statusText}`);
  return res.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
}

export async function restoreProject(projectId: string): Promise<Project> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/restore`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Failed to restore project: ${res.statusText}`);
  return res.json();
}

export async function purgeProject(projectId: string): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/purge`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to purge project: ${res.statusText}`);
}

export async function listPages(projectId: string): Promise<Page[]> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages`);
  if (!res.ok) throw new Error(`Failed to list pages: ${res.statusText}`);
  return res.json();
}

export async function getPage(projectId: string, pageId: string): Promise<Page> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}`
  );
  if (!res.ok) throw new Error(`Failed to get page: ${res.statusText}`);
  return res.json();
}

export async function exportPageHtml(
  projectId: string,
  pageId: string,
  format: "mermaid" = "mermaid"
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/export-html?format=${format}`
  );
  if (!res.ok) throw new Error(`Failed to export: ${res.statusText}`);
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  const filename = match ? match[1].trim() : "diagram.html";
  return { blob, filename };
}

export async function createPage(
  projectId: string,
  data: {
    name: string;
    nav_label?: string;
    code_block: string;
    code_language: string;
    extra_files?: Record<string, string>;
    source_conversation_id?: string;
    source_message_id?: string;
  }
): Promise<Page> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create page: ${res.statusText}`);
  return res.json();
}

export async function updatePage(
  projectId: string,
  pageId: string,
  data: { name?: string; nav_label?: string; code_block?: string; extra_files?: Record<string, string>; sort_order?: number }
): Promise<Page> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Failed to update page: ${res.statusText}`);
  return res.json();
}

export async function deletePage(projectId: string, pageId: string): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete page: ${res.statusText}`);
}

export interface TimelineAttachment {
  name: string;
  url: string;
}

export interface TimelineEvent {
  id: string;
  project_id: string;
  type: "phase" | "custom";
  phase_key?: string | null;
  phase_label?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  title?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  description?: string | null;
  outcome?: string | null;
  participants?: string | null;
  tags?: string[] | null;
  attachments?: TimelineAttachment[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listTimeline(projectId: string): Promise<TimelineEvent[]> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline`);
  if (!res.ok) throw new Error(`Failed to list timeline: ${res.statusText}`);
  return res.json();
}

export async function initTimeline(projectId: string): Promise<TimelineEvent[]> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline/init`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to init timeline: ${res.statusText}`);
  return res.json();
}

export async function createTimelineEvent(
  projectId: string,
  data: Partial<TimelineEvent> & { type: "phase" | "custom" }
): Promise<TimelineEvent> {
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create timeline event: ${res.statusText}`);
  return res.json();
}

export async function reorderTimelineEvents(
  projectId: string,
  eventIds: string[]
): Promise<TimelineEvent[]> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline/reorder`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_ids: eventIds }),
    }
  );
  if (!res.ok) throw new Error(`Failed to reorder timeline: ${res.statusText}`);
  return res.json();
}

export async function updateTimelineEvent(
  projectId: string,
  eventId: string,
  data: Partial<TimelineEvent>
): Promise<TimelineEvent> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Failed to update timeline event: ${res.statusText}`);
  return res.json();
}

export type KgBuildEvent = "log" | "progress" | "done" | "error";

export interface KgDocCount {
  has_documents: boolean;
  doc_count: number;
  msg_count: number;
  page_count: number;
  timeline_count: number;
}

export async function getKgDocCount(projectId: string): Promise<KgDocCount> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/doc-count`
  );
  if (!res.ok) throw new Error("Failed to fetch doc count");
  return res.json();
}

export interface KgSimpleSearchChunk {
  id: string;
  type: "message" | "page";
  source_id: string;
  snippet: string;
}

export async function kgSimpleSearch(
  projectId: string,
  q: string
): Promise<{ chunks: KgSimpleSearchChunk[] }> {
  const params = new URLSearchParams({ q: q.trim() });
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/simple-search?${params}`
  );
  if (!res.ok) throw new Error(`Simple search failed: ${res.statusText}`);
  return res.json();
}

export async function buildKnowledgeGraphStream(
  projectId: string,
  onEvent: (event: KgBuildEvent, data: Record<string, unknown>) => void
): Promise<{ doc_count: number; status?: string }> {
  const url = `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/build`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to build knowledge graph: ${res.statusText}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { doc_count: number; status?: string } = { doc_count: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const eventMatch = part.match(/^event: (\w+)\n/m);
      const dataMatch = part.match(/data: (.+)$/ms);
      if (eventMatch && dataMatch) {
        const event = eventMatch[1] as KgBuildEvent;
        try {
          const data = JSON.parse(dataMatch[1].trim()) as Record<string, unknown>;
          onEvent(event, data);
          if (event === "done") {
            result = {
              doc_count: (data.doc_count as number) ?? 0,
              status: data.status as string | undefined,
            };
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }
  return result;
}

export type KgQueryStreamEvent = "log" | "step" | "thinking" | "done" | "session" | "error";

export async function queryKnowledgeGraphStream(
  projectId: string,
  question: string,
  onEvent: (event: KgQueryStreamEvent, data: Record<string, unknown>) => void,
  mode?: string,
  sessionId?: string | null
): Promise<{ answer: string; session_id: string }> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/query-stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, mode: mode ?? "hybrid", session_id: sessionId ?? undefined }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = (errBody as { detail?: string })?.detail ?? res.statusText;
    throw new Error(`查询失败：${detail}`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { answer: string; session_id: string } = { answer: "", session_id: sessionId ?? "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const eventMatch = part.match(/^event: (\w+)\n/m);
      const dataMatch = part.match(/data: (.+)$/ms);
      if (eventMatch && dataMatch) {
        const event = eventMatch[1] as KgQueryStreamEvent;
        try {
          const data = JSON.parse(dataMatch[1].trim()) as Record<string, unknown>;
          onEvent(event, data);
          if (event === "done") {
            result.answer = (data.answer as string) ?? "";
          } else if (event === "session") {
            result.session_id = (data.session_id as string) ?? result.session_id;
          } else if (event === "error") {
            throw new Error((data.message as string) ?? "Query failed");
          }
        } catch (e) {
          if (e instanceof Error && event === "error") throw e;
        }
      }
    }
  }
  return result;
}

export async function queryKnowledgeGraph(
  projectId: string,
  question: string,
  mode?: string,
  sessionId?: string | null
): Promise<{ answer: string; session_id: string }> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, mode: mode ?? "hybrid", session_id: sessionId ?? undefined }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = (errBody as { detail?: string })?.detail ?? res.statusText;
    throw new Error(`查询失败：${detail}`);
  }
  const data = await res.json();
  return { answer: data.answer ?? "", session_id: data.session_id ?? "" };
}

export interface KgQuerySessionItem {
  id: string;
  project_id: string;
  title: string;
  created_at: string | null;
}

export async function listKgQuerySessions(
  projectId: string,
  limit = 50
): Promise<KgQuerySessionItem[]> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/query-sessions?limit=${limit}`
  );
  if (!res.ok) throw new Error("Failed to fetch query sessions");
  return res.json();
}

export interface KgQueryMessageItem {
  id: string;
  project_id: string;
  role: string;
  content: string;
  query_mode: string | null;
  created_at: string | null;
}

export async function listKgQueryHistory(
  projectId: string,
  sessionId: string,
  limit = 100
): Promise<KgQueryMessageItem[]> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/query-history?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`
  );
  if (!res.ok) throw new Error("Failed to fetch query history");
  return res.json();
}

export interface KgBuildHistoryItem {
  id: string;
  project_id: string;
  doc_count: number;
  msg_count?: number;
  page_count?: number;
  timeline_count?: number;
  node_count?: number | null;
  edge_count?: number | null;
  duration_seconds?: number | null;
  status: string;
  error: string | null;
  created_at: string | null;
}

export async function listKgBuildHistory(
  projectId: string,
  limit = 20
): Promise<KgBuildHistoryItem[]> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/build-history?limit=${limit}`
  );
  if (!res.ok) throw new Error("Failed to fetch build history");
  return res.json();
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type?: string;
  properties: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  is_truncated: boolean;
}

export async function getKnowledgeGraph(
  projectId: string,
  maxNodes = 500
): Promise<KnowledgeGraphData> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/kg/graph?max_nodes=${maxNodes}`
  );
  if (!res.ok) throw new Error(`Failed to get knowledge graph: ${res.statusText}`);
  return res.json();
}

export async function deleteTimelineEvent(projectId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete timeline event: ${res.statusText}`);
}

export async function uploadTimelineAttachment(
  projectId: string,
  eventId: string,
  file: File
): Promise<TimelineAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/timeline/${encodeURIComponent(eventId)}/attachments`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(`Failed to upload attachment: ${res.statusText}`);
  const data = await res.json();
  return { name: data.name, url: getBaseUrl() + data.url };
}

export async function listConversations(projectId: string): Promise<Conversation[]> {
  const res = await fetch(`${getBaseUrl()}/api/conversations?project_id=${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to list conversations: ${res.statusText}`);
  return res.json();
}

export async function createConversation(projectId: string, title?: string): Promise<Conversation> {
  const res = await fetch(`${getBaseUrl()}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, title: title ?? "New Conversation" }),
  });
  if (!res.ok) throw new Error(`Failed to create conversation: ${res.statusText}`);
  return res.json();
}

export async function getConversation(conversationId: string): Promise<Conversation & { messages?: Message[] }> {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${encodeURIComponent(conversationId)}`);
  if (!res.ok) throw new Error(`Failed to get conversation: ${res.statusText}`);
  return res.json();
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  if (!res.ok) throw new Error(`Failed to list messages: ${res.statusText}`);
  return res.json();
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  const res = await fetch(
    `${getBaseUrl()}/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete message: ${res.statusText}`);
}

export async function updateConversation(
  conversationId: string,
  data: {
    title?: string;
    app_name?: string;
    logo_url?: string;
    nav_layout?: string;
    theme?: string;
    custom_theme?: Record<string, unknown> | null;
    model?: string;
    conversation_mode?: string;
    nav_background_color?: string | null;
    app_name_font_size?: string | null;
    app_name_color?: string | null;
    nav_menu_items?: NavMenuItem[] | null;
  }
): Promise<Conversation> {
  const res = await fetch(
    `${getBaseUrl()}/api/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error(`Failed to update conversation: ${res.statusText}`);
  return res.json();
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete conversation: ${res.statusText}`);
}

/**
 * Ensure a project and conversation exist. Creates them if needed.
 * Returns { projectId, conversationId, conversation? } for the caller to set in store.
 * When a new conversation is created, conversation is returned (with config inherited from project).
 */
export async function ensureProjectAndConversation(settings: {
  appName: string;
  logoUrl: string;
  navLayout: string;
  theme: string;
  existingProjectId?: string | null;
  existingConversationId?: string | null;
}): Promise<{ projectId: string; conversationId: string; conversation?: Conversation }> {
  let projectId = settings.existingProjectId;
  let conversationId = settings.existingConversationId;
  let conversation: Conversation | undefined;

  if (!projectId) {
    const projects = await listProjects();
    if (projects.length > 0) {
      projectId = projects[0].id;
    } else {
      const created = await createProject({
        name: settings.appName,
        logo_url: settings.logoUrl,
        nav_layout: settings.navLayout,
        theme: settings.theme,
      });
      projectId = created.id;
    }
  }

  if (!conversationId) {
    const created = await createConversation(projectId!, "New Conversation");
    conversationId = created.id;
    conversation = created;
  }

  return { projectId, conversationId, conversation };
}
