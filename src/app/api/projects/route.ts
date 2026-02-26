import { NextResponse } from "next/server";
import { getProjects, createProject } from "@/lib/db/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await getProjects();
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  const project = await createProject(body);
  return NextResponse.json(project, { status: 201 });
}
