// 工具调用展示组件 — 显示 Agent 的工具调用状态（running/complete/error）
// 让用户能看到 Agent 正在做什么，类似 Claude Code 的工具调用展示
// 特定工具（如 analyzeProject）完成时，会将结果推送到 PreviewContext
"use client";

import { useEffect } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { usePreview } from "../preview/preview-context";
import type { ProjectUnderstanding } from "@/lib/ai/schemas";

// 通用工具调用展示 — 作为 MessagePrimitive.Content 的 tools.Fallback 组件
export function ToolCallDisplay(props: ToolCallMessagePartProps) {
  const { toolName, args, result, status } = props;
  const isRunning = status.type === "running";
  const isComplete = status.type === "complete";
  const isError = status.type === "incomplete";

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* 工具调用头部 — 名称 + 状态 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        {/* 状态图标 */}
        {isRunning && (
          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        )}
        {isComplete && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        )}
        {isError && (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        )}

        {/* 工具名称 */}
        <span className="font-mono text-xs font-medium">
          {getToolDisplayName(toolName)}
        </span>

        {/* 状态文字 */}
        <span className="text-xs text-muted-foreground ml-auto">
          {isRunning && "执行中..."}
          {isComplete && "完成"}
          {isError && "失败"}
        </span>
      </div>

      {/* 工具参数 — 折叠显示 */}
      {args && Object.keys(args as Record<string, unknown>).length > 0 && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border/50">
          {formatArgs(args as Record<string, unknown>)}
        </div>
      )}

      {/* 工具结果 — 完成后显示摘要 */}
      {isComplete && result && (
        <ToolResultSummary toolName={toolName} result={result} />
      )}

      {/* 错误信息 */}
      {isError && (
        <div className="px-3 py-2 text-xs text-red-600">
          工具调用失败
        </div>
      )}
    </div>
  );
}

// 工具结果摘要 — 根据工具类型展示不同内容，同时触发预览面板更新
function ToolResultSummary({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  const preview = usePreview();

  // 当 analyzeProject 工具完成时，将结果推送到预览面板
  useEffect(() => {
    if (toolName === "analyzeProject" && result) {
      const res = result as { success?: boolean; data?: ProjectUnderstanding; error?: string };
      if (res.success && res.data) {
        preview.setProjectUnderstanding(res.data);
      }
    }
    // 只在 result 变化时触发，preview 的 setter 是 stable 的
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, result]);

  // analyzeProject 完成后的简要提示
  if (toolName === "analyzeProject") {
    const res = result as { success?: boolean; data?: ProjectUnderstanding; error?: string };
    if (res.error) {
      return (
        <div className="px-3 py-2 text-xs text-red-600">{res.error}</div>
      );
    }
    if (res.success && res.data) {
      return (
        <div className="px-3 py-2 text-xs text-green-700">
          已生成项目理解卡片 — 请在右侧查看
        </div>
      );
    }
  }

  // 默认：显示 JSON 格式的结果
  return (
    <div className="px-3 py-2 text-xs">
      {formatResult(result)}
    </div>
  );
}

// 工具名称映射 — 把英文工具名转为中文展示
function getToolDisplayName(toolName: string): string {
  const displayNames: Record<string, string> = {
    getCurrentTime: "获取当前时间",
    analyzeProject: "分析项目",
    planStrategy: "规划展示策略",
    generateScript: "生成讲稿",
    generatePPT: "生成 PPT 大纲",
    generateOnePager: "生成 One-pager",
    askUserChoice: "等待用户选择",
  };
  return displayNames[toolName] || toolName;
}

// 格式化工具参数为可读文本
function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(" | ");
}

// 格式化工具结果
function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}
