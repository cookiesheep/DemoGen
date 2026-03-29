// Agent API 入口 — 状态机驱动的 Orchestrator
// 每次请求：从消息历史推导状态 → 只给 LLM 该状态的工具和 prompt
// LLM 无法"走偏"，因为错误的工具根本不存在
import { streamText, tool, UIMessage, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";
import { parseGitHubUrl, analyzeRepo } from "@/lib/github/analyzer";
import { analyzeProject } from "@/lib/ai/subagents/analysis";
import { planStrategy } from "@/lib/ai/subagents/strategy";
import { generateScript } from "@/lib/ai/subagents/script-writer";
import { generatePPT } from "@/lib/ai/subagents/ppt-architect";
import { generateOnePager } from "@/lib/ai/subagents/onepager-designer";
import { reviseScript, revisePpt, reviseOnePager } from "@/lib/ai/revise";
import { model } from "@/lib/ai/client";
import { deriveState, getStatePrompt, getStateToolNames } from "@/lib/ai/state-machine";
import type { ProjectType } from "@/lib/ai/schemas";
import type { ToolSet } from "ai";

// ========== 全部工具定义 ==========
// 所有工具在这里定义，route 根据状态筛选后传给 streamText

const ALL_TOOLS: ToolSet = {
  analyzeProject: tool({
    description: "分析用户提交的项目资料，生成结构化的项目理解",
    inputSchema: z.object({
      githubUrl: z.string().optional().describe("GitHub 仓库链接"),
      description: z.string().optional().describe("用户对项目的文字描述"),
      documents: z.array(z.string()).optional().describe("用户上传的文档内容"),
    }),
    execute: async ({ githubUrl, description, documents }) => {
      let githubData = undefined;
      if (githubUrl) {
        const parsed = parseGitHubUrl(githubUrl);
        if (!parsed) return { error: "无法解析 GitHub 链接，请检查格式" };
        try {
          githubData = await analyzeRepo(parsed.owner, parsed.repo);
        } catch (err) {
          return { error: `获取 GitHub 仓库数据失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
      try {
        const understanding = await analyzeProject({ githubData, description, documents });
        return {
          success: true,
          data: understanding,
          summary: {
            projectName: understanding.name,
            projectType: understanding.type,
            featureCount: understanding.coreFeatures.length,
            highlightCount: understanding.highlights.length,
            techStackCount: understanding.techStack.length,
          },
        };
      } catch (err) {
        return { error: `AI 分析失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),

  // 前端工具：场景选择（无 execute）
  askUserChoice: tool({
    description: "向用户展示选项并等待选择",
    inputSchema: z.object({
      question: z.string().describe("向用户展示的问题"),
      options: z.array(z.string()).describe("可选项列表"),
    }),
  }),

  // 前端工具：资产确认（无 execute）
  confirmAssets: tool({
    description: "向用户展示推荐的资产列表（多选），等待确认",
    inputSchema: z.object({
      recommendedAssets: z.array(z.object({
        type: z.string().describe("资产类型：script/ppt/onepager"),
        label: z.string().describe("资产中文名称"),
        reason: z.string().describe("推荐理由"),
      })).describe("推荐的资产列表"),
    }),
  }),

  planStrategy: tool({
    description: "根据项目理解和展示场景，规划展示策略",
    inputSchema: z.object({
      scenario: z.string().describe("展示场景"),
      projectName: z.string().describe("项目名称"),
      projectSummary: z.string().describe("项目一句话总结"),
      projectType: z.string().describe("项目类型"),
      targetUsers: z.string().describe("目标用户"),
      coreFeatures: z.array(z.string()).describe("核心功能列表"),
      highlights: z.array(z.string()).describe("技术亮点"),
      techStack: z.array(z.string()).describe("技术栈"),
      risks: z.array(z.string()).describe("风险提醒"),
    }),
    execute: async ({ scenario, projectName, projectSummary, projectType, targetUsers, coreFeatures, highlights, techStack, risks }) => {
      try {
        const strategy = await planStrategy({
          scenario,
          projectUnderstanding: {
            name: projectName, summary: projectSummary,
            type: projectType as ProjectType,
            targetUsers, coreFeatures, highlights, techStack, risks,
          },
        });
        return {
          success: true,
          data: strategy,
          summary: {
            scenarioLabel: strategy.scenarioLabel,
            assetCount: strategy.recommendedAssets.length,
            assetLabels: strategy.recommendedAssets.map((a) => a.label),
            totalDuration: strategy.totalDuration,
          },
        };
      } catch (err) {
        return { error: `策略规划失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),

  generateScript: tool({
    description: "生成完整的演讲稿（Markdown 格式）",
    inputSchema: z.object({
      projectName: z.string(), projectSummary: z.string(),
      projectType: z.string(), targetUsers: z.string(),
      coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
      techStack: z.array(z.string()),
      scenario: z.string(), scenarioLabel: z.string(),
      audienceProfile: z.string(), totalDuration: z.string(),
      emphasisPoints: z.array(z.string()),
      estimatedStructure: z.array(z.object({
        section: z.string(), duration: z.string(), keyPoints: z.array(z.string()),
      })),
    }),
    execute: async (input) => {
      try {
        const script = await generateScript({
          projectUnderstanding: {
            name: input.projectName, summary: input.projectSummary,
            type: input.projectType as ProjectType,
            targetUsers: input.targetUsers, coreFeatures: input.coreFeatures,
            highlights: input.highlights, techStack: input.techStack, risks: [],
          },
          displayStrategy: {
            scenario: input.scenario as "course-defense" | "job-interview" | "open-source-promo" | "product-launch" | "team-report" | "custom",
            scenarioLabel: input.scenarioLabel, audienceProfile: input.audienceProfile,
            totalDuration: input.totalDuration, emphasisPoints: input.emphasisPoints,
            estimatedStructure: input.estimatedStructure, recommendedAssets: [],
          },
        });
        return { success: true, data: script, summary: { charCount: script.length, estimatedMinutes: Math.round(script.length / 250) } };
      } catch (err) {
        return { error: `讲稿生成失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),

  generatePPT: tool({
    description: "生成 PPT 大纲（每页标题、要点、布局建议）",
    inputSchema: z.object({
      projectName: z.string(), projectSummary: z.string(),
      projectType: z.string(), targetUsers: z.string(),
      coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
      techStack: z.array(z.string()),
      scenario: z.string(), scenarioLabel: z.string(),
      audienceProfile: z.string(), totalDuration: z.string(),
      emphasisPoints: z.array(z.string()),
      estimatedStructure: z.array(z.object({
        section: z.string(), duration: z.string(), keyPoints: z.array(z.string()),
      })),
    }),
    execute: async (input) => {
      try {
        const ppt = await generatePPT({
          projectUnderstanding: {
            name: input.projectName, summary: input.projectSummary,
            type: input.projectType as ProjectType,
            targetUsers: input.targetUsers, coreFeatures: input.coreFeatures,
            highlights: input.highlights, techStack: input.techStack, risks: [],
          },
          displayStrategy: {
            scenario: input.scenario as "course-defense" | "job-interview" | "open-source-promo" | "product-launch" | "team-report" | "custom",
            scenarioLabel: input.scenarioLabel, audienceProfile: input.audienceProfile,
            totalDuration: input.totalDuration, emphasisPoints: input.emphasisPoints,
            estimatedStructure: input.estimatedStructure, recommendedAssets: [],
          },
        });
        return { success: true, data: ppt, summary: { slideCount: ppt.totalSlides, title: ppt.title } };
      } catch (err) {
        return { error: `PPT 大纲生成失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),

  generateOnePager: tool({
    description: "生成项目一页纸（精炼的项目介绍）",
    inputSchema: z.object({
      projectName: z.string(), projectSummary: z.string(),
      projectType: z.string(), targetUsers: z.string(),
      coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
      techStack: z.array(z.string()),
      scenario: z.string(), scenarioLabel: z.string(),
      audienceProfile: z.string(),
    }),
    execute: async (input) => {
      try {
        const onepager = await generateOnePager({
          projectUnderstanding: {
            name: input.projectName, summary: input.projectSummary,
            type: input.projectType as ProjectType,
            targetUsers: input.targetUsers, coreFeatures: input.coreFeatures,
            highlights: input.highlights, techStack: input.techStack, risks: [],
          },
          displayStrategy: {
            scenario: input.scenario as "course-defense" | "job-interview" | "open-source-promo" | "product-launch" | "team-report" | "custom",
            scenarioLabel: input.scenarioLabel, audienceProfile: input.audienceProfile,
            totalDuration: "", emphasisPoints: [], estimatedStructure: [], recommendedAssets: [],
          },
        });
        return { success: true, data: onepager, summary: { projectName: onepager.projectName, tagline: onepager.tagline } };
      } catch (err) {
        return { error: `One-pager 生成失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),

  reviseAsset: tool({
    description: "根据用户指令修改已生成的资产（讲稿/PPT大纲/一页纸）",
    inputSchema: z.object({
      assetType: z.enum(["script", "ppt", "onepager"]).describe("要修改的资产类型"),
      currentContent: z.string().describe("当前资产的完整内容"),
      instructions: z.string().describe("用户的修改指令"),
    }),
    execute: async ({ assetType, currentContent, instructions }) => {
      try {
        switch (assetType) {
          case "script": {
            const revised = await reviseScript(currentContent, instructions);
            return { success: true, assetType, data: revised, summary: { assetType: "script", charCount: revised.length } };
          }
          case "ppt": {
            const revised = await revisePpt(JSON.parse(currentContent), instructions);
            return { success: true, assetType, data: revised, summary: { assetType: "ppt", slideCount: revised.totalSlides } };
          }
          case "onepager": {
            const revised = await reviseOnePager(JSON.parse(currentContent), instructions);
            return { success: true, assetType, data: revised, summary: { assetType: "onepager", projectName: revised.projectName } };
          }
        }
      } catch (err) {
        return { error: `资产修改失败: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }),
};

// ========== API 入口 ==========

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 1. 从消息历史推导当前状态
  const ctx = deriveState(messages);

  // 2. 获取该状态的 prompt 和允许的工具名
  const systemPrompt = getStatePrompt(ctx.state);
  const allowedToolNames = getStateToolNames(ctx.state);

  // 3. 筛选出该状态允许的工具
  const tools: ToolSet = {};
  for (const name of allowedToolNames) {
    if (ALL_TOOLS[name]) {
      tools[name] = ALL_TOOLS[name];
    }
  }

  // 4. 转换消息并调用 streamText
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    // generating 状态可能需要连续调用多个生成工具
    stopWhen: stepCountIs(ctx.state === "generating" ? 5 : 2),
  });

  return result.toUIMessageStreamResponse();
}
