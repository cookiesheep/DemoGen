// Thread 组件 — 基于 assistant-ui 原语构建的对话线程
// 包含消息列表、工具调用展示、输入框
"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from "@assistant-ui/react";
import { SendHorizontal } from "lucide-react";
import { ToolCallDisplay } from "./tool-call-display";

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      {/* 消息列表 — 可滚动区域 */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4">
        {/* 空状态 — 没有消息时显示欢迎信息 */}
        <ThreadPrimitive.Empty>
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <div className="text-3xl mb-3">🤖</div>
            <h2 className="text-base font-medium mb-1">DemoGen Agent 已就绪</h2>
            <p className="text-sm max-w-xs">
              提交项目链接、文档或描述，我会自动分析并生成展示资产
            </p>
          </div>
        </ThreadPrimitive.Empty>

        {/* 消息列表渲染 */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* 底部输入框 */}
      <Composer />
    </ThreadPrimitive.Root>
  );
}

// 用户消息组件
function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

// Assistant 消息组件 — 包含文本和工具调用
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="mb-4">
      <div className="max-w-[90%]">
        <MessagePrimitive.Content
          components={{
            // 自定义工具调用的渲染方式 — 使用 tools.Fallback 作为所有工具的默认渲染组件
            tools: {
              Fallback: ToolCallDisplay,
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

// 输入框组件
function Composer() {
  return (
    <ComposerPrimitive.Root className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2">
        <ComposerPrimitive.Input
          placeholder="输入消息，或粘贴 GitHub 链接..."
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[120px] px-2 py-1.5"
          autoFocus
        />
        <ComposerPrimitive.Send
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 w-8 shrink-0 disabled:opacity-30 transition-opacity"
        >
          <SendHorizontal className="h-4 w-4" />
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}
