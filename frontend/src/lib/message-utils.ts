import type { UIMessage } from "ai";

/**
 * Extract the full text content from a UIMessage by concatenating all text parts.
 */
export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
