import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DemoGen - 项目展示资产编排器",
  description:
    "输入 GitHub 仓库，AI 帮你生成答辩讲稿、PPT、一页式介绍等展示资产",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
