export interface ParsedContent {
  text: string;
  codeBlocks: {
    language: "tsx" | "mermaid";
    code: string;
    /** Optional filename for multi-file: ```tsx:utils.ts */
    filename?: string;
  }[];
}

/**
 * Extracts code blocks from LLM response text.
 * Handles mixed content with text and code blocks.
 * Supports multi-file: ```tsx:utils.ts or ```tsx:components/Chart.tsx
 */
export function parseResponse(content: string): ParsedContent {
  // Match ```tsx:filename or ```tsx (default) or ```mermaid
  const codeBlockRegex = /```(tsx|mermaid)(?::([^\n]+))?\s*\n([\s\S]*?)```/g;
  const codeBlocks: ParsedContent["codeBlocks"] = [];
  let text = content;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] as "tsx" | "mermaid";
    const filename = match[2]?.trim();
    const code = match[3].trim();
    if (code.length > 0) {
      codeBlocks.push({ language, code, filename: filename || undefined });
    }
  }

  // Remove code blocks from text to keep only the narrative
  text = content.replace(/```(tsx|mermaid)(?::[^\n]+)?\s*\n[\s\S]*?```/g, "").trim();

  return { text, codeBlocks };
}

/**
 * Check if a streaming response has a complete code block.
 * Used for debouncing rendering during streaming.
 */
export function hasCompleteCodeBlock(content: string): boolean {
  const openBlocks = (content.match(/```(tsx|mermaid)/g) || []).length;
  const closeBlocks = (content.match(/```\s*$/gm) || []).length;
  // Count ``` that appear after a code block opening
  // A more reliable approach: count paired blocks
  const fullBlockRegex = /```(tsx|mermaid)\s*\n[\s\S]*?```/g;
  const fullBlocks = (content.match(fullBlockRegex) || []).length;
  return fullBlocks > 0 && fullBlocks >= openBlocks;
}

/**
 * Extract the last code block from streaming content,
 * even if it's not yet complete (for TSX live preview).
 */
export function extractLatestCodeBlock(
  content: string,
  language: "tsx" | "mermaid"
): string | null {
  const regex = new RegExp(
    "```" + language + "\\s*\\n([\\s\\S]*?)(?:```|$)",
    "g"
  );
  let lastMatch: string | null = null;
  let match;
  while ((match = regex.exec(content)) !== null) {
    lastMatch = match[1].trim();
  }
  return lastMatch;
}

/**
 * Extract all TSX code blocks with optional filenames for multi-file projects.
 * Returns a map of path -> code. DashboardContent.tsx for the main block (no filename).
 */
export function extractAllTsxBlocks(content: string): Record<string, string> {
  const parsed = parseResponse(content);
  const files: Record<string, string> = {};
  for (const block of parsed.codeBlocks) {
    if (block.language !== "tsx") continue;
    const path = block.filename
      ? (block.filename.startsWith("/") ? block.filename : `/${block.filename}`)
      : "/DashboardContent.tsx";
    files[path] = block.code;
  }
  return files;
}
