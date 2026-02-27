import { describe, it, expect } from "vitest";
import {
  parseResponse,
  hasCompleteCodeBlock,
  extractLatestCodeBlock,
  extractAllTsxBlocks,
} from "@/lib/code-parser";

describe("parseResponse", () => {
  it("extracts text and code blocks", () => {
    const content = `Here is the code:

\`\`\`tsx
export default function App() {
  return <div>Hello</div>;
}
\`\`\`

Hope you like it.`;
    const result = parseResponse(content);
    expect(result.text).toContain("Here is the code");
    expect(result.text).toContain("Hope you like it");
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.codeBlocks[0].language).toBe("tsx");
    expect(result.codeBlocks[0].code).toContain("export default function App");
  });

  it("extracts multiple code blocks", () => {
    const content = `\`\`\`tsx
const a = 1;
\`\`\`

\`\`\`mermaid
graph TD
  A --> B
\`\`\``;
    const result = parseResponse(content);
    expect(result.codeBlocks).toHaveLength(2);
    expect(result.codeBlocks[0].language).toBe("tsx");
    expect(result.codeBlocks[1].language).toBe("mermaid");
  });

  it("extracts code blocks with filename for multi-file", () => {
    const content = `\`\`\`tsx:utils.ts
export const add = (a: number, b: number) => a + b;
\`\`\`

\`\`\`tsx
export default function DashboardContent() { return <div>Hi</div>; }
\`\`\``;
    const result = parseResponse(content);
    expect(result.codeBlocks).toHaveLength(2);
    expect(result.codeBlocks[0].filename).toBe("utils.ts");
    expect(result.codeBlocks[0].code).toContain("add");
    expect(result.codeBlocks[1].filename).toBeUndefined();
    expect(result.codeBlocks[1].code).toContain("DashboardContent");
  });

  it("returns empty codeBlocks for plain text", () => {
    const result = parseResponse("Just some text");
    expect(result.codeBlocks).toHaveLength(0);
    expect(result.text).toBe("Just some text");
  });
});

describe("hasCompleteCodeBlock", () => {
  it("returns true when a full code block exists", () => {
    expect(hasCompleteCodeBlock("```tsx\nconst x = 1;\n```")).toBe(true);
    expect(hasCompleteCodeBlock("```mermaid\ngraph TD\n```")).toBe(true);
  });

  it("returns false when code block is incomplete", () => {
    expect(hasCompleteCodeBlock("```tsx\nconst x = 1;")).toBe(false);
    expect(hasCompleteCodeBlock("```mermaid")).toBe(false);
  });

  it("returns false for empty content", () => {
    expect(hasCompleteCodeBlock("")).toBe(false);
  });
});

describe("extractLatestCodeBlock", () => {
  it("extracts the last tsx block", () => {
    const content = `\`\`\`tsx
const a = 1;
\`\`\`

\`\`\`tsx
const b = 2;
\`\`\``;
    const result = extractLatestCodeBlock(content, "tsx");
    expect(result).toContain("const b = 2");
  });

  it("extracts incomplete streaming block", () => {
    const content = "```tsx\nexport default function";
    const result = extractLatestCodeBlock(content, "tsx");
    expect(result).toBe("export default function");
  });

  it("returns null when no block exists", () => {
    expect(extractLatestCodeBlock("no code here", "tsx")).toBeNull();
    expect(extractLatestCodeBlock("```mermaid\ngraph\n```", "tsx")).toBeNull();
  });
});

describe("extractAllTsxBlocks", () => {
  it("extracts single block as DashboardContent", () => {
    const content = "```tsx\nexport default function App() { return null; }\n```";
    const files = extractAllTsxBlocks(content);
    expect(files["/DashboardContent.tsx"]).toContain("export default function App");
    expect(Object.keys(files)).toHaveLength(1);
  });

  it("extracts multiple blocks with filenames", () => {
    const content = `\`\`\`tsx:utils.ts
export const x = 1;
\`\`\`
\`\`\`tsx
export default function DashboardContent() { return <div>Hi</div>; }
\`\`\``;
    const files = extractAllTsxBlocks(content);
    expect(files["/DashboardContent.tsx"]).toContain("DashboardContent");
    expect(files["/utils.ts"]).toContain("x = 1");
    expect(Object.keys(files)).toHaveLength(2);
  });
});
