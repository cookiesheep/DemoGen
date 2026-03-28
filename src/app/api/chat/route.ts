// src/app/api/chat/route.ts
// AI 对话接口 — 接收前端消息，通过 DeepSeek API 流式返回回复
import { streamText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(request: Request) {
  // 从请求体中解析消息列表
  // AI SDK v6 的前端发送的是 UIMessage 格式（带 parts 数组），
  // 而不是旧版的 { role, content } 格式
  const { messages } = await request.json();

  // 将前端的 UIMessage 格式转换为模型能理解的 ModelMessage 格式
  // UIMessage 用 parts: [{ type: "text", text: "..." }] 表示内容
  // ModelMessage 用 content: "..." 或 content: [{ type: "text", text: "..." }] 表示
  // 这一步是 AI SDK v6 的关键变化
  const modelMessages = await convertToModelMessages(messages);

  // 使用 Vercel AI SDK 的 streamText 进行流式生成
  // @ai-sdk/openai 会自动读取环境变量：
  //   OPENAI_API_KEY → API 密钥
  //   OPENAI_BASE_URL → API 地址（DeepSeek: https://api.deepseek.com）
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
    messages: modelMessages,
  });

  // 返回流式响应
  // toUIMessageStreamResponse() 将模型输出转换成前端 assistant-ui 能解析的流格式
  return result.toUIMessageStreamResponse();
}
