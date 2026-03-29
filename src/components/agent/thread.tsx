// Thread 组件 — 基于 assistant-ui 原语构建的对话线程
// 包含消息列表、工具调用展示、输入区（多模态 + 简单文字输入）
"use client";

import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useThread,
} from "@assistant-ui/react";
import { SendHorizontal } from "lucide-react";
import { ToolCallDisplay } from "./tool-call-display";
import { ChoiceSelector } from "./choice-selector";
import { InputArea } from "./input-area";
import { MarkdownText } from "./markdown-text";

export function Thread() {
  // 读取 thread 状态，判断是否已有消息（用于决定显示哪个输入区）
  const threadState = useThread();
  const hasMessages = (threadState.messages?.length ?? 0) > 0;

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
              在下方提交项目链接、文档或描述，开始生成展示资产
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

      {/* 底部输入区：
          - 首次输入（无消息）：显示完整的多模态输入面板（链接+文件+描述）
          - 后续对话（有消息）：显示简洁的文字输入框 */}
      {hasMessages ? <SimpleComposer /> : <InputArea />}
    </ThreadPrimitive.Root>
  );
}

// 用户消息组件
function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
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
            // 使用 Markdown 渲染 Assistant 的文本内容
            Text: MarkdownText,
            tools: {
              // askUserChoice 工具用专门的选项按钮组件渲染
              by_name: {
                askUserChoice: ChoiceSelector,
              },
              // 其他工具用通用的工具调用展示组件
              Fallback: ToolCallDisplay,
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

// 简洁输入框 — 用于后续对话（修改意见、追问等）
function SimpleComposer() {
  return (
    <ComposerPrimitive.Root className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2">
        <ComposerPrimitive.Input
          placeholder="输入修改意见或继续对话..."
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[36px] max-h-[120px] px-2 py-1.5"
        />
        <ComposerPrimitive.Send className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 w-8 shrink-0 disabled:opacity-30 transition-opacity">
          <SendHorizontal className="h-4 w-4" />
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}
