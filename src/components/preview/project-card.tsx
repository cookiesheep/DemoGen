// src/components/preview/project-card.tsx
// 项目理解卡片 — 展示 AI 对项目的结构化分析结果
"use client";

import type { ProjectUnderstanding, ProjectType } from "@/lib/ai/schemas";
import {
  Globe,
  Terminal,
  Server,
  BarChart3,
  Brain,
  Workflow,
  Package,
  FlaskConical,
  HelpCircle,
  Star,
  AlertTriangle,
  Zap,
  Users,
  Code,
} from "lucide-react";

/**
 * 项目类型 → 图标和标签的映射
 * 用于在卡片顶部显示项目类型标识
 */
const PROJECT_TYPE_CONFIG: Record<
  ProjectType,
  { icon: React.ElementType; label: string; color: string }
> = {
  "web-app": { icon: Globe, label: "Web 应用", color: "bg-blue-100 text-blue-700" },
  "api-service": { icon: Server, label: "API 服务", color: "bg-green-100 text-green-700" },
  "cli-tool": { icon: Terminal, label: "CLI 工具", color: "bg-amber-100 text-amber-700" },
  "data-viz": { icon: BarChart3, label: "数据可视化", color: "bg-purple-100 text-purple-700" },
  "ai-service": { icon: Brain, label: "AI 服务", color: "bg-pink-100 text-pink-700" },
  "agent-workflow": { icon: Workflow, label: "Agent 工具", color: "bg-indigo-100 text-indigo-700" },
  library: { icon: Package, label: "开源库", color: "bg-cyan-100 text-cyan-700" },
  algorithm: { icon: FlaskConical, label: "算法/研究", color: "bg-orange-100 text-orange-700" },
  other: { icon: HelpCircle, label: "其他", color: "bg-zinc-100 text-zinc-700" },
};

interface ProjectCardProps {
  data: ProjectUnderstanding;
}

/**
 * ProjectCard — 项目理解卡片
 *
 * 展示 AI 对项目的分析结果，包括：
 * - 项目类型标签
 * - 一句话总结
 * - 目标用户
 * - 核心功能列表
 * - 技术亮点
 * - 技术栈标签
 * - 风险提示
 */
export function ProjectCard({ data }: ProjectCardProps) {
  const typeConfig = PROJECT_TYPE_CONFIG[data.type] || PROJECT_TYPE_CONFIG.other;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      {/* 卡片头部 — 项目名称和类型 */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">{data.name}</h3>
          {/* 项目类型标签 */}
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${typeConfig.color}`}
          >
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </span>
        </div>
        {/* 一句话总结 */}
        <p className="text-sm text-zinc-600 mt-1">{data.summary}</p>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* 目标用户 */}
        <Section icon={Users} title="目标用户">
          <p className="text-sm text-zinc-600">{data.targetUsers}</p>
        </Section>

        {/* 核心功能 */}
        <Section icon={Zap} title="核心功能">
          <ul className="space-y-1">
            {data.coreFeatures.map((feature, i) => (
              <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                <span className="text-zinc-400 mt-0.5">•</span>
                {feature}
              </li>
            ))}
          </ul>
        </Section>

        {/* 技术亮点 */}
        <Section icon={Star} title="展示亮点">
          <ul className="space-y-1">
            {data.highlights.map((highlight, i) => (
              <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">★</span>
                {highlight}
              </li>
            ))}
          </ul>
        </Section>

        {/* 技术栈标签 */}
        <Section icon={Code} title="技术栈">
          <div className="flex flex-wrap gap-1.5">
            {data.techStack.map((tech, i) => (
              <span
                key={i}
                className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded"
              >
                {tech}
              </span>
            ))}
          </div>
        </Section>

        {/* 风险提示（如果有） */}
        {data.risks.length > 0 && (
          <Section icon={AlertTriangle} title="注意事项">
            <ul className="space-y-1">
              {data.risks.map((risk, i) => (
                <li key={i} className="text-sm text-zinc-500 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">⚠</span>
                  {risk}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

/**
 * 通用的分区组件 — 每个信息块共享的布局
 */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
