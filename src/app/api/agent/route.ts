// Agent API 入口 — Orchestrator Agent 的后端接口
// 使用 AI SDK v6 的 streamText + tools 实现 Agent 循环
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, UIMessage, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { parseGitHubUrl, analyzeRepo } from "@/lib/github/analyzer";
import { analyzeProject } from "@/lib/ai/subagents/analysis";
import { planStrategy } from "@/lib/ai/subagents/strategy";
import { ORCHESTRATOR_PROMPT } from "@/lib/ai/prompts";

// 创建 OpenAI 兼容的模型实例（支持 DeepSeek / 第三方中转等）
// 注意：必须用 openai.chat() 而不是 openai()，后者会走 Responses API
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = openai.chat(process.env.OPENAI_MODEL || "gpt-5.2");

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
      // 内部串联 GitHub API + Analysis Subagent
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
          documents: z
            .array(z.string())
            .optional()
            .describe("用户上传的文档内容"),
        }),
        execute: async ({ githubUrl, description, documents }) => {
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
              documents,
            });
            return { success: true, data: understanding };
          } catch (err) {
            return {
              error: `AI 分析失败: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        },
      }),

      // 前端工具：让用户选择（Generative UI）
      // 没有 execute — Agent 调用后，前端渲染为按钮组，等待用户点击
      // 用户选择后结果通过 assistant-ui 的 addResult 回传
      askUserChoice: tool({
        description:
          "向用户展示选项并等待选择。用于场景选择、确认等需要用户决策的环节",
        inputSchema: z.object({
          question: z.string().describe("向用户展示的问题"),
          options: z
            .array(z.string())
            .describe("可选项列表，每个选项是一个字符串"),
        }),
        // 注意：没有 execute！这是一个前端工具
        // AI SDK 会在工具调用后暂停，等待前端通过 addToolResult 提供结果
      }),

      // 核心工具：规划展示策略
      // 内部调用 Strategy Subagent
      planStrategy: tool({
        description:
          "根据项目理解和用户选择的展示场景，规划展示策略（包含观众画像、推荐资产、展示结构）",
        inputSchema: z.object({
          scenario: z
            .string()
            .describe("用户选择的展示场景，如'课程答辩'、'面试展示'等"),
          projectName: z
            .string()
            .describe("项目名称"),
          projectSummary: z
            .string()
            .describe("项目一句话总结"),
          projectType: z
            .string()
            .describe("项目类型"),
          targetUsers: z
            .string()
            .describe("目标用户"),
          coreFeatures: z
            .array(z.string())
            .describe("核心功能列表"),
          highlights: z
            .array(z.string())
            .describe("技术亮点"),
          techStack: z
            .array(z.string())
            .describe("技术栈"),
          risks: z
            .array(z.string())
            .describe("风险提醒"),
        }),
        execute: async ({
          scenario,
          projectName,
          projectSummary,
          projectType,
          targetUsers,
          coreFeatures,
          highlights,
          techStack,
          risks,
        }) => {
          try {
            const strategy = await planStrategy({
              scenario,
              projectUnderstanding: {
                name: projectName,
                summary: projectSummary,
                type: projectType as "web-app" | "api-service" | "cli-tool" | "data-viz" | "ai-service" | "agent-workflow" | "library" | "algorithm" | "mobile-app" | "other",
                targetUsers,
                coreFeatures,
                highlights,
                techStack,
                risks,
              },
            });
            return { success: true, data: strategy };
          } catch (err) {
            return {
              error: `策略规划失败: ${err instanceof Error ? err.message : String(err)}`,
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
