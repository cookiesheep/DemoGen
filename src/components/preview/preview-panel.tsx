// src/components/preview/preview-panel.tsx
// 预览面板 — 右侧展示区域
// Step 2 更新：接收项目理解数据并展示项目卡片
"use client";

import { FileText, Presentation, Layout } from "lucide-react";
import type { ProjectUnderstanding, DisplayStrategy } from "@/lib/ai/schemas";
import { ProjectCard } from "./project-card";
import { StrategyCard } from "./strategy-card";

interface PreviewPanelProps {
  // 项目理解数据，由 AI 工具调用生成，从主页面传入
  projectUnderstanding: ProjectUnderstanding | null;
  // 展示策略数据，用户回答展示场景后由 AI 生成
  displayStrategy: DisplayStrategy | null;
}

/**
 * PreviewPanel — DemoGen 右侧预览面板
 *
 * 根据当前状态展示不同内容：
 * - 无数据时：显示空状态引导
 * - 有项目理解数据时：显示项目理解卡片
 * - 后续会添加：讲稿预览、PPT 预览、One-pager 预览
 */
export function PreviewPanel({ projectUnderstanding, displayStrategy }: PreviewPanelProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
        <h2 className="text-sm font-semibold text-zinc-800">资产预览</h2>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {projectUnderstanding ? (
          // 有数据时显示项目理解卡片
          <div className="space-y-4">
            <ProjectCard data={projectUnderstanding} />
            {displayStrategy && <StrategyCard data={displayStrategy} />}
          </div>
        ) : (
          // 无数据时显示空状态提示
          <EmptyState />
        )}
      </div>
    </div>
  );
}

/**
 * 空状态组件 — 引导用户开始使用
 */
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center space-y-4 px-8">
        <div className="flex justify-center gap-3 text-zinc-300">
          <FileText className="h-8 w-8" />
          <Presentation className="h-8 w-8" />
          <Layout className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500">还没有生成资产</p>
          <p className="text-xs text-zinc-400 max-w-[240px]">
            在左侧聊天中描述你的项目或粘贴 GitHub 链接，AI 将为你生成展示资产
          </p>
        </div>
      </div>
    </div>
  );
}
