import { getPrisma } from "./prisma";

export async function getMessages(conversationId: string) {
  const prisma = getPrisma();
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMessage(data: {
  conversationId: string;
  role: string;
  content: string;
  codeBlock?: string;
  codeLanguage?: string;
}) {
  const prisma = getPrisma();
  return prisma.message.create({ data });
}

export async function deleteMessagesAfter(conversationId: string, messageId: string) {
  const prisma = getPrisma();
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) return;
  return prisma.message.deleteMany({
    where: {
      conversationId,
      createdAt: { gt: msg.createdAt },
    },
  });
}
