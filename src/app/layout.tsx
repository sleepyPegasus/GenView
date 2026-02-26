import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenView - AI-Powered Industrial Dashboard Generator",
  description:
    "Generate enterprise-grade admin dashboards, data panels, and architecture diagrams through natural language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
