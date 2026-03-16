/** 页面模板：一键创建预设页面 */

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  code_language: "tsx" | "mermaid";
  code_block: string;
  extra_files?: Record<string, string>;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "blank-dashboard",
    name: "空白 Dashboard",
    description: "空白内容区，适合作为起点",
    code_language: "tsx",
    code_block: `import React from "react";

export default function DashboardContent() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "var(--foreground)" }}>
        欢迎
      </h1>
      <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
        在此开始设计你的页面内容。
      </p>
    </div>
  );
}
`,
  },
  {
    id: "chart-page",
    name: "图表页",
    description: "包含柱状图与折线图的统计页",
    code_language: "tsx",
    code_block: `import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const barData = [
  { name: "1月", value: 400 },
  { name: "2月", value: 300 },
  { name: "3月", value: 600 },
  { name: "4月", value: 800 },
  { name: "5月", value: 500 },
  { name: "6月", value: 700 },
];

const lineData = [
  { name: "周一", uv: 4000 },
  { name: "周二", uv: 3000 },
  { name: "周三", uv: 5000 },
  { name: "周四", uv: 2780 },
  { name: "周五", uv: 4890 },
  { name: "周六", uv: 6390 },
];

export default function DashboardContent() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", color: "var(--foreground)" }}>
        数据统计
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ height: 280, background: "var(--card)", borderRadius: 8, padding: 16, border: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "var(--muted-foreground)" }}>月度趋势</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 280, background: "var(--card)", borderRadius: 8, padding: 16, border: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "var(--muted-foreground)" }}>周趋势</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Line type="monotone" dataKey="uv" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    id: "table-page",
    name: "数据表格页",
    description: "带表头的简单数据表格",
    code_language: "tsx",
    code_block: `import React from "react";

const data = [
  { id: 1, name: "项目 A", status: "进行中", progress: 75 },
  { id: 2, name: "项目 B", status: "已完成", progress: 100 },
  { id: 3, name: "项目 C", status: "待开始", progress: 0 },
  { id: 4, name: "项目 D", status: "进行中", progress: 45 },
];

export default function DashboardContent() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", color: "var(--foreground)" }}>
        数据列表
      </h1>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--foreground)" }}>ID</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--foreground)" }}>名称</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--foreground)" }}>状态</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--foreground)" }}>进度</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", color: "var(--foreground)" }}>{row.id}</td>
                <td style={{ padding: "12px 16px", color: "var(--foreground)" }}>{row.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted-foreground)" }}>{row.status}</td>
                <td style={{ padding: "12px 16px", color: "var(--foreground)" }}>{row.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,
  },
  {
    id: "flowchart",
    name: "流程图",
    description: "Mermaid 流程图模板",
    code_language: "mermaid",
    code_block: `flowchart TD
    A[开始] --> B{判断}
    B -->|是| C[处理 A]
    B -->|否| D[处理 B]
    C --> E[结束]
    D --> E
`,
  },
];
