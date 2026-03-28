// src/components/preview/preview-panel.tsx
// 预览面板 — 右侧展示区域
// 当前为空状态占位，后续步骤会添加：项目理解卡片、讲稿预览、PPT 预览等
"use client";

import { FileText, Presentation, Layout } from "lucide-react";

/**
 * PreviewPanel — DemoGen 右侧预览面板
 *
 * 这是展示生成资产的区域。用户在左侧聊天后，
 * AI 生成的讲稿、PPT 大纲、一页式介绍等资产会在这里预览。
 *
 * 后续会添加 tab 切换，支持在不同资产类型之间切换。
 * 当前先显示空状态提示。
 */
export function PreviewPanel() {
  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
        <h2 className="text-sm font-semibold text-zinc-800">资产预览</h2>
      </div>

      {/* 空状态提示 — 引导用户开始使用 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-8">
          {/* 三个图标代表三种主要资产类型 */}
          <div className="flex justify-center gap-3 text-zinc-300">
            <FileText className="h-8 w-8" />
            <Presentation className="h-8 w-8" />
            <Layout className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-500">
              还没有生成资产
            </p>
            <p className="text-xs text-zinc-400 max-w-[240px]">
              在左侧聊天中描述你的项目或粘贴 GitHub
              链接，AI 将为你生成展示资产
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
