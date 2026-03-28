// Agent API 入口 — Orchestrator Agent 的后端接口
// 使用 AI SDK v6 的 streamText + tools 实现 Agent 循环
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, UIMessage, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";

// 创建 OpenAI 兼容的模型实例（支持 DeepSeek / 第三方中转等）
// 注意：必须用 openai.chat() 而不是 openai()，后者会走 Responses API
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = openai.chat(process.env.OPENAI_MODEL || "gpt-4o");

// Orchestrator 的 system prompt（Phase 1 简化版）
const ORCHESTRATOR_PROMPT = `你是 DemoGen 的 Orchestrator Agent —— 一个专门帮助用户生成项目展示资产的 AI 助手。

你的职责：
1. 接收用户提交的项目信息（GitHub 链接、文档、描述等）
2. 调用工具分析项目、规划策略、生成展示资产
3. 全程保持简洁、专业的沟通风格

当前阶段（Phase 1）你可以：
- 与用户正常对话
- 调用 getCurrentTime 工具获取当前时间（测试工具调用是否正常）

请用中文和用户交流，保留英文技术术语。回复要简洁有力，不要啰嗦。`;

export async function POST(req: Request) {
  // 从请求中获取消息列表（AI SDK v6 格式）
  const { messages }: { messages: UIMessage[] } = await req.json();

  // AI SDK v6: 必须将 UIMessage 转换为 ModelMessage 才能传给 streamText
  const modelMessages = await convertToModelMessages(messages);

  // 使用 streamText 驱动 Agent 循环
  const result = streamText({
    model,
    system: ORCHESTRATOR_PROMPT,
    messages: modelMessages,
    // 定义 Agent 可用的工具
    tools: {
      // 测试工具：获取当前时间（验证工具调用流程）
      getCurrentTime: tool({
        description: "获取当前的日期和时间",
        // AI SDK v6: 用 inputSchema 而不是 parameters
        inputSchema: z.object({
          timezone: z
            .string()
            .optional()
            .describe("时区，如 Asia/Shanghai，默认 UTC"),
        }),
        execute: async ({ timezone }) => {
          const tz = timezone || "Asia/Shanghai";
          const now = new Date().toLocaleString("zh-CN", { timeZone: tz });
          return { time: now, timezone: tz };
        },
      }),
    },
    // 最多执行 10 步工具调用（防止无限循环）
    stopWhen: stepCountIs(10),
  });

  // AI SDK v6: 用 toUIMessageStreamResponse() 返回流式响应
  return result.toUIMessageStreamResponse();
}
