import { getPrisma } from "./prisma";

export async function getProjects() {
  const prisma = getPrisma();
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(id: string) {
  const prisma = getPrisma();
  return prisma.project.findUnique({ where: { id } });
}

export async function createProject(data: {
  name?: string;
  logoUrl?: string;
  navLayout?: string;
  theme?: string;
}) {
  const prisma = getPrisma();
  return prisma.project.create({ data });
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    logoUrl?: string;
    navLayout?: string;
    theme?: string;
  }
) {
  const prisma = getPrisma();
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  const prisma = getPrisma();
  return prisma.project.delete({ where: { id } });
}
