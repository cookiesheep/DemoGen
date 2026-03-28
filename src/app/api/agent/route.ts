// Agent API 入口 — Orchestrator Agent 的后端接口
// 使用 AI SDK v6 的 streamText + tools 实现 Agent 循环
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, UIMessage, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { parseGitHubUrl, analyzeRepo } from "@/lib/github/analyzer";
import { analyzeProject } from "@/lib/ai/subagents/analysis";
import { ORCHESTRATOR_PROMPT } from "@/lib/ai/prompts";

// 创建 OpenAI 兼容的模型实例（支持 DeepSeek / 第三方中转等）
// 注意：必须用 openai.chat() 而不是 openai()，后者会走 Responses API
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = openai.chat(process.env.OPENAI_MODEL || "gpt-4o");

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
      // 测试工具：获取当前时间
      getCurrentTime: tool({
        description: "获取当前的日期和时间",
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

      // 核心工具：分析项目
      // Orchestrator 调用此工具时，内部会串联 GitHub API + Analysis Subagent
      analyzeProject: tool({
        description:
          "分析用户提交的项目资料（GitHub 链接、文档、描述），生成结构化的项目理解",
        inputSchema: z.object({
          githubUrl: z
            .string()
            .optional()
            .describe("GitHub 仓库链接"),
          description: z
            .string()
            .optional()
            .describe("用户对项目的文字描述"),
        }),
        execute: async ({ githubUrl, description }) => {
          // Step 1: 如果有 GitHub 链接，先获取仓库数据
          let githubData = undefined;
          if (githubUrl) {
            const parsed = parseGitHubUrl(githubUrl);
            if (!parsed) {
              return { error: "无法解析 GitHub 链接，请检查格式" };
            }
            try {
              githubData = await analyzeRepo(parsed.owner, parsed.repo);
            } catch (err) {
              return {
                error: `获取 GitHub 仓库数据失败: ${err instanceof Error ? err.message : String(err)}`,
              };
            }
          }

          // Step 2: 调用 Analysis Subagent 生成结构化理解
          try {
            const understanding = await analyzeProject({
              githubData,
              description,
            });
            return { success: true, data: understanding };
          } catch (err) {
            return {
              error: `AI 分析失败: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        },
      }),
    },
    // 最多执行 10 步工具调用（防止无限循环）
    stopWhen: stepCountIs(10),
  });

  // AI SDK v6: 用 toUIMessageStreamResponse() 返回流式响应
  return result.toUIMessageStreamResponse();
}
