// Agent API 入口 — 状态机驱动的 Orchestrator
//
// ===== 架构原理 =====
//
// 旧方案：把所有工具 + 一个大 prompt 传给 streamText，靠 LLM 自己决定流程。
//   问题：LLM 不听话，生成资产后在左侧输出大段内容，修改时不调工具。
//
// 新方案（状态机）：
//   1. 每次请求到达，从消息历史推导当前状态（deriveState）
//   2. 根据状态选择：极简 prompt（1-3 句话）+ 该状态允许的工具集
//   3. LLM 只能做当前步骤该做的事——因为其他工具根本不存在
//
// 关键洞察：流程控制由代码负责，LLM 只负责生成内容。
// 这让弱模型也能可靠地工作，因为"调用唯一可用的工具"远比
// "从 9 个工具中选对的那个"简单得多。

import { streamText, tool, UIMessage, stepCountIs, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { parseGitHubUrl, analyzeRepo } from "@/lib/github/analyzer";
import { analyzeProject } from "@/lib/ai/subagents/analysis";
import { planStrategy } from "@/lib/ai/subagents/strategy";
import { generateScript } from "@/lib/ai/subagents/script-writer";
import { generatePPT } from "@/lib/ai/subagents/ppt-architect";
import { generateOnePager } from "@/lib/ai/subagents/onepager-designer";
import { reviseScript, revisePpt, reviseOnePager } from "@/lib/ai/revise";
import { STATE_PROMPTS } from "@/lib/ai/prompts";
import { model } from "@/lib/ai/client";
import { deriveState, getRemainingAssets } from "@/lib/ai/state-machine";
import type { ProjectType } from "@/lib/ai/schemas";
import type { ToolSet } from "ai";

// ========== 工具定义 ==========
// 所有工具的定义放在这里，route handler 根据状态选择子集传给 streamText
// 工具本身的逻辑不变——变的只是"哪些工具当前可见"

const ALL_TOOLS = {
  // 分析项目（analyzing 状态使用）
  analyzeProject: tool({
    description:
      "分析用户提交的项目资料（GitHub 链接、文档、描述），生成结构化的项目理解",
    inputSchema: z.object({
      githubUrl: z.string().optional().describe("GitHub 仓库链接"),
      description: z.string().optional().describe("用户对项目的文字描述"),
      documents: z.array(z.string()).optional().describe("用户上传的文档内容"),
    }),
    execute: async ({ githubUrl, description, documents }) => {
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
        return {
          error: `AI 分析失败: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  }),

  // 场景选择（awaiting_scenario 状态使用，前端工具）
  askUserChoice: tool({
    description: "向用户展示选项并等待选择",
    inputSchema: z.object({
      question: z.string().describe("向用户展示的问题"),
      options: z.array(z.string()).describe("可选项列表"),
    }),
  }),

  // 策略规划（planning 状态使用）
  planStrategy: tool({
    description: "根据项目理解和展示场景，规划展示策略",
    inputSchema: z.object({
      scenario: z.string().describe("用户选择的展示场景"),
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

  // 资产确认（awaiting_assets 状态使用，前端工具）
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

  // 生成讲稿（generating 状态使用）
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

  // 生成 PPT 大纲（generating 状态使用）
  generatePPT: tool({
    description: "生成 PPT 大纲（每页标题、要点、布局）",
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

  // 生成 One-pager（generating 状态使用）
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

  // 修改资产（editing 状态使用）
  reviseAsset: tool({
    description: "根据用户指令修改已生成的资产",
    inputSchema: z.object({
      assetType: z.enum(["script", "ppt", "onepager"]).describe("资产类型"),
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

// ========== 状态 → 工具集映射 ==========
//
// 这是状态机的核心控制点：每个状态只暴露特定的工具。
// LLM 看不到其他工具，所以不可能调用错误的工具。
//
// 比如在 editing 状态，LLM 只有 reviseAsset 一个工具。
// 它想"自己输出修改后的文本"？不行——系统会继续等它调工具。
// 它想调 analyzeProject 重新分析？不行——这个工具不存在于当前调用中。

function getToolsForState(state: string): ToolSet {
  switch (state) {
    case "analyzing":
      return { analyzeProject: ALL_TOOLS.analyzeProject };

    case "awaiting_scenario":
      return { askUserChoice: ALL_TOOLS.askUserChoice };

    case "planning":
      return { planStrategy: ALL_TOOLS.planStrategy };

    case "awaiting_assets":
      return { confirmAssets: ALL_TOOLS.confirmAssets };

    case "generating":
      // 生成阶段暴露所有资产生成工具（LLM 按需调用）
      return {
        generateScript: ALL_TOOLS.generateScript,
        generatePPT: ALL_TOOLS.generatePPT,
        generateOnePager: ALL_TOOLS.generateOnePager,
      };

    case "editing":
      return { reviseAsset: ALL_TOOLS.reviseAsset };

    default:
      return {};
  }
}

// ========== API 路由处理器 ==========
//
// 新的请求处理流程：
//   1. 解析消息 → 2. 推导状态 → 3. 选 prompt + 工具 → 4. streamText → 5. 返回
//
// 对比旧方案的 "一个大 streamText + 全部工具"，新方案每次只给 LLM
// 最少的信息和最少的工具，让它做最简单的事。

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 调试日志
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (const part of msg.parts) {
        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          const p = part as Record<string, unknown>;
          console.log("[DEBUG] tool part:", JSON.stringify({
            type: p.type, state: p.state, hasOutput: p.output !== undefined,
          }));
        }
      }
    }
  }

  // Step 1: 推导状态
  const state = deriveState(messages);
  console.log("[DEBUG] derived state:", state);

  // ===== 固定参数的前端工具：跳过 LLM，代码直接发起工具调用 =====
  //
  // 原理：askUserChoice 和 confirmAssets 是前端工具（无 execute）。
  // 它们的参数在某些状态下是完全固定的（比如场景选择的 5 个选项）。
  // 如果让 LLM 填参数，它经常填错（自己编问题和选项）。
  //
  // 解决：直接用 createUIMessageStream 构造一个包含工具调用的响应，
  // 发送 "tool-input-available" chunk 给前端。前端会渲染对应的组件
  // （ChoiceSelector / AssetSelector），和正常工具调用完全一样。
  //
  // 这是状态机架构的另一个优势：某些步骤完全不需要 LLM 参与。

  if (state === "awaiting_scenario") {
    // 场景选择的参数是固定的，不需要 LLM
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: "tool-input-available",
          toolCallId: `call-scenario-${Date.now()}`,
          toolName: "askUserChoice",
          input: {
            question: "请选择你的展示场景：",
            options: ["课程答辩", "面试展示", "开源推广", "产品发布", "团队汇报"],
          },
        });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  if (state === "awaiting_assets") {
    // 从消息历史中提取 planStrategy 的结果，拿到 recommendedAssets
    const recommendedAssets = extractRecommendedAssets(messages);
    if (recommendedAssets.length > 0) {
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({
            type: "tool-input-available",
            toolCallId: `call-assets-${Date.now()}`,
            toolName: "confirmAssets",
            input: { recommendedAssets },
          });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }
    // 如果没找到推荐资产，fallthrough 让 LLM 处理
  }

  // ===== 需要 LLM 的状态：走 streamText =====
  let systemPrompt = STATE_PROMPTS[state];
  const tools = getToolsForState(state);

  if (state === "generating") {
    const remaining = getRemainingAssets(messages);
    const assetLabels: Record<string, string> = {
      script: "讲稿(generateScript)",
      ppt: "PPT大纲(generatePPT)",
      onepager: "一页纸(generateOnePager)",
    };
    const remainingList = remaining.map((a) => assetLabels[a] || a).join("、");
    systemPrompt += `\n还需要生成：${remainingList}。`;
  }

  const modelMessages = await convertToModelMessages(messages);
  const stateConfig = STATE_STREAM_CONFIG[state];

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(stateConfig.maxSteps),
    toolChoice: stateConfig.toolChoice,
  });

  return result.toUIMessageStreamResponse();
}

// 从消息历史中提取 planStrategy 返回的 recommendedAssets
function extractRecommendedAssets(messages: UIMessage[]): { type: string; label: string; reason: string }[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (
        typeof p.type === "string" &&
        p.type === "tool-planStrategy" &&
        p.output
      ) {
        const output = p.output as { success?: boolean; data?: { recommendedAssets?: { type: string; label: string; reason: string }[] } };
        if (output.success && output.data?.recommendedAssets) {
          return output.data.recommendedAssets;
        }
      }
    }
  }
  return [];
}

// 每个状态的 streamText 配置
const STATE_STREAM_CONFIG: Record<
  string,
  { maxSteps: number; toolChoice: "auto" | "required" }
> = {
  // 分析：强制调 analyzeProject，调完停
  analyzing:        { maxSteps: 1, toolChoice: "required" },
  // 场景选择：强制调 askUserChoice（前端工具），调完停
  awaiting_scenario: { maxSteps: 1, toolChoice: "required" },
  // 策略规划：强制调 planStrategy，调完停
  planning:         { maxSteps: 1, toolChoice: "required" },
  // 资产确认：强制调 confirmAssets（前端工具），调完停
  awaiting_assets:  { maxSteps: 1, toolChoice: "required" },
  // 生成资产：强制调工具，可连续调多个（讲稿+PPT+一页纸）
  generating:       { maxSteps: 5, toolChoice: "required" },
  // 编辑模式：用户可能聊天也可能要修改，所以 auto
  editing:          { maxSteps: 2, toolChoice: "auto" },
};
