// Agent 面板 — 左侧主面板，包含 Agent 消息流 + 工具调用状态 + 输入框
// 使用 assistant-ui 连接后端 Agent API，实现流式对话和工具调用可见性
"use client";

import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "./thread";

export function AgentPanel() {
  // 连接后端 /api/agent 接口
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/agent" }),
    // 当前端工具（如 askUserChoice）的结果被添加后，自动重新发送消息继续 Agent 流程
    // 这样用户选择场景后，Agent 能自动推进到下一步
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-full">
        {/* 顶部标题栏 */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h1 className="text-sm font-semibold">DemoGen Agent</h1>
        </div>

        {/* 对话线程区域 */}
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
