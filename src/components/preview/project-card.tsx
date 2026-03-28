// 项目理解卡片 — 展示 Analysis Subagent 生成的结构化项目理解
// 显示项目类型、一句话总结、核心功能、技术亮点、技术栈、风险提醒
"use client";

import type { ProjectUnderstanding } from "@/lib/ai/schemas";
import {
  Code2,
  Users,
  Lightbulb,
  AlertTriangle,
  Layers,
  Star,
} from "lucide-react";

// 项目类型标签的显示名和颜色
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  "web-app": { label: "Web 应用", color: "bg-blue-100 text-blue-700" },
  "api-service": { label: "API 服务", color: "bg-green-100 text-green-700" },
  "cli-tool": { label: "CLI 工具", color: "bg-purple-100 text-purple-700" },
  "data-viz": { label: "数据可视化", color: "bg-orange-100 text-orange-700" },
  "ai-service": { label: "AI 服务", color: "bg-pink-100 text-pink-700" },
  "agent-workflow": { label: "Agent 工作流", color: "bg-indigo-100 text-indigo-700" },
  library: { label: "库/框架", color: "bg-cyan-100 text-cyan-700" },
  algorithm: { label: "算法", color: "bg-amber-100 text-amber-700" },
  "mobile-app": { label: "移动应用", color: "bg-rose-100 text-rose-700" },
  other: { label: "其他", color: "bg-gray-100 text-gray-700" },
};

interface ProjectCardProps {
  data: ProjectUnderstanding;
}

export function ProjectCard({ data }: ProjectCardProps) {
  const typeConfig = TYPE_CONFIG[data.type] || TYPE_CONFIG.other;

  return (
    <div className="space-y-5 p-6">
      {/* 头部：项目名称 + 类型标签 */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold">{data.name}</h2>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${typeConfig.color}`}
          >
            {typeConfig.label}
          </span>
        </div>
        <p className="text-muted-foreground">{data.summary}</p>
      </div>

      {/* 目标用户 */}
      <Section icon={Users} title="目标用户">
        <p className="text-sm">{data.targetUsers}</p>
      </Section>

      {/* 核心功能 */}
      <Section icon={Layers} title="核心功能">
        <ul className="space-y-1">
          {data.coreFeatures.map((feature, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-muted-foreground mt-0.5">•</span>
              {feature}
            </li>
          ))}
        </ul>
      </Section>

      {/* 技术亮点 */}
      <Section icon={Lightbulb} title="技术亮点">
        <ul className="space-y-1">
          {data.highlights.map((highlight, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <Star className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              {highlight}
            </li>
          ))}
        </ul>
      </Section>

      {/* 技术栈 */}
      <Section icon={Code2} title="技术栈">
        <div className="flex flex-wrap gap-1.5">
          {data.techStack.map((tech, i) => (
            <span
              key={i}
              className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
            >
              {tech}
            </span>
          ))}
        </div>
      </Section>

      {/* 风险提醒 */}
      {data.risks.length > 0 && (
        <Section icon={AlertTriangle} title="注意事项" variant="warning">
          <ul className="space-y-1">
            {data.risks.map((risk, i) => (
              <li key={i} className="text-sm text-amber-700">
                {risk}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// 通用 Section 组件 — 标题 + 图标 + 内容
function Section({
  icon: Icon,
  title,
  variant,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  variant?: "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        variant === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`h-4 w-4 ${
            variant === "warning" ? "text-amber-500" : "text-muted-foreground"
          }`}
        />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
