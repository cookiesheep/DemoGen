// Markdown 文本渲染组件 — 用于 Assistant 消息中的富文本显示
// 使用 react-markdown + remark-gfm 支持 GFM 语法（表格、删除线、任务列表等）
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TextMessagePartProps } from "@assistant-ui/react";

export function MarkdownText({ text }: TextMessagePartProps) {
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
