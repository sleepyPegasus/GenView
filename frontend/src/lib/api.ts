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
