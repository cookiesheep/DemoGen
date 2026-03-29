// Markdown 文本渲染组件 — 用于 Assistant 消息中的富文本显示
// 长文本自动折叠，避免 Agent 输出过多内容时淹没界面
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TextMessagePartProps } from "@assistant-ui/react";
import { ChevronDown } from "lucide-react";

// 超过此长度的文本自动折叠
const COLLAPSE_THRESHOLD = 200;
// 折叠时显示的字符数
const PREVIEW_LENGTH = 120;

export function MarkdownText({ text }: TextMessagePartProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COLLAPSE_THRESHOLD;

  // 短文本直接渲染
  if (!isLong) {
    return (
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  // 长文本：折叠状态显示截断预览 + 展开按钮
  if (!expanded) {
    return (
      <div>
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text.slice(0, PREVIEW_LENGTH) + "..."}
          </ReactMarkdown>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          展开全部（{text.length} 字）
        </button>
      </div>
    );
  }

  // 展开状态：显示全文
  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
