// src/app/page.tsx
// DemoGen 主页面 — 左右分栏布局，连接 AI runtime 和预览状态
"use client";

import { useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import type { ProjectUnderstanding, DisplayStrategy } from "@/lib/ai/schemas";

/**
 * DemoGen 主页面
 *
 * 数据流说明：
 * 1. 用户在左侧聊天面板发送 GitHub 链接
 * 2. AI 调用 analyzeRepo 工具获取仓库数据（服务端执行）
 * 3. AI 调用 generateProjectUnderstanding 工具输出结构化分析（前端工具）
 * 4. 前端通过 onToolCall 回调捕获分析结果
 * 5. 更新 state → 右侧预览面板显示项目理解卡片
 *
 * 关键概念：
 * - "服务端工具"（有 execute 函数）：在服务器上执行，如 analyzeRepo
 * - "前端工具"（无 execute 函数）：AI 生成参数，前端接收并处理
 *   generateProjectUnderstanding 就是前端工具，参数就是结构化的项目理解数据
 */
export default function Home() {
  // 项目理解数据状态 — 由 AI 工具调用填充，传给右侧预览面板
  const [projectUnderstanding, setProjectUnderstanding] =
    useState<ProjectUnderstanding | null>(null);
  // 展示策略数据 — 用户回答展示场景后，由 AI 工具调用填充
  const [displayStrategy, setDisplayStrategy] =
    useState<DisplayStrategy | null>(null);

  // 创建 AI 聊天运行时
  const runtime = useChatRuntime({
    // onToolCall 回调 — 处理 AI 发出的前端工具调用
    // 当 AI 调用 generateProjectUnderstanding 时，这个回调会被触发
    // 参数 toolCall 包含工具名称和 AI 生成的结构化数据
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "generateProjectUnderstanding") {
        // toolCall.input 就是符合 projectUnderstandingSchema 的结构化数据
        const understanding = toolCall.input as ProjectUnderstanding;
        setProjectUnderstanding(understanding);
      } else if (toolCall.toolName === "generateDisplayStrategy") {
        // toolCall.input 就是符合 displayStrategySchema 的展示策略数据
        const strategy = toolCall.input as DisplayStrategy;
        setDisplayStrategy(strategy);
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen">
        {/* 左侧聊天面板 */}
        <div className="w-2/5 min-w-[320px] max-w-[480px]">
          <ChatPanel />
        </div>
        {/* 右侧预览面板 — 传入项目理解数据 */}
        <div className="flex-1">
          <PreviewPanel
            projectUnderstanding={projectUnderstanding}
            displayStrategy={displayStrategy}
          />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
