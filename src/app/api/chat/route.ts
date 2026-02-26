import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages } from "ai";

export const maxDuration = 60;

function buildSystemPrompt(opts: {
  appName: string;
  navLayout: string;
  theme: string;
  currentCode: string;
}) {
  let prompt = `你是一个资深的工业软件 UI/UX 架构师，名为 GenView AI。当前系统的全局配置如下：
- 主业务风格 (Theme): ${opts.theme}
- 系统名称 (App Name): ${opts.appName}
- 布局结构 (Nav Layout): ${opts.navLayout}

工作要求：
1. **架构图**: 若用户需要系统架构图、流程图、时序图等，必须输出包裹在 \`\`\`mermaid 中的 Mermaid 代码。
2. **UI界面**: 若用户需要产品界面、管理后台、数据看板等，必须输出包裹在 \`\`\`tsx 中的 React 代码。
   - 务必使用内联样式 (inline styles) 配合 CSS 变量进行样式编写。
   - 使用以下 CSS 变量而非硬编码颜色: var(--primary), var(--primary-foreground), var(--background), var(--foreground), var(--secondary), var(--muted), var(--muted-foreground), var(--accent), var(--card), var(--card-foreground), var(--border)。
   - 组件必须使用 \`export default function DashboardContent()\` 格式导出。
3. **禁止输出** \`<html>\`、全屏的侧边栏或顶部导航代码，因为系统外层框架已存在。你只需输出主业务内容区 (Content Area) 的代码。
4. 必须默认使用 \`lucide-react\` 作为图标库，\`recharts\` 作为图表库。
5. 【重要】在多轮对话修改时，绝不允许截断代码或使用 "// ... existing code ..." 之类的省略写法。必须每次输出完整的组件代码！
6. 请先用中文简要描述你的设计思路，然后输出代码。
7. 所有生成的 UI 应该看起来专业、高保真、像真实的生产级工业软件。尽可能使用丰富的数据、统计卡片、图表和表格来填充页面。`;

  if (opts.currentCode) {
    prompt += `\n\n当前画布上正在渲染的代码如下（用户可能希望基于此进行修改）：
\`\`\`tsx
${opts.currentCode}
\`\`\``;
  }

  return prompt;
}

export async function POST(req: Request) {
  const { messages, appName, navLayout, theme, currentCode } = await req.json();

  const systemPrompt = buildSystemPrompt({
    appName: appName || "GenView Dashboard",
    navLayout: navLayout || "side",
    theme: theme || "modern-b2b",
    currentCode: currentCode || "",
  });

  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
