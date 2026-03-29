// 输入区组件 — 支持多种输入方式：粘贴链接、上传文件、文字描述
// 用户可以一次性提交多种输入，Agent 综合所有材料理解项目
"use client";

import { useState, useRef } from "react";
import { useComposerRuntime, useThread } from "@assistant-ui/react";
import {
  Link,
  Upload,
  X,
  FileText,
  SendHorizontal,
  Loader2,
} from "lucide-react";

// 已上传文件的信息
interface UploadedFile {
  name: string;
  size: number;
  content: string; // 解析后的文本内容
}

export function InputArea() {
  const [githubUrl, setGithubUrl] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // useComposerRuntime 获取 composer 的操作方法（setText, send 等）
  const composerRuntime = useComposerRuntime();
  // useThread 获取 thread 状态（isRunning 等）
  const threadState = useThread();

  // 处理文件上传 — 调用 /api/upload 解析文件内容
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "上传失败");
        }

        const data = await res.json();
        setFiles((prev) => [
          ...prev,
          {
            name: data.filename,
            size: data.size,
            content: data.content,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      // 重置 file input，允许再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 移除已上传的文件
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 提交所有输入 — 将信息组合成一条消息发给 Agent
  const handleSubmit = () => {
    // 至少需要一种输入
    if (!githubUrl.trim() && !description.trim() && files.length === 0) {
      setError("请至少提供一种输入：GitHub 链接、文件或项目描述");
      return;
    }

    setError(null);

    // 构建发送给 Agent 的消息内容
    // Agent 的 system prompt 会引导它识别 GitHub 链接并调用对应工具
    const parts: string[] = [];

    if (githubUrl.trim()) {
      parts.push(`GitHub 仓库链接：${githubUrl.trim()}`);
    }

    if (files.length > 0) {
      parts.push(
        `上传的文档：\n${files
          .map((f) => `--- ${f.name} ---\n${f.content}`)
          .join("\n\n")}`
      );
    }

    if (description.trim()) {
      parts.push(`项目描述：${description.trim()}`);
    }

    const message = parts.join("\n\n");

    // 通过 assistant-ui 的 composer runtime 发送消息
    composerRuntime.setText(message);
    composerRuntime.send();

    // 清空输入状态
    setGithubUrl("");
    setDescription("");
    setFiles([]);
  };

  // 判断 thread 是否正在运行（Agent 正在回复中）
  const isRunning = threadState.isRunning;

  // 判断是否有有效输入
  const hasInput = githubUrl.trim() || description.trim() || files.length > 0;

  return (
    <div className="border-t border-border bg-background">
      <div className="p-3 space-y-3">
        {/* GitHub 链接输入 */}
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              setError(null);
            }}
            placeholder="粘贴 GitHub 链接（可选）"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isRunning}
            onKeyDown={(e) => {
              // 回车直接提交（如果只有链接没有其他内容的话）
              if (e.key === "Enter" && !e.shiftKey && githubUrl.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* 分割线 */}
        <div className="border-t border-border/50" />

        {/* 项目描述文本框 */}
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(null);
          }}
          placeholder="描述你的项目（可选）—— 做了什么、用了什么技术、给谁用..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none min-h-[60px] max-h-[120px]"
          disabled={isRunning}
          rows={3}
        />

        {/* 已上传文件列表 */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2.5 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatFileSize(file.size)}
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  disabled={isRunning}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {/* 底部操作栏：上传按钮 + 提交按钮 */}
        <div className="flex items-center justify-between">
          {/* 上传文件按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isRunning}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              上传文档
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* 开始分析按钮 */}
          <button
            onClick={handleSubmit}
            disabled={isRunning || uploading || !hasInput}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium disabled:opacity-30 transition-opacity hover:opacity-90"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <SendHorizontal className="h-3.5 w-3.5" />
                开始分析
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 格式化文件大小为可读字符串
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
