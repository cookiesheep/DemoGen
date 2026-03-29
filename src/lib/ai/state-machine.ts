// 状态机模块 — 从消息历史推导 Agent 当前状态，返回该状态的工具集和 prompt
// 核心思想：代码控制流程，LLM 只负责生成内容
// 每次请求到达后端时，扫描消息历史中已完成的工具调用，推导出当前阶段
// 然后只给 LLM 该阶段允许的工具和一个极简 prompt
import type { UIMessage } from "ai";

// ========== 状态定义 ==========
export type AgentState =
  | "analyzing"         // 分析项目
  | "awaiting_scenario" // 等待用户选择场景
  | "planning"          // 生成展示策略
  | "awaiting_assets"   // 等待用户确认资产
  | "generating"        // 批量生成资产
  | "editing";          // 编辑和修改阶段

// 从消息历史中提取的上下文信息
export interface StateContext {
  state: AgentState;
  selectedAssets: string[];   // 用户选中的资产类型列表（如 ["script", "ppt"]）
  generatedAssets: Set<string>; // 已生成的资产类型集合
}

// ========== 状态推导 ==========
// 扫描所有消息中已完成的工具调用，根据完成情况推导当前状态

export function deriveState(messages: UIMessage[]): StateContext {
  const completed = new Set<string>();   // 已完成的工具名
  let selectedAssets: string[] = [];     // 用户选中的资产
  const generatedAssets = new Set<string>(); // 已生成的资产类型

  // 遍历所有消息，提取已完成的工具调用
  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      // UIMessage 的 part 类型是联合类型，工具调用的 part 有 toolInvocation 字段
      // 但实际传输时，part.type 可能是 "tool-invocation"，需要检查多种格式
      const p = part as Record<string, unknown>;

      // 检查 toolInvocation 格式（assistant-ui 传过来的格式）
      if (p.toolInvocation && typeof p.toolInvocation === "object") {
        const inv = p.toolInvocation as Record<string, unknown>;
        const toolName = inv.toolName as string;
        const state = inv.state as string;

        if (state === "result" || state === "output-available") {
          completed.add(toolName);

          // 从 confirmAssets 结果中提取用户选择的资产
          if (toolName === "confirmAssets" && inv.result) {
            const result = inv.result as { selectedAssets?: string[] };
            if (result.selectedAssets) {
              selectedAssets = result.selectedAssets;
            }
          }

          // 记录已生成的资产类型
          if (toolName === "generateScript") generatedAssets.add("script");
          if (toolName === "generatePPT") generatedAssets.add("ppt");
          if (toolName === "generateOnePager") generatedAssets.add("onepager");
        }
      }

      // 也检查 tool-result 格式（convertToModelMessages 转换后的格式可能不同）
      if (p.type === "tool-result" || (typeof p.type === "string" && (p.type as string).startsWith("tool-"))) {
        const toolName = (p.toolName as string) || (typeof p.type === "string" ? (p.type as string).replace("tool-", "") : "");
        if (toolName && (p.result !== undefined || p.output !== undefined)) {
          completed.add(toolName);

          if (toolName === "confirmAssets") {
            const result = (p.result || p.output) as { selectedAssets?: string[] };
            if (result?.selectedAssets) {
              selectedAssets = result.selectedAssets;
            }
          }
          if (toolName === "generateScript") generatedAssets.add("script");
          if (toolName === "generatePPT") generatedAssets.add("ppt");
          if (toolName === "generateOnePager") generatedAssets.add("onepager");
        }
      }
    }
  }

  // 根据已完成的工具调用推导状态
  if (!completed.has("analyzeProject")) {
    return { state: "analyzing", selectedAssets, generatedAssets };
  }
  if (!completed.has("askUserChoice")) {
    return { state: "awaiting_scenario", selectedAssets, generatedAssets };
  }
  if (!completed.has("planStrategy")) {
    return { state: "planning", selectedAssets, generatedAssets };
  }
  if (!completed.has("confirmAssets")) {
    return { state: "awaiting_assets", selectedAssets, generatedAssets };
  }

  // 检查是否所有选中的资产都已生成
  const allGenerated = selectedAssets.length > 0 &&
    selectedAssets.every((a) => generatedAssets.has(a));

  if (!allGenerated) {
    return { state: "generating", selectedAssets, generatedAssets };
  }

  return { state: "editing", selectedAssets, generatedAssets };
}

// ========== 状态专用 Prompt ==========
// 每个状态只有 1-3 句话的 prompt，LLM 不需要理解整个流程

const STATE_PROMPTS: Record<AgentState, string> = {
  analyzing: `你是 DemoGen Agent。立即调用 analyzeProject 工具分析用户提交的项目资料。
完成后只回复："已完成分析。"，不要输出其他内容。`,

  awaiting_scenario: `你是 DemoGen Agent。调用 askUserChoice 工具让用户选择展示场景。
question 设为 "请选择你的展示场景："，options 设为 ["课程答辩", "面试展示", "开源推广", "产品发布", "团队汇报"]。
不要输出其他内容，直接调用工具。`,

  planning: `你是 DemoGen Agent。立即调用 planStrategy 工具，根据项目理解和用户选择的场景生成展示策略。
从之前的 analyzeProject 结果中获取项目信息，从 askUserChoice 结果中获取场景选择。
完成后只回复："策略已生成。"，不要输出其他内容。`,

  awaiting_assets: `你是 DemoGen Agent。调用 confirmAssets 工具，把 planStrategy 返回结果中的 recommendedAssets 传给用户确认。
不要输出其他内容，直接调用工具。`,

  generating: `你是 DemoGen Agent。根据用户确认的资产列表，依次调用对应的生成工具。
不要输出任何文字，只调用工具。每个工具调用完毕后直接调用下一个。
全部完成后只回复："所有资产已生成，请在右侧查看和编辑。"`,

  editing: `你是 DemoGen Agent。用户已完成资产生成，现在处于编辑阶段。
当用户要求修改资产时，立即调用 reviseAsset 工具，从之前的工具调用历史中获取当前资产内容作为 currentContent。
修改完成后只回复："已修改，请查看右侧。"
不要自己输出任何资产内容。不要输出长文本。只回复 1 句话。
如果用户想重新开始，告诉他刷新页面即可。`,
};

export function getStatePrompt(state: AgentState): string {
  return STATE_PROMPTS[state];
}

// ========== 状态允许的工具名 ==========
// 每个状态只返回允许的工具名列表，route.ts 用它来过滤工具

const STATE_TOOLS: Record<AgentState, string[]> = {
  analyzing: ["analyzeProject"],
  awaiting_scenario: ["askUserChoice"],
  planning: ["planStrategy"],
  awaiting_assets: ["confirmAssets"],
  generating: ["generateScript", "generatePPT", "generateOnePager"],
  editing: ["reviseAsset"],
};

export function getStateToolNames(state: AgentState): string[] {
  return STATE_TOOLS[state];
}
