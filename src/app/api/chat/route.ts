// src/app/api/chat/route.ts
// AI 对话接口 — 接收前端消息，通过 DeepSeek API 流式返回回复
// Step 2 新增：工具调用（analyzeRepo）让 AI 能解析 GitHub 仓库
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  parseGitHubUrl,
  analyzeRepo,
} from "@/lib/github/analyzer";
import { projectUnderstandingSchema, displayStrategySchema } from "@/lib/ai/schemas";
import { DEMOGEN_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/ai/prompts";

export async function POST(request: Request) {
  const { messages } = await request.json();

  // 将前端的 UIMessage 格式转换为模型能理解的格式
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai.chat(process.env.OPENAI_MODEL || "deepseek-chat"),
    system: DEMOGEN_SYSTEM_PROMPT,
    messages: modelMessages,

    // 工具定义 — 让 AI 能调用外部功能
    // 当 AI 判断需要分析仓库时，会自动调用 analyzeRepo 工具
    tools: {
      /**
       * analyzeRepo 工具 — 解析 GitHub 仓库
       * AI 检测到用户发送了 GitHub 链接时会调用此工具
       * 工具执行后返回的结果会作为上下文继续对话
       */
      analyzeRepo: tool({
        description:
          "分析 GitHub 仓库，获取 README、目录结构、依赖信息等。当用户提供了 GitHub 链接时调用此工具。",
        inputSchema: z.object({
          url: z.string().describe("GitHub 仓库的 URL"),
        }),
        execute: async ({ url }) => {
          // 从 URL 中提取 owner 和 repo
          const parsed = parseGitHubUrl(url);
          if (!parsed) {
            return { error: "无法解析 GitHub URL，请提供有效的仓库链接" };
          }

          try {
            // 调用 GitHub API 获取仓库信息
            const analysis = await analyzeRepo(parsed.owner, parsed.repo);

            // 构建分析提示，让 AI 基于数据进行结构化分析
            const analysisPrompt = buildAnalysisPrompt(analysis);

            return {
              success: true,
              repoInfo: {
                name: analysis.name,
                fullName: analysis.fullName,
                description: analysis.description,
                language: analysis.language,
                stars: analysis.stars,
                topics: analysis.topics,
                hasDeployUrl: analysis.hasDeployUrl,
                deployUrl: analysis.deployUrl,
              },
              analysisPrompt,
            };
          } catch (error) {
            return {
              error: `仓库解析失败: ${error instanceof Error ? error.message : "未知错误"}`,
            };
          }
        },
      }),

      /**
       * generateProjectUnderstanding 工具 — 生成结构化项目理解
       * AI 分析完仓库后调用此工具，输出结构化的项目理解卡片数据
       * 前端会监听这个工具的输出，渲染到右侧预览面板
       */
      generateProjectUnderstanding: tool({
        description:
          "生成结构化的项目理解卡片。在分析完仓库信息后调用此工具，将分析结果结构化输出。",
        inputSchema: projectUnderstandingSchema,
        // 无 execute — 前端工具，参数由前端 onToolCall 接收并渲染
      }),

      /**
       * generateDisplayStrategy 工具 — 生成展示策略推荐
       * AI 了解用户展示场景后调用此工具，输出结构化策略数据
       * 前端监听并渲染到右侧预览面板
       */
      generateDisplayStrategy: tool({
        description:
          "生成展示策略卡片。在了解用户的展示场景和需求后调用此工具，推荐资产组合和展示结构。",
        inputSchema: displayStrategySchema,
        // 无 execute — 前端工具
      }),
    },

    // 多步工具调用 — AI 可以连续调用多个工具
    // 例如：analyzeRepo（获取数据）→ generateProjectUnderstanding（生成卡片）→ 继续对话
    // stepCountIs(5) 表示最多允许 5 轮工具调用，防止无限循环
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
