// 工具调用展示组件 — 显示 Agent 的工具调用状态（running/complete/error）
// 让用户能看到 Agent 正在做什么，类似 Claude Code 的工具调用展示
"use client";

import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// 通用工具调用展示 — 作为 MessagePrimitive.Content 的 ToolCall 组件
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

      {/* 工具结果 — 完成后显示 */}
      {isComplete && result && (
        <div className="px-3 py-2 text-xs">
          {formatResult(result)}
        </div>
      )}
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
