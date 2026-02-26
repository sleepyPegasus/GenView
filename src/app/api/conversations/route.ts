import { NextResponse } from "next/server";
import { getConversations, createConversation } from "@/lib/db/conversations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const conversations = await getConversations(projectId);
  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const { projectId, title } = await req.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const conversation = await createConversation(projectId, title);
  return NextResponse.json(conversation, { status: 201 });
}
