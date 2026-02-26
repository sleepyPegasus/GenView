import { getPrisma } from "./prisma";

export async function getConversations(projectId: string) {
  const prisma = getPrisma();
  return prisma.conversation.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
}

export async function getConversation(id: string) {
  const prisma = getPrisma();
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      project: true,
    },
  });
}

export async function createConversation(projectId: string, title?: string) {
  const prisma = getPrisma();
  return prisma.conversation.create({
    data: { projectId, title: title ?? "New Conversation" },
  });
}

export async function deleteConversation(id: string) {
  const prisma = getPrisma();
  return prisma.conversation.delete({ where: { id } });
}
