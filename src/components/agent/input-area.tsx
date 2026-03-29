// 输入区组件 — 支持多种输入方式：拖拽/点击上传文件、粘贴链接、文字描述
// 用户可以一次性提交多种输入，Agent 综合所有材料理解项目
"use client";

import { useState, useRef, useCallback } from "react";
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const composerRuntime = useComposerRuntime();
  const threadState = useThread();

  // 上传并解析单个文件
  const uploadFile = useCallback(async (file: File) => {
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
    return {
      name: data.filename,
      size: data.size,
      content: data.content,
    } as UploadedFile;
  }, []);

  // 处理文件列表（来自 input 或 drag-drop）
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      if (fileArray.length === 0) return;

      setError(null);
      setUploading(true);

      try {
        const results = await Promise.all(fileArray.map(uploadFile));
        setFiles((prev) => [...prev, ...results]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [uploadFile]
  );

  // input[type=file] 的 onChange
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // 重置 file input，允许再次选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- 拖拽事件处理 ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只在离开最外层容器时才取消高亮
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  // 移除已上传的文件
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 提交所有输入
  const handleSubmit = () => {
    if (!githubUrl.trim() && !description.trim() && files.length === 0) {
      setError("请至少提供一种输入：GitHub 链接、文件或项目描述");
      return;
    }

    setError(null);

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

    composerRuntime.setText(message);
    composerRuntime.send();

    setGithubUrl("");
    setDescription("");
    setFiles([]);
  };

  const isRunning = threadState.isRunning;
  const hasInput = githubUrl.trim() || description.trim() || files.length > 0;

  return (
    <div className="border-t border-border bg-background">
      <div
        className={`p-3 space-y-3 transition-colors ${
          isDragging ? "bg-primary/5 ring-2 ring-inset ring-primary/30 rounded-lg" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 1. 文件上传区 — 最上方，支持点击和拖拽 */}
        <div
          onClick={() => !isRunning && !uploading && fileInputRef.current?.click()}
          className={`
            flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3
            text-sm transition-colors cursor-pointer
            ${
              isDragging
                ? "border-primary bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }
            ${(uploading || isRunning) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>
            {isDragging
              ? "松开以上传文件"
              : uploading
                ? "上传中..."
                : "上传你的 README 文档或其他文档（可选）"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

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
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  disabled={isRunning}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 2. GitHub 链接输入 */}
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
          <Link className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="粘贴 GitHub 链接（可选）"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isRunning}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && githubUrl.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* 3. 项目描述文本框 */}
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (error) setError(null);
          }}
          placeholder="描述你的项目（可选）—— 做了什么、用了什么技术、给谁用..."
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground resize-none min-h-[60px] max-h-[120px] focus:border-primary/50"
          disabled={isRunning}
          rows={3}
        />

        {/* 错误提示 */}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* 底部：提交按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isRunning || uploading || !hasInput}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-30 transition-opacity hover:opacity-90"
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
