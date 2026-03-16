/**
 * Chat API helpers - used by ChatPanel and AIModifyInlinePopover.
 */
export function getChatUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`;
  }
  return "/api/chat";
}
