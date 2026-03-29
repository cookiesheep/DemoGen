// 讲稿预览组件 — 支持预览/编辑双模式
// 预览模式：Markdown 渲染
// 编辑模式：textarea 直接编辑 Markdown 源码
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, Pencil, Download } from "lucide-react";
import { usePreview } from "./preview-context";

interface ScriptPreviewProps {
  content: string;
}

export function ScriptPreview({ content }: ScriptPreviewProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preview = usePreview();

  // 当外部内容变化时（如 Agent 重新生成），同步编辑区内容
  useEffect(() => {
    setEditContent(content);
  }, [content]);

  // 切换到编辑模式时自动聚焦
  useEffect(() => {
    if (mode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // 编辑内容变化时实时保存到 Context（不切换 activeAsset）
  const handleChange = useCallback(
    (value: string) => {
      setEditContent(value);
      preview.setScriptContent(value);
    },
    [preview]
  );

  // 导出为 Markdown 文件
  const handleExport = useCallback(() => {
    const blob = new Blob([editContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "讲稿.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [editContent]);

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        {/* 模式切换 */}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
              ${mode === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            <Eye className="h-3 w-3" />
            预览
          </button>
          <button
            onClick={() => setMode("edit")}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
              ${mode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            <Pencil className="h-3 w-3" />
            编辑
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3 w-3" />
            导出
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {mode === "preview" ? (
          <div className="p-6">
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full h-full p-6 bg-background text-sm font-mono leading-relaxed outline-none resize-none"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
