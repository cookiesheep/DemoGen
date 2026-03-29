// 讲稿预览组件 — 渲染 Markdown 格式的演讲稿
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ScriptPreviewProps {
  content: string;
}

export function ScriptPreview({ content }: ScriptPreviewProps) {
  return (
    <div className="p-6">
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
