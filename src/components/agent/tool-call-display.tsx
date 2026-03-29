// 工具调用展示组件 — 每个工具调用显示为人类可读的行为卡片
// 运行中：显示正在做什么（中文描述 + 动画）
// 完成后：显示关键发现摘要 + 推送数据到右侧预览面板
"use client";

import { useEffect } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Target,
  FileText,
  LayoutGrid,
  FileSpreadsheet,
  Clock,
  Package,
  PenLine,
} from "lucide-react";
import { usePreview } from "../preview/preview-context";
import type { ProjectUnderstanding, DisplayStrategy, PptOutline, OnePager } from "@/lib/ai/schemas";

// 工具结果的通用类型
interface ToolResult {
  success?: boolean;
  data?: unknown;
  error?: string;
  summary?: Record<string, unknown>;
}

// 通用工具调用展示 — 作为 MessagePrimitive.Content 的 tools.Fallback 组件
export function ToolCallDisplay(props: ToolCallMessagePartProps) {
  const { toolName, status } = props;
  const args = (props.args ?? {}) as Record<string, unknown>;
  const result = props.result as ToolResult | undefined;
  const isRunning = status.type === "running";
  const isComplete = status.type === "complete";
  const isError = status.type === "incomplete";
  const toolConfig = TOOL_CONFIGS[toolName];

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/30 text-sm overflow-hidden">
      {/* 头部：图标 + 工具名 + 状态 */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isRunning && (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
        )}
        {isComplete && (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        )}
        {isError && (
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}

        <span className="font-medium text-xs">
          {toolConfig?.label || toolName}
        </span>

        <span className="text-xs text-muted-foreground ml-auto">
          {isRunning && "执行中..."}
          {isComplete && "完成"}
          {isError && "失败"}
        </span>
      </div>

      {/* 运行中：显示人类可读的行为描述 */}
      {isRunning && (
        <RunningDescription toolName={toolName} args={args} />
      )}

      {/* 完成后：显示摘要 + 推送到预览面板 */}
      {isComplete && result && (
        <CompleteSummary toolName={toolName} result={result} />
      )}

      {/* 错误 */}
      {isError && (
        <div className="px-3 py-2 text-xs text-red-600 border-t border-border/50">
          工具调用失败，请重试
        </div>
      )}
    </div>
  );
}

// ========== 运行中的行为描述 ==========
// 根据工具名和参数，生成人类可读的"正在做什么"
function RunningDescription({
  toolName,
  args,
}: {
  toolName: string;
  args: Record<string, unknown>;
}) {
  const lines = getRunningLines(toolName, args);
  if (lines.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-border/50 space-y-1">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* 树状连接线 */}
          <span className="text-border shrink-0">
            {i === lines.length - 1 ? "└─" : "├─"}
          </span>
          <span>{line.icon}</span>
          <span>{line.text}</span>
        </div>
      ))}
    </div>
  );
}

// 根据工具名和参数，返回运行时的描述行
function getRunningLines(
  toolName: string,
  args: Record<string, unknown>
): { icon: string; text: string }[] {
  switch (toolName) {
    case "analyzeProject": {
      const lines: { icon: string; text: string }[] = [];
      if (args.githubUrl) {
        // 从 URL 中提取 owner/repo
        const match = String(args.githubUrl).match(/github\.com\/([^/]+\/[^/]+)/);
        const repoName = match ? match[1] : "仓库";
        lines.push({ icon: "📡", text: `读取 GitHub 仓库 ${repoName}` });
      }
      if (args.documents && Array.isArray(args.documents) && args.documents.length > 0) {
        lines.push({ icon: "📄", text: `分析 ${args.documents.length} 份上传文档` });
      }
      if (args.description) {
        lines.push({ icon: "💬", text: "解析用户项目描述" });
      }
      lines.push({ icon: "🤖", text: "AI 生成结构化项目理解" });
      return lines;
    }

    case "planStrategy": {
      const scenario = args.scenario || args.scenarioLabel || "展示";
      return [
        { icon: "🎯", text: `场景：${scenario}` },
        { icon: "👥", text: "分析目标观众" },
        { icon: "📋", text: "规划展示结构与时间分配" },
      ];
    }

    case "generateScript": {
      const label = args.scenarioLabel || "展示";
      const duration = args.totalDuration || "";
      return [
        { icon: "🎤", text: `撰写${label}讲稿${duration ? `（${duration}）` : ""}` },
        { icon: "✍️", text: "按展示结构逐段生成" },
      ];
    }

    case "generatePPT": {
      return [
        { icon: "📊", text: "设计 PPT 页面结构" },
        { icon: "📝", text: "为每页撰写要点和演讲备注" },
      ];
    }

    case "generateOnePager": {
      const name = args.projectName || "项目";
      return [
        { icon: "📄", text: `为 ${name} 生成一页纸` },
        { icon: "✨", text: "提炼核心价值和功能亮点" },
      ];
    }

    case "reviseAsset": {
      const typeLabels: Record<string, string> = {
        script: "讲稿",
        ppt: "PPT 大纲",
        onepager: "一页纸",
      };
      const assetLabel = typeLabels[String(args.assetType)] || "资产";
      return [
        { icon: "✏️", text: `修改${assetLabel}` },
        { icon: "🤖", text: `按指令重新生成：${String(args.instructions || "").slice(0, 40)}${String(args.instructions || "").length > 40 ? "..." : ""}` },
      ];
    }

    default:
      return [];
  }
}

// ========== 完成后的摘要 ==========
// 显示工具完成后的关键信息，同时推送数据到 PreviewContext
function CompleteSummary({
  toolName,
  result,
}: {
  toolName: string;
  result: ToolResult;
}) {
  const preview = usePreview();

  // 推送结果到右侧预览面板
  useEffect(() => {
    if (!result?.success || !result.data) return;

    switch (toolName) {
      case "analyzeProject":
        preview.setProjectUnderstanding(result.data as ProjectUnderstanding);
        break;
      case "planStrategy":
        preview.setDisplayStrategy(result.data as DisplayStrategy);
        break;
      case "generateScript":
        preview.setScriptContent(result.data as string);
        break;
      case "generatePPT":
        preview.setPptOutline(result.data as PptOutline);
        break;
      case "generateOnePager":
        preview.setOnePager(result.data as OnePager);
        break;
      case "reviseAsset": {
        // reviseAsset 返回 { assetType, data }，根据 assetType 推送到对应位置
        const revised = result as ToolResult & { assetType?: string };
        if (revised.assetType === "script") {
          preview.setScriptContent(revised.data as string);
        } else if (revised.assetType === "ppt") {
          preview.setPptOutline(revised.data as PptOutline);
        } else if (revised.assetType === "onepager") {
          preview.setOnePager(revised.data as OnePager);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, result]);

  // 错误显示
  if (result.error) {
    return (
      <div className="px-3 py-2 text-xs text-red-600 border-t border-border/50">
        {result.error}
      </div>
    );
  }

  // 从 summary 生成人类可读的完成摘要
  const summaryLines = getCompleteSummaryLines(toolName, result.summary);

  return (
    <div className="px-3 py-2 border-t border-border/50 space-y-1">
      {summaryLines.map((line, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="shrink-0">{line.icon}</span>
          <span className={line.highlight ? "text-foreground font-medium" : "text-muted-foreground"}>
            {line.text}
          </span>
        </div>
      ))}
      {/* 引导查看右侧面板 */}
      <div className="flex items-center gap-2 text-xs text-green-700 mt-1">
        <span>→</span>
        <span>{TOOL_CONFIGS[toolName]?.completeTip || "已完成，请在右侧查看"}</span>
      </div>
    </div>
  );
}

// 根据工具名和 summary 数据，生成完成后的摘要行
function getCompleteSummaryLines(
  toolName: string,
  summary?: Record<string, unknown>
): { icon: string; text: string; highlight?: boolean }[] {
  if (!summary) return [];

  switch (toolName) {
    case "analyzeProject": {
      const s = summary as {
        projectName?: string;
        projectType?: string;
        featureCount?: number;
        highlightCount?: number;
        techStackCount?: number;
      };
      const typeLabels: Record<string, string> = {
        "web-app": "Web 应用",
        "api-service": "API 服务",
        "cli-tool": "CLI 工具",
        "data-viz": "数据可视化",
        "ai-service": "AI 服务",
        "agent-workflow": "Agent 工作流",
        library: "库/框架",
        algorithm: "算法",
        "mobile-app": "移动应用",
        other: "其他",
      };
      return [
        { icon: "💡", text: `项目：${s.projectName || "未知"}`, highlight: true },
        { icon: "📦", text: `类型：${typeLabels[s.projectType || ""] || s.projectType || "未知"}` },
        { icon: "⚙️", text: `核心功能 ${s.featureCount || 0} 个 · 技术亮点 ${s.highlightCount || 0} 个 · 技术栈 ${s.techStackCount || 0} 项` },
      ];
    }

    case "planStrategy": {
      const s = summary as {
        scenarioLabel?: string;
        assetCount?: number;
        assetLabels?: string[];
        totalDuration?: string;
      };
      return [
        { icon: "🎯", text: `场景：${s.scenarioLabel || "未知"}`, highlight: true },
        { icon: "📦", text: `推荐资产：${s.assetLabels?.join("、") || `${s.assetCount || 0} 份`}` },
        { icon: "⏱️", text: `建议时长：${s.totalDuration || "未知"}` },
      ];
    }

    case "generateScript": {
      const s = summary as { charCount?: number; estimatedMinutes?: number };
      return [
        { icon: "📝", text: `共 ${s.charCount || 0} 字`, highlight: true },
        { icon: "⏱️", text: `预计演讲 ${s.estimatedMinutes || 0} 分钟` },
      ];
    }

    case "generatePPT": {
      const s = summary as { slideCount?: number; title?: string };
      return [
        { icon: "📊", text: `${s.title || "PPT"}`, highlight: true },
        { icon: "📄", text: `共 ${s.slideCount || 0} 页` },
      ];
    }

    case "generateOnePager": {
      const s = summary as { projectName?: string; tagline?: string };
      return [
        { icon: "📄", text: `${s.projectName || "项目"}`, highlight: true },
        { icon: "✨", text: `标语：${s.tagline || ""}` },
      ];
    }

    case "reviseAsset": {
      const s = summary as { assetType?: string; charCount?: number; slideCount?: number; projectName?: string };
      const typeLabels: Record<string, string> = { script: "讲稿", ppt: "PPT 大纲", onepager: "一页纸" };
      const label = typeLabels[s.assetType || ""] || "资产";
      const detail = s.charCount ? `${s.charCount} 字` : s.slideCount ? `${s.slideCount} 页` : "";
      return [
        { icon: "✏️", text: `${label}已修改`, highlight: true },
        ...(detail ? [{ icon: "📏", text: detail }] : []),
      ];
    }

    default:
      return [];
  }
}

// ========== 工具配置表 ==========
// 每个工具的中文名、图标组件、完成提示语
const TOOL_CONFIGS: Record<
  string,
  {
    label: string;
    icon: typeof Search;
    completeTip: string;
  }
> = {
  getCurrentTime: {
    label: "获取当前时间",
    icon: Clock,
    completeTip: "时间获取完成",
  },
  analyzeProject: {
    label: "分析项目",
    icon: Search,
    completeTip: "项目理解卡片已生成，请查看右侧",
  },
  planStrategy: {
    label: "规划展示策略",
    icon: Target,
    completeTip: "展示策略已生成，请查看右侧",
  },
  generateScript: {
    label: "生成讲稿",
    icon: FileText,
    completeTip: "讲稿已生成，请查看右侧",
  },
  generatePPT: {
    label: "生成 PPT 大纲",
    icon: LayoutGrid,
    completeTip: "PPT 大纲已生成，请查看右侧",
  },
  generateOnePager: {
    label: "生成一页纸",
    icon: FileSpreadsheet,
    completeTip: "一页纸已生成，请查看右侧",
  },
  askUserChoice: {
    label: "等待用户选择",
    icon: Target,
    completeTip: "用户已选择",
  },
  confirmAssets: {
    label: "确认资产",
    icon: Package,
    completeTip: "用户已确认资产选择",
  },
  reviseAsset: {
    label: "修改资产",
    icon: PenLine,
    completeTip: "资产已修改，请查看右侧",
  },
};
