export interface ParsedContent {
  text: string;
  codeBlocks: {
    language: "tsx" | "mermaid" | "python";
    code: string;
    /** Optional filename for multi-file: ```tsx:utils.ts */
    filename?: string;
  }[];
}

const CODE_BLOCK_LANG_PATTERN = "(tsx|typescript|ts|jsx|javascript|js|react|mermaid|python)";

/** Map model output language tags to our canonical types */
const LANGUAGE_ALIASES: Record<string, "tsx" | "mermaid" | "python"> = {
  tsx: "tsx",
  typescript: "tsx",
  ts: "tsx",
  jsx: "tsx",
  javascript: "tsx",
  js: "tsx",
  react: "tsx",
  mermaid: "mermaid",
  python: "python",
};

/**
 * Extracts code blocks from LLM response text.
 * Handles mixed content with text and code blocks.
 * Supports multi-file: ```tsx:utils.ts or ```tsx:components/Chart.tsx
 * Accepts typescript/ts/jsx as equivalent to tsx for AI modify compatibility.
 */
export function parseResponse(content: string): ParsedContent {
  // Match ```tsx, ```typescript, ```mermaid, ```python, etc.
  const codeBlockRegex = new RegExp("```" + CODE_BLOCK_LANG_PATTERN + "(?::([^\\n]+))?\\s*\\n([\\s\\S]*?)```", "g");
  const codeBlocks: ParsedContent["codeBlocks"] = [];
  let text = content;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawLang = match[1].toLowerCase();
    const language = LANGUAGE_ALIASES[rawLang] ?? "tsx";
    const filename = match[2]?.trim();
    const code = match[3].trim();
    if (code.length > 0) {
      codeBlocks.push({ language, code, filename: filename || undefined });
    }
  }

  // Fallback: match generic ```lang\n...\n``` (any lang) or ```\n...\n```
  if (codeBlocks.length === 0) {
    const genericRegex = /```(?:([a-zA-Z0-9+#-]*)\s*\n)?([\s\S]*?)```/g;
    while ((match = genericRegex.exec(content)) !== null) {
      const code = match[2].trim();
      if (code.length > 0) {
        const rawLang = (match[1] || "").toLowerCase();
        const language = LANGUAGE_ALIASES[rawLang] ?? "tsx";
        codeBlocks.push({ language, code });
      }
    }
  }

  // Remove code blocks from text to keep only the narrative
  text = content.replace(new RegExp("```" + CODE_BLOCK_LANG_PATTERN + "(?::[^\\n]+)?\\s*\\n[\\s\\S]*?```", "g"), "").trim();

  return { text, codeBlocks };
}

/**
 * Check if a streaming response has a complete code block.
 * Used for debouncing rendering during streaming.
 */
export function hasCompleteCodeBlock(content: string): boolean {
  const openBlocks = (content.match(new RegExp("```" + CODE_BLOCK_LANG_PATTERN, "g")) || []).length;
  const fullBlockRegex = new RegExp("```" + CODE_BLOCK_LANG_PATTERN + "\\s*\\n[\\s\\S]*?```", "g");
  const fullBlocks = (content.match(fullBlockRegex) || []).length;
  return fullBlocks > 0 && fullBlocks >= openBlocks;
}

/** Language variants for extraction (tsx accepts typescript/ts/jsx/js/react) */
const EXTRACT_LANG_VARIANTS: Record<string, string> = {
  tsx: "tsx|typescript|ts|jsx|javascript|js|react",
  mermaid: "mermaid",
  python: "python",
};

/**
 * Extract the last code block from streaming content,
 * even if it's not yet complete (for TSX live preview).
 */
export function extractLatestCodeBlock(
  content: string,
  language: "tsx" | "mermaid" | "python"
): string | null {
  const langPattern = EXTRACT_LANG_VARIANTS[language] ?? language;
  const regex = new RegExp(
    "```(" + langPattern + ")\\s*\\n([\\s\\S]*?)(?:```|$)",
    "g"
  );
  let lastMatch: string | null = null;
  let match;
  while ((match = regex.exec(content)) !== null) {
    lastMatch = match[2].trim(); // group 2 is the code, group 1 is the lang tag
  }
  return lastMatch;
}

/**
 * Extract code from possibly truncated/incomplete response.
 * Handles: ```tsx\n... (no closing ```), or last ```block without proper close.
 */
export function extractFromIncompleteContent(
  content: string,
  language: "tsx" | "mermaid" | "python"
): string | null {
  const extracted = extractLatestCodeBlock(content, language);
  if (extracted) return extracted;
  const langPattern = EXTRACT_LANG_VARIANTS[language] ?? language;
  const openRegex = new RegExp("```(" + langPattern + ")\\s*\\n([\\s\\S]*)$");
  const m = content.match(openRegex);
  if (m) {
    const code = m[2].trim();
    return code.length > 0 ? code : null;
  }
  const genericOpen = /```(?:[a-zA-Z0-9+#-]*)\s*\n([\s\S]*)$/;
  const gm = content.match(genericOpen);
  if (gm) {
    const code = gm[1].trim();
    return code.length > 0 ? code : null;
  }
  return null;
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
