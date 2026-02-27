/**
 * API client for projects, conversations, and messages.
 * Uses NEXT_PUBLIC_BACKEND_URL when available to avoid proxy buffering.
 */
function getBaseUrl(): string {
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
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  project_id: string;
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

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${getBaseUrl()}/api/projects`);
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
  data: { name?: string; logo_url?: string; nav_layout?: string; theme?: string }
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

export async function updateConversation(
  conversationId: string,
  data: { title: string }
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
 * Returns { projectId, conversationId } for the caller to set in store.
 */
export async function ensureProjectAndConversation(settings: {
  appName: string;
  logoUrl: string;
  navLayout: string;
  theme: string;
  existingProjectId?: string | null;
  existingConversationId?: string | null;
}): Promise<{ projectId: string; conversationId: string }> {
  let projectId = settings.existingProjectId;
  let conversationId = settings.existingConversationId;

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
  }

  return { projectId, conversationId };
}
