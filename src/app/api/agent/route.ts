// Agent API 入口 — 后端流程控制 + 按阶段单工具调用
// 核心思路：代码决定流程，LLM 只负责生成内容
// 每个阶段只暴露一个工具 + toolChoice:"required"，LLM 无法跑偏
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
import type { ProjectType } from "@/lib/ai/schemas";

// ========== 阶段类型定义 ==========

type Phase =
  | { type: "analyze" }
  | { type: "choose-scenario" }
  | { type: "plan-strategy" }
  | { type: "confirm-assets" }
  | { type: "generate"; nextAsset: string }
  | { type: "all-done" }
  | { type: "chat" };

// ========== 从消息历史中提取工具调用结果 ==========

// 扫描 UIMessage parts，找到指定工具的最新结果
function getToolResult(messages: UIMessage[], toolName: string): unknown | null {
  // 倒序扫描，找最新的结果
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const parts = msg.parts || [];
    for (const part of parts) {
      if (
        part.type === "tool-invocation" &&
        (part as { toolName?: string }).toolName === toolName &&
        (part as { state?: string }).state === "result"
      ) {
        return (part as { result?: unknown }).result;
      }
    }
  }
  return null;
}

// 检查某个工具是否已经被调用并完成
function hasToolResult(messages: UIMessage[], toolName: string): boolean {
  return getToolResult(messages, toolName) !== null;
}

// ========== 阶段检测 ==========
// 根据消息历史中已完成的工具调用，确定当前处于哪个阶段

function detectPhase(messages: UIMessage[]): Phase {
  // Step 1: 分析项目
  if (!hasToolResult(messages, "analyzeProject")) {
    return { type: "analyze" };
  }

  // Step 2: 选择展示场景
  if (!hasToolResult(messages, "askUserChoice")) {
    return { type: "choose-scenario" };
  }

  // Step 3: 规划展示策略
  if (!hasToolResult(messages, "planStrategy")) {
    return { type: "plan-strategy" };
  }

  // Step 4: 确认要生成的资产
  if (!hasToolResult(messages, "confirmAssets")) {
    return { type: "confirm-assets" };
  }

  // Step 5: 生成资产 — 根据用户选择，逐个生成
  const confirmResult = getToolResult(messages, "confirmAssets") as {
    selectedAssets?: string[];
  } | null;
  const selectedAssets = confirmResult?.selectedAssets || [];

  const generated = new Set<string>();
  if (hasToolResult(messages, "generateScript")) generated.add("script");
  if (hasToolResult(messages, "generatePPT")) generated.add("ppt");
  if (hasToolResult(messages, "generateOnePager")) generated.add("onepager");

  const remaining = selectedAssets.filter((a) => !generated.has(a));
  if (remaining.length > 0) {
    return { type: "generate", nextAsset: remaining[0] };
  }

  // 全部资产已生成 — 判断是刚生成完（auto-request）还是用户后续对话
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount <= 1) {
    return { type: "all-done" };
  }

  // 用户发送了新消息 — 进入自由对话/修改模式
  return { type: "chat" };
}

// ========== 工具定义 ==========
// 所有工具集中定义，按阶段选择暴露哪些

// 分析项目工具
const analyzeProjectTool = tool({
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
});

// 场景选择工具（前端工具，无 execute）
const askUserChoiceTool = tool({
  description: "向用户展示选项并等待选择",
  inputSchema: z.object({
    question: z.string().describe("向用户展示的问题"),
    options: z.array(z.string()).describe("可选项列表"),
  }),
});

// 资产确认工具（前端工具，无 execute）
const confirmAssetsTool = tool({
  description: "向用户展示推荐的资产列表（多选），等待用户确认要生成哪些",
  inputSchema: z.object({
    recommendedAssets: z.array(z.object({
      type: z.string().describe("资产类型：script/ppt/onepager"),
      label: z.string().describe("资产中文名称"),
      reason: z.string().describe("为什么推荐这个资产"),
    })).describe("推荐的资产列表"),
  }),
});

// 规划展示策略工具
const planStrategyTool = tool({
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
});

// 生成讲稿工具
const generateScriptTool = tool({
  description: "生成完整的演讲稿（Markdown 格式）",
  inputSchema: z.object({
    projectName: z.string(), projectSummary: z.string(), projectType: z.string(),
    targetUsers: z.string(), coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
    techStack: z.array(z.string()), scenario: z.string(), scenarioLabel: z.string(),
    audienceProfile: z.string(), totalDuration: z.string(),
    emphasisPoints: z.array(z.string()),
    estimatedStructure: z.array(z.object({ section: z.string(), duration: z.string(), keyPoints: z.array(z.string()) })),
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
});

// 生成 PPT 大纲工具
const generatePPTTool = tool({
  description: "生成 PPT 大纲（每页标题、要点、布局、备注）",
  inputSchema: z.object({
    projectName: z.string(), projectSummary: z.string(), projectType: z.string(),
    targetUsers: z.string(), coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
    techStack: z.array(z.string()), scenario: z.string(), scenarioLabel: z.string(),
    audienceProfile: z.string(), totalDuration: z.string(),
    emphasisPoints: z.array(z.string()),
    estimatedStructure: z.array(z.object({ section: z.string(), duration: z.string(), keyPoints: z.array(z.string()) })),
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
});

// 生成 One-pager 工具
const generateOnePagerTool = tool({
  description: "生成项目一页纸",
  inputSchema: z.object({
    projectName: z.string(), projectSummary: z.string(), projectType: z.string(),
    targetUsers: z.string(), coreFeatures: z.array(z.string()), highlights: z.array(z.string()),
    techStack: z.array(z.string()), scenario: z.string(), scenarioLabel: z.string(),
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
});

// 资产修改工具
const reviseAssetTool = tool({
  description: "根据用户的修改指令，修改已生成的资产。用户说'改讲稿第三段'或'PPT第二页加要点'时调用。",
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
});

// ========== 每个阶段的系统提示词（极短，只说做什么） ==========

const PHASE_PROMPTS: Record<string, string> = {
  analyze: `你是项目分析助手。立即调用 analyzeProject 工具分析用户提交的项目信息。从用户消息中提取 GitHub 链接、项目描述和文档内容作为参数。完成后只说"已完成分析。"`,

  "choose-scenario": `调用 askUserChoice 工具。参数：question 设为"请选择你的展示场景："，options 设为 ["课程答辩", "面试展示", "开源推广", "产品发布", "团队汇报"]。不要输出任何其他文字。`,

  "plan-strategy": `立即调用 planStrategy 工具。从对话历史中找到 analyzeProject 的结果和用户选择的场景，构造参数。完成后只说"策略已生成。"`,

  "confirm-assets": `立即调用 confirmAssets 工具。从对话历史中找到 planStrategy 结果里的 recommendedAssets 字段，原样传给 confirmAssets。不要输出任何其他文字。`,

  "all-done": `只输出这一句话："所有资产已生成，请在右侧查看和编辑。" 不要输出任何其他内容，不要调用任何工具。`,

  chat: `你是 DemoGen 助手。用户可能要求修改已生成的资产。

规则：
- 如果用户要求修改资产（讲稿/PPT/一页纸），立即调用 reviseAsset 工具
- 从对话历史中找到该资产的最新内容作为 currentContent 参数
- 修改完成后只说"已修改，请查看右侧。"
- 回复不超过 1 句话
- 绝对不要自己输出资产内容或修改后的文本`,
};

// 生成阶段的 prompt 需要包含上下文数据，避免 LLM 从长消息历史中找不到
function getGeneratePrompt(nextAsset: string, messages: UIMessage[]): string {
  const toolNameMap: Record<string, string> = {
    script: "generateScript",
    ppt: "generatePPT",
    onepager: "generateOnePager",
  };

  // 从消息历史中提取项目理解和策略数据
  const analyzeResult = getToolResult(messages, "analyzeProject") as { data?: unknown } | null;
  const strategyResult = getToolResult(messages, "planStrategy") as { data?: unknown } | null;

  return `立即调用 ${toolNameMap[nextAsset]} 工具。使用以下数据构造参数：

项目数据：
${JSON.stringify(analyzeResult?.data || {}, null, 2)}

展示策略：
${JSON.stringify(strategyResult?.data || {}, null, 2)}

不要输出任何文字，直接调用工具。`;
}

// ========== 路由处理器 ==========

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const phase = detectPhase(messages);
  const modelMessages = await convertToModelMessages(messages);

  // 根据阶段选择工具集、系统提示词和 toolChoice
  switch (phase.type) {
    case "analyze": {
      const result = streamText({
        model,
        system: PHASE_PROMPTS.analyze,
        messages: modelMessages,
        tools: { analyzeProject: analyzeProjectTool },
        toolChoice: "required",
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "choose-scenario": {
      const result = streamText({
        model,
        system: PHASE_PROMPTS["choose-scenario"],
        messages: modelMessages,
        tools: { askUserChoice: askUserChoiceTool },
        toolChoice: "required",
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "plan-strategy": {
      const result = streamText({
        model,
        system: PHASE_PROMPTS["plan-strategy"],
        messages: modelMessages,
        tools: { planStrategy: planStrategyTool },
        toolChoice: "required",
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "confirm-assets": {
      const result = streamText({
        model,
        system: PHASE_PROMPTS["confirm-assets"],
        messages: modelMessages,
        tools: { confirmAssets: confirmAssetsTool },
        toolChoice: "required",
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "generate": {
      // 根据下一个待生成的资产类型，选择对应的工具
      const toolMap: Record<string, Record<string, unknown>> = {
        script: { generateScript: generateScriptTool },
        ppt: { generatePPT: generatePPTTool },
        onepager: { generateOnePager: generateOnePagerTool },
      };

      const result = streamText({
        model,
        system: getGeneratePrompt(phase.nextAsset, messages),
        messages: modelMessages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: (toolMap[phase.nextAsset] || {}) as any,
        toolChoice: "required",
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "all-done": {
      // 全部生成完毕 — 不需要任何工具，只输出简短完成消息
      const result = streamText({
        model,
        system: PHASE_PROMPTS["all-done"],
        messages: modelMessages,
        tools: {},
        stopWhen: stepCountIs(1),
      });
      return result.toUIMessageStreamResponse();
    }

    case "chat": {
      // 自由对话/修改模式 — 只暴露 reviseAsset 工具
      const result = streamText({
        model,
        system: PHASE_PROMPTS.chat,
        messages: modelMessages,
        tools: { reviseAsset: reviseAssetTool },
        toolChoice: "auto",
        stopWhen: stepCountIs(3),
      });
      return result.toUIMessageStreamResponse();
    }
  }
}
