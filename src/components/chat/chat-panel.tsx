// src/components/chat/chat-panel.tsx
// 聊天面板 — 使用 assistant-ui 的原语组件构建
// assistant-ui 提供了 ThreadPrimitive 等低层组件，我们用它们组装聊天界面
"use client";

import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { SendHorizontal } from "lucide-react";

/**
 * ChatPanel — DemoGen 左侧聊天面板
 *
 * 结构：
 * - 顶部：标题栏
 * - 中间：消息列表（ThreadPrimitive.Viewport 自动处理滚动）
 * - 底部：输入框 + 发送按钮（ComposerPrimitive 处理提交逻辑）
 *
 * 工作原理：
 * - 这个组件必须在 AssistantRuntimeProvider 内部使用
 * - ThreadPrimitive.Messages 会自动从 runtime context 读取消息列表
 * - ComposerPrimitive 会自动将用户输入发送到 /api/chat
 * - 流式回复会实时出现在 AssistantMessage 组件中
 */
export function ChatPanel() {
  return (
    <div className="flex flex-col h-full border-r border-zinc-200">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <h2 className="text-sm font-semibold text-zinc-800">DemoGen 助手</h2>
      </div>

      {/* 消息列表区域 */}
      {/* ThreadPrimitive.Viewport 是一个可滚动容器，新消息出现时自动滚动到底部 */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 欢迎消息 — 当没有对话时显示 */}
        <ThreadPrimitive.Empty>
          <WelcomeMessage />
        </ThreadPrimitive.Empty>

        {/* ThreadPrimitive.Messages 根据消息角色渲染不同组件 */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* 输入区域 */}
      {/* ComposerPrimitive.Root 管理输入状态，提交时自动调用 runtime.send() */}
      <div className="border-t border-zinc-200 bg-white p-4">
        <ComposerPrimitive.Root className="flex items-end gap-2">
          {/* 文本输入框 — 支持多行，按 Enter 发送 */}
          <ComposerPrimitive.Input
            placeholder="描述你的项目，或粘贴 GitHub 链接..."
            className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-zinc-400 min-h-[40px] max-h-[120px]"
          />
          {/* 发送按钮 — 输入为空时自动禁用 */}
          <ComposerPrimitive.Send
            className="flex items-center justify-center h-10 w-10 rounded-lg
                       bg-blue-600 text-white hover:bg-blue-700
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            <SendHorizontal className="h-4 w-4" />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}

/**
 * 欢迎消息 — 首次打开时显示
 * 告诉用户 DemoGen 能做什么
 */
function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <h3 className="text-lg font-semibold text-zinc-800 mb-2">
        欢迎使用 DemoGen
      </h3>
      <p className="text-sm text-zinc-500 max-w-[280px]">
        我是你的项目展示助手。告诉我你的项目，我来帮你生成答辩讲稿、PPT
        大纲和一页式介绍。
      </p>
      <div className="mt-6 space-y-2 text-xs text-zinc-400">
        <p>你可以：</p>
        <p>📎 粘贴 GitHub 仓库链接</p>
        <p>📝 直接描述你的项目</p>
        <p>🎯 告诉我展示的目标场景</p>
      </div>
    </div>
  );
}

/**
 * 用户消息气泡
 * MessagePrimitive.Content 自动渲染消息内容（纯文本）
 */
function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-blue-600 text-white px-3 py-2 text-sm leading-relaxed">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * AI 回复气泡
 * MessagePrimitive.Content 会自动处理流式文本渲染 —
 * 当 AI 还在生成时，文字会逐步出现（打字机效果）
 */
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[80%] rounded-lg bg-zinc-100 text-zinc-800 px-3 py-2 text-sm leading-relaxed">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}
