# Step 1: 最小可对话版本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working chat interface where users can talk to an AI assistant in a left-panel chat, with a placeholder right panel for future preview content.

**Architecture:** Next.js App Router with a single page that renders a split layout. Left panel uses assistant-ui's `useChatRuntime` + `AssistantRuntimeProvider` + `ThreadPrimitive` for a streaming chat connected to a `/api/chat` route. Right panel is a static placeholder. The `/api/chat` route uses Vercel AI SDK's `streamText` with the OpenAI-compatible provider (pointed at DeepSeek).

**Tech Stack:** Next.js 16, Vercel AI SDK 6 (`ai`, `@ai-sdk/openai`), assistant-ui (`@assistant-ui/react`, `@assistant-ui/react-ai-sdk`), Tailwind CSS 4, TypeScript

---

### Task 1: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create the chat API route**

```typescript
// src/app/api/chat/route.ts
// AI 对话接口 — 接收前端消息，通过 DeepSeek API 流式返回回复
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(request: Request) {
  // 从请求体中解析消息列表（assistant-ui 自动发送的格式）
  const { messages } = await request.json();

  // 使用 Vercel AI SDK 的 streamText 进行流式生成
  // @ai-sdk/openai 会自动读取 OPENAI_API_KEY 和 OPENAI_BASE_URL 环境变量
  const result = streamText({
    model: openai(process.env.OPENAI_MODEL || "deepseek-chat"),
    // DemoGen 的系统提示 — 告诉 AI 它是一个项目展示助手
    system: `你是 DemoGen 的 AI 助手，专门帮助用户将软件项目转化为高质量的展示资产。

你的职责：
1. 理解用户的项目（通过 GitHub 链接、README、截图或描述）
2. 分析项目类型和亮点
3. 推荐最适合的展示策略
4. 生成讲稿、PPT 大纲、一页式介绍等展示资产

当前阶段你还在开发中，暂时只能进行对话。请用友好专业的语气与用户交流。
回复请使用中文，保留英文技术术语。`,
    messages,
  });

  // 返回流式响应（assistant-ui 会自动处理）
  return result.toDataStreamResponse();
}
```

- [ ] **Step 2: Verify route compiles**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds without errors in the chat route

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: add /api/chat route with DeepSeek streaming"
```

---

### Task 2: Chat Panel Component

**Files:**
- Create: `src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Create the chat panel component**

```typescript
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
 * - 中间：消息列表（自动滚动）
 * - 底部：输入框 + 发送按钮
 */
export function ChatPanel() {
  return (
    <div className="flex flex-col h-full border-r border-zinc-200">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
        <h2 className="text-sm font-semibold text-zinc-800">DemoGen 助手</h2>
      </div>

      {/* 消息列表区域 — ThreadPrimitive.Viewport 处理自动滚动 */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ThreadPrimitive.Messages 渲染所有消息 */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,    // 用户消息组件
            AssistantMessage, // AI 回复组件
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* 输入区域 — ComposerPrimitive 处理输入状态和提交 */}
      <div className="border-t border-zinc-200 bg-white p-4">
        <ComposerPrimitive.Root className="flex items-end gap-2">
          {/* 文本输入框 */}
          <ComposerPrimitive.Input
            placeholder="描述你的项目，或粘贴 GitHub 链接..."
            className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-zinc-400 min-h-[40px] max-h-[120px]"
          />
          {/* 发送按钮 */}
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
 * 用户消息气泡
 */
function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-blue-600 text-white px-3 py-2 text-sm">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * AI 回复气泡
 * MessagePrimitive.Content 会自动处理流式文本渲染
 */
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start">
      <div className="max-w-[80%] rounded-lg bg-zinc-100 text-zinc-800 px-3 py-2 text-sm">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/chat-panel.tsx
git commit -m "feat: add ChatPanel component with assistant-ui primitives"
```

---

### Task 3: Preview Panel Placeholder

**Files:**
- Create: `src/components/preview/preview-panel.tsx`

- [ ] **Step 1: Create the preview panel placeholder**

```typescript
// src/components/preview/preview-panel.tsx
// 预览面板 — 右侧展示区域的占位组件
// Step 2+ 会逐步填充：项目理解卡片、讲稿预览、PPT 预览等
"use client";

import { FileText, Presentation, Layout } from "lucide-react";

/**
 * PreviewPanel — DemoGen 右侧预览面板
 *
 * 当前为空状态占位，后续步骤会添加：
 * - 项目理解卡片
 * - 讲稿预览
 * - PPT 大纲预览
 * - One-pager 预览
 */
export function PreviewPanel() {
  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white">
        <h2 className="text-sm font-semibold text-zinc-800">资产预览</h2>
      </div>

      {/* 空状态提示 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-8">
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
              在左侧聊天中描述你的项目或粘贴 GitHub 链接，AI 将为你生成展示资产
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/preview-panel.tsx
git commit -m "feat: add PreviewPanel placeholder component"
```

---

### Task 4: Main Page with Split Layout + Runtime Wiring

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css**

Clean up the default CSS and remove the Geist font references:

```css
/* src/app/globals.css */
/* DemoGen 全局样式 */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 2: Rewrite page.tsx with split layout and assistant-ui runtime**

```typescript
// src/app/page.tsx
// 主页面 — 左右分栏布局，连接 AI runtime
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { ChatPanel } from "@/components/chat/chat-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";

/**
 * DemoGen 主页面
 *
 * 架构说明：
 * 1. useChatRuntime() 创建一个连接到 /api/chat 的 AI 运行时
 *    它内部使用 Vercel AI SDK 的 useChat，处理消息发送和流式接收
 * 2. AssistantRuntimeProvider 将运行时注入 React context
 *    子组件（ChatPanel）通过 ThreadPrimitive 等组件自动获取消息状态
 * 3. 页面分为左右两栏：左侧聊天，右侧预览
 */
export default function Home() {
  // 创建 AI 聊天运行时，连接到我们的 /api/chat 端点
  const runtime = useChatRuntime({
    api: "/api/chat", // 对应 src/app/api/chat/route.ts
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* 左右分栏容器 — 占满整个视口高度 */}
      <div className="flex h-screen">
        {/* 左侧聊天面板 — 占 40% 宽度 */}
        <div className="w-2/5 min-w-[320px] max-w-[480px]">
          <ChatPanel />
        </div>
        {/* 右侧预览面板 — 占剩余宽度 */}
        <div className="flex-1">
          <PreviewPanel />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
```

- [ ] **Step 3: Build and verify**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Manual test**

Run: `npm run dev`
Expected:
- Page loads at http://localhost:3000 with left-right split layout
- Left panel shows chat input
- Right panel shows empty state placeholder
- Typing a message and sending it streams a response from DeepSeek

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: wire up main page with split layout and AI chat runtime"
```

---

### Task 5: Integration Verification and Push

- [ ] **Step 1: Full build check**

Run: `npm run build 2>&1 | tail -10`
Expected: Clean build with no errors

- [ ] **Step 2: Create combined commit if any loose changes**

```bash
git status
# If clean, skip. If changes exist:
git add -A
git commit -m "chore: step 1 cleanup"
```

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```
