// src/app/page.tsx
// DemoGen 主页面 — 左右分栏布局，连接 AI runtime
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";

/**
 * DemoGen 主页面
 *
 * 架构说明：
 * 1. useChatRuntime() — 创建一个连接到 /api/chat 的 AI 运行时
 *    它内部使用 Vercel AI SDK 的 useChat hook，处理消息发送和流式接收
 *    默认会向 /api/chat 发送 POST 请求（DefaultChatTransport 的默认值）
 *
 * 2. AssistantRuntimeProvider — 将运行时注入 React context
 *    所有子组件（如 ThreadPrimitive、ComposerPrimitive）
 *    都通过 context 自动获取消息状态和发送方法
 *
 * 3. 页面分为左右两栏：
 *    - 左侧 (40%): 聊天面板，AI 引导用户描述项目
 *    - 右侧 (60%): 预览面板，展示生成的资产
 */
export default function Home() {
  // 创建 AI 聊天运行时
  // 不传参数时，默认使用 DefaultChatTransport 连接到 /api/chat
  // 即对应 src/app/api/chat/route.ts
  const runtime = useChatRuntime();

  return (
    // AssistantRuntimeProvider 让所有子组件都能访问 AI 运行时
    <AssistantRuntimeProvider runtime={runtime}>
      {/* 左右分栏容器 — 占满整个视口高度 */}
      <div className="flex h-screen">
        {/* 左侧聊天面板 — 固定宽度区间 */}
        <div className="w-2/5 min-w-[320px] max-w-[480px]">
          <ChatPanel />
        </div>
        {/* 右侧预览面板 — 占满剩余空间 */}
        <div className="flex-1">
          <PreviewPanel />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
