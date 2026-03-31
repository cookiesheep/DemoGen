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
//
// ===== Bug 2 & 3 修复 =====
//
// 旧方案：planStrategy/generate*/reviseAsset 的 inputSchema 有大量字段，
// 要求 LLM 从对话历史中提取。弱模型经常漏字段、填错、幻觉。
//
// 新方案：工具参数由代码从消息历史中提取（辅助函数 + 闭包注入）。
// LLM 只需"调用工具"这一个动作，不需要填任何上下文参数。
// planStrategy/generate* 的 inputSchema 为空，reviseAsset 只需 assetType + instructions。

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
import type { ProjectUnderstanding, DisplayStrategy } from "@/lib/ai/schemas";
import type { ToolSet } from "ai";

// ========== 辅助函数：从消息历史中提取已完成工具的结构化结果 ==========
//
// 原理：每个工具完成后，结果会作为 tool part 存在消息历史中。
// 格式：{ type: "tool-{toolName}", output: { success: true, data: ... } }
// 这些函数倒序遍历消息，找到最近一次成功的工具输出。
//
// 这是 Bug 2 修复的核心——把"LLM 从历史提取参数"变成"代码从历史提取参数"。

// 提取 analyzeProject 工具的输出（项目理解）
function extractProjectUnderstanding(messages: UIMessage[]): ProjectUnderstanding | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-analyzeProject" && p.output) {
        const output = p.output as { success?: boolean; data?: ProjectUnderstanding };
        if (output.success && output.data) return output.data;
      }
    }
  }
  return null;
}

// 提取 askUserChoice 工具的输出（用户选择的展示场景）
function extractScenario(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-askUserChoice" && p.output) {
        const output = p.output as { selectedOption?: string };
        if (output.selectedOption) return output.selectedOption;
      }
    }
  }
  return null;
}

// 提取 planStrategy 工具的输出（展示策略）
function extractStrategy(messages: UIMessage[]): DisplayStrategy | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-planStrategy" && p.output) {
        const output = p.output as { success?: boolean; data?: DisplayStrategy };
        if (output.success && output.data) return output.data;
      }
    }
  }
  return null;
}

// 提取某种资产的最新内容（优先找 reviseAsset 的修改版本，再找 generate* 的原始版本）
// Bug 3 修复：reviseAsset 不再要求 LLM 搬运 currentContent，代码自动提取
function extractLatestAsset(messages: UIMessage[], assetType: string): string | null {
  // generate* 工具名映射
  const generateToolMap: Record<string, string> = {
    script: "tool-generateScript",
    ppt: "tool-generatePPT",
    onepager: "tool-generateOnePager",
  };

  // 倒序搜索：先找到的就是最新版本
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      const partType = p.type as string;

      // 优先检查 reviseAsset 的输出（可能已被修改过多次）
      if (partType === "tool-reviseAsset" && p.output) {
        const output = p.output as { success?: boolean; assetType?: string; data?: unknown };
        if (output.success && output.assetType === assetType) {
          return typeof output.data === "string" ? output.data : JSON.stringify(output.data);
        }
      }

      // 再检查 generate* 的原始输出
      if (partType === generateToolMap[assetType] && p.output) {
        const output = p.output as { success?: boolean; data?: unknown };
        if (output.success) {
          return typeof output.data === "string" ? output.data : JSON.stringify(output.data);
        }
      }
    }
  }
  return null;
}

// 从消息历史中提取 planStrategy 返回的 recommendedAssets（awaiting_assets 状态用）
function extractRecommendedAssets(messages: UIMessage[]): { type: string; label: string; reason: string }[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-planStrategy" && p.output) {
        const output = p.output as { success?: boolean; data?: { recommendedAssets?: { type: string; label: string; reason: string }[] } };
        if (output.success && output.data?.recommendedAssets) {
          return output.data.recommendedAssets;
        }
      }
    }
  }
  return [];
}

// ========== 动态工具构建 ==========
//
// 旧方案：ALL_TOOLS 是静态常量，工具定义在模块加载时就确定了。
// 问题：planStrategy/generate*/reviseAsset 需要从消息历史提取上下文，
//       但静态工具拿不到每次请求的 messages。
//
// 新方案：buildTools(messages) 在每次请求时构建工具。
// 通过闭包把 messages 和提取的上下文注入到工具的 execute 函数中。
// analyzeProject 和前端工具不需要上下文，仍然是固定的。

function buildTools(messages: UIMessage[]) {
  // 提前从消息历史中提取所有上下文（避免每个工具重复提取）
  const understanding = extractProjectUnderstanding(messages);
  const scenario = extractScenario(messages);
  const strategy = extractStrategy(messages);

  // 关键调试：确认上下文提取是否成功
  console.log("[CONTEXT]", {
    understanding: understanding ? understanding.name : null,
    scenario,
    strategy: strategy ? strategy.scenarioLabel : null,
  });

  // DEBUG: 如果 scenario 为 null，打印所有 assistant parts 帮助定位
  if (!scenario) {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        const p = part as Record<string, unknown>;
        if (typeof p.type === "string" && p.type.includes("Choice")) {
          console.log("[DEBUG scenario extraction] found part:", JSON.stringify(p).slice(0, 300));
        }
      }
    }
  }

  return {
    // ===== analyzeProject：LLM 从用户输入提取参数（这是合理的） =====
    // 用户的 GitHub 链接/描述/文档在用户消息中，LLM 提取这些是它擅长的
    analyzeProject: tool({
      description: "分析用户提交的项目资料（GitHub 链接、文档、描述），生成结构化的项目理解",
      inputSchema: z.object({
        githubUrl: z.string().optional().describe("GitHub 仓库链接"),
        description: z.string().optional().describe("用户对项目的文字描述"),
        documents: z.array(z.string()).optional().describe("用户上传的文档内容"),
      }),
      execute: async ({ githubUrl, description, documents }) => {
        console.log("[DEBUG analyzeProject] input:", { githubUrl, description: description?.slice(0, 100), docCount: documents?.length });
        let githubData = undefined;
        if (githubUrl) {
          const parsed = parseGitHubUrl(githubUrl);
          if (!parsed) {
            return { error: "无法解析 GitHub 链接，请检查格式" };
          }
          try {
            githubData = await analyzeRepo(parsed.owner, parsed.repo);
            console.log("[DEBUG analyzeProject] github data fetched:", {
              owner: parsed.owner, repo: parsed.repo,
              hasReadme: !!githubData.readme,
              readmeLen: githubData.readme?.length,
              treeLen: githubData.directoryTree?.length,
            });
          } catch (err) {
            return { error: `获取 GitHub 仓库数据失败: ${err instanceof Error ? err.message : String(err)}` };
          }
        }
        try {
          const result = await analyzeProject({ githubData, description, documents });
          return {
            success: true,
            data: result,
            summary: {
              projectName: result.name,
              projectType: result.type,
              featureCount: result.coreFeatures.length,
              highlightCount: result.highlights.length,
              techStackCount: result.techStack.length,
            },
          };
        } catch (err) {
          return { error: `AI 分析失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    // ===== 前端工具（无 execute，由 UI 组件处理） =====
    askUserChoice: tool({
      description: "向用户展示选项并等待选择",
      inputSchema: z.object({
        question: z.string().describe("向用户展示的问题"),
        options: z.array(z.string()).describe("可选项列表"),
      }),
    }),

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

    // ===== planStrategy：inputSchema 为空，上下文由代码注入 =====
    // Bug 2 修复：旧方案要求 LLM 填 9 个字段（projectName, coreFeatures 等），
    // 弱模型经常漏填或幻觉。现在所有上下文通过闭包从消息历史提取。
    planStrategy: tool({
      description: "根据项目理解和展示场景，规划展示策略。直接调用即可，无需填写参数。",
      inputSchema: z.object({}),
      execute: async () => {
        if (!understanding) return { error: "未找到项目分析结果，请先分析项目" };
        if (!scenario) return { error: "未找到场景选择，请先选择展示场景" };
        try {
          const result = await planStrategy({
            scenario,
            projectUnderstanding: understanding,
          });
          return {
            success: true,
            data: result,
            summary: {
              scenarioLabel: result.scenarioLabel,
              assetCount: result.recommendedAssets.length,
              assetLabels: result.recommendedAssets.map((a) => a.label),
              totalDuration: result.totalDuration,
            },
          };
        } catch (err) {
          return { error: `策略规划失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    // ===== generateScript/PPT/OnePager：inputSchema 为空，上下文由代码注入 =====
    // Bug 2 修复：旧方案要求 LLM 填 13 个字段，现在全部自动提取
    generateScript: tool({
      description: "生成完整的演讲稿（Markdown 格式）。直接调用即可，无需填写参数。",
      inputSchema: z.object({}),
      execute: async () => {
        if (!understanding) return { error: "未找到项目分析结果" };
        if (!strategy) return { error: "未找到展示策略" };
        try {
          const script = await generateScript({
            projectUnderstanding: understanding,
            displayStrategy: strategy,
          });
          return {
            success: true,
            data: script,
            summary: { charCount: script.length, estimatedMinutes: Math.round(script.length / 250) },
          };
        } catch (err) {
          return { error: `讲稿生成失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    generatePPT: tool({
      description: "生成 PPT 大纲（每页标题、要点、布局）。直接调用即可，无需填写参数。",
      inputSchema: z.object({}),
      execute: async () => {
        if (!understanding) return { error: "未找到项目分析结果" };
        if (!strategy) return { error: "未找到展示策略" };
        try {
          const ppt = await generatePPT({
            projectUnderstanding: understanding,
            displayStrategy: strategy,
          });
          return {
            success: true,
            data: ppt,
            summary: { slideCount: ppt.totalSlides, title: ppt.title },
          };
        } catch (err) {
          return { error: `PPT 大纲生成失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    generateOnePager: tool({
      description: "生成项目一页纸（精炼的项目介绍）。直接调用即可，无需填写参数。",
      inputSchema: z.object({}),
      execute: async () => {
        if (!understanding) return { error: "未找到项目分析结果" };
        if (!strategy) return { error: "未找到展示策略" };
        try {
          const onepager = await generateOnePager({
            projectUnderstanding: understanding,
            displayStrategy: strategy,
          });
          return {
            success: true,
            data: onepager,
            summary: { projectName: onepager.projectName, tagline: onepager.tagline },
          };
        } catch (err) {
          return { error: `One-pager 生成失败: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    // ===== reviseAsset：删除 currentContent，由代码自动提取 =====
    // Bug 3 修复：旧方案要求 LLM 搬运几千字的资产全文，经常截断或修改。
    // 现在 LLM 只需指定 assetType 和修改指令，currentContent 由代码提取。
    reviseAsset: tool({
      description: "根据用户指令修改已生成的资产",
      inputSchema: z.object({
        assetType: z.enum(["script", "ppt", "onepager"]).describe("要修改的资产类型"),
        instructions: z.string().describe("用户的修改指令"),
      }),
      execute: async ({ assetType, instructions }) => {
        // 代码从消息历史中提取最新版本的资产内容
        const currentContent = extractLatestAsset(messages, assetType);
        if (!currentContent) return { error: `未找到 ${assetType} 的内容，请先生成该资产` };
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
}

// ========== 状态 → 工具集映射 ==========
//
// 这是状态机的核心控制点：每个状态只暴露特定的工具。
// LLM 看不到其他工具，所以不可能调用错误的工具。

// 资产类型 → 工具名的映射
const ASSET_TOOL_MAP: Record<string, string> = {
  script: "generateScript",
  ppt: "generatePPT",
  onepager: "generateOnePager",
};

function getToolsForState(
  state: string,
  allTools: ReturnType<typeof buildTools>,
  messages?: UIMessage[],
): ToolSet {
  switch (state) {
    case "analyzing":
      return { analyzeProject: allTools.analyzeProject };

    case "awaiting_scenario":
      return { askUserChoice: allTools.askUserChoice };

    case "planning":
      return { planStrategy: allTools.planStrategy };

    case "awaiting_assets":
      return { confirmAssets: allTools.confirmAssets };

    case "generating": {
      // 每次只暴露一个工具（下一个要生成的资产）
      // 配合 maxSteps=1，每次 POST 只生成一个资产
      // assistant-ui 的 sendAutomaticallyWhen 会自动触发下一次请求
      if (!messages) {
        return {
          generateScript: allTools.generateScript,
          generatePPT: allTools.generatePPT,
          generateOnePager: allTools.generateOnePager,
        };
      }
      const remaining = getRemainingAssets(messages);
      if (remaining.length === 0) return {};
      // 只暴露第一个待生成的资产对应的工具
      const nextAsset = remaining[0];
      const toolName = ASSET_TOOL_MAP[nextAsset];
      if (toolName && allTools[toolName as keyof typeof allTools]) {
        return { [toolName]: allTools[toolName as keyof typeof allTools] };
      }
      return {};
    }

    case "editing":
      return { reviseAsset: allTools.reviseAsset };

    default:
      return {};
  }
}

// ========== API 路由处理器 ==========

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Step 1: 推导状态
  const state = deriveState(messages);
  console.log("[STATE]", state);

  // ===== 固定参数的前端工具：跳过 LLM，代码直接发起工具调用 =====
  //
  // askUserChoice 和 confirmAssets 是前端工具（无 execute）。
  // 参数完全固定，不需要 LLM 参与。

  if (state === "awaiting_scenario") {
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

  // ===== planning：直接执行子 agent + 写入 confirmAssets，无需 LLM 中转 =====
  //
  // 旧方案：streamText → LLM 调 planStrategy → stopWhen(1) 结束 → 期望 sendAutomatically 触发下一 POST
  // 问题：streamText 返回的 server-side tool 响应，客户端 lastAssistantMessageIsCompleteWithToolCalls
  //       无法正确判定为 complete，sendAutomatically 不触发，流程卡死。
  //
  // 新方案：直接 createUIMessageStream，同一个 POST 内：
  //   1. 写 planStrategy tool-input → 执行子 agent → 写 tool-output（状态机检测完成）
  //   2. 接着写 confirmAssets tool-input（前端工具，requires-action，等用户选择）
  //   用户选完 → addResult → lastAssistantMessageIsCompleteWithToolCalls = true → generating POST
  if (state === "planning") {
    const understanding = extractProjectUnderstanding(messages);
    const scenario = extractScenario(messages);
    const planToolCallId = `call-plan-${Date.now()}`;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Step 1: 声明 planStrategy 工具调用
        writer.write({
          type: "tool-input-available",
          toolCallId: planToolCallId,
          toolName: "planStrategy",
          input: {},
        });

        if (!understanding || !scenario) {
          writer.write({
            type: "tool-output-available",
            toolCallId: planToolCallId,
            output: { error: "缺少项目理解或场景信息，请重新分析" },
          });
          return;
        }

        try {
          console.log("[planning] running planStrategy subagent...");
          const result = await planStrategy({ scenario, projectUnderstanding: understanding });
          console.log("[planning] planStrategy done, assets:", result.recommendedAssets.map((a) => a.label));

          // Step 2: 写入 planStrategy 结果（让状态机检测到 planStrategy 已完成）
          writer.write({
            type: "tool-output-available",
            toolCallId: planToolCallId,
            output: {
              success: true,
              data: result,
              summary: {
                scenarioLabel: result.scenarioLabel,
                assetCount: result.recommendedAssets.length,
                assetLabels: result.recommendedAssets.map((a) => a.label),
                totalDuration: result.totalDuration,
              },
            },
          });

          // Step 3: 写入 confirmAssets（前端工具，等待用户选择）
          writer.write({
            type: "tool-input-available",
            toolCallId: `call-assets-${Date.now()}`,
            toolName: "confirmAssets",
            input: { recommendedAssets: result.recommendedAssets },
          });
        } catch (err) {
          console.error("[planning] planStrategy failed:", err);
          writer.write({
            type: "tool-output-available",
            toolCallId: planToolCallId,
            output: { error: `策略规划失败: ${err instanceof Error ? err.message : String(err)}` },
          });
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // awaiting_assets 状态保留作为兜底（正常流程已在 planning 合并处理）
  if (state === "awaiting_assets") {
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
  }

  // ===== generating：直接执行子 agent，无需 LLM 中转 =====
  //
  // 与 planning 同理：streamText + relay API 下 LLM 不可靠地调用带 execute 的工具。
  // 每次 POST 只生成一个资产，写入 tool-input + tool-output，状态机检测后
  // sendAutomatically 触发下一个 POST 继续生成下一个资产。
  if (state === "generating") {
    const remaining = getRemainingAssets(messages);
    const understanding = extractProjectUnderstanding(messages);
    const strategy = extractStrategy(messages);
    const nextAsset = remaining[0];

    const TOOL_NAMES: Record<string, string> = {
      script: "generateScript",
      ppt: "generatePPT",
      onepager: "generateOnePager",
    };
    const toolName = TOOL_NAMES[nextAsset] || "generateScript";
    const toolCallId = `call-gen-${nextAsset}-${Date.now()}`;

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "tool-input-available", toolCallId, toolName, input: {} });

        if (!understanding || !strategy) {
          writer.write({ type: "tool-output-available", toolCallId, output: { error: "缺少项目理解或策略，请重新开始" } });
          return;
        }
        if (!nextAsset) {
          writer.write({ type: "tool-output-available", toolCallId, output: { error: "没有待生成的资产" } });
          return;
        }

        try {
          console.log(`[generating] generating ${nextAsset}...`);
          if (nextAsset === "script") {
            const script = await generateScript({ projectUnderstanding: understanding, displayStrategy: strategy });
            writer.write({ type: "tool-output-available", toolCallId, output: { success: true, data: script, summary: { charCount: script.length } } });
          } else if (nextAsset === "ppt") {
            const ppt = await generatePPT({ projectUnderstanding: understanding, displayStrategy: strategy });
            writer.write({ type: "tool-output-available", toolCallId, output: { success: true, data: ppt, summary: { slideCount: ppt.totalSlides, title: ppt.title } } });
          } else if (nextAsset === "onepager") {
            const onepager = await generateOnePager({ projectUnderstanding: understanding, displayStrategy: strategy });
            writer.write({ type: "tool-output-available", toolCallId, output: { success: true, data: onepager, summary: { projectName: onepager.projectName } } });
          }
          console.log(`[generating] ${nextAsset} done`);
        } catch (err) {
          console.error(`[generating] ${nextAsset} failed:`, err);
          writer.write({ type: "tool-output-available", toolCallId, output: { error: `${nextAsset} 生成失败: ${err instanceof Error ? err.message : String(err)}` } });
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  // ===== 需要 LLM 的状态：只剩 editing =====

  const allTools = buildTools(messages);
  const tools = getToolsForState(state, allTools, messages);
  const systemPrompt = STATE_PROMPTS[state];

  const modelMessages = await convertToModelMessages(messages);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(1),
      toolChoice: "auto",
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[ERROR] streamText failed:", err);
    throw err;
  }
}
