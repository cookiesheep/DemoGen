// 状态机模块 — DemoGen Agent 的流程控制核心
//
// ===== 设计原理 =====
//
// 传统 Agent 架构让 LLM 自己决定"下一步做什么"（给它所有工具 + 一个大 prompt）。
// 这依赖 LLM 的 prompt 遵从性，弱模型（如 DeepSeek）经常失控。
//
// 状态机架构反过来：**代码**决定流程，LLM 只负责**生成内容**。
// 具体做法：
//   1. 每次 API 请求到达时，从消息历史中推导"当前状态"
//   2. 根据状态，只给 LLM 该状态下允许的工具
//   3. 给 LLM 一个极简的状态专用 prompt（1-2 句话）
//
// 这样 LLM 无法"走偏"——因为错误的工具根本不存在于当前调用中。
//
// ===== 状态流转 =====
//
// ANALYZING → AWAITING_SCENARIO → PLANNING → AWAITING_ASSETS → GENERATING → EDITING
//
// 每个状态的进入条件是"上一步的工具已完成"。
// 推导逻辑是纯函数：输入是消息历史，输出是状态枚举。
// 后端无需存储状态——每次从消息历史重新推导。

import type { UIMessage } from "ai";

// ========== 状态枚举 ==========
// 每个状态代表 Agent 流程中的一个步骤
export type AgentState =
  | "analyzing"         // 正在分析项目（需要调用 analyzeProject）
  | "awaiting_scenario" // 等待用户选择展示场景（需要调用 askUserChoice）
  | "planning"          // 正在规划展示策略（需要调用 planStrategy）
  | "awaiting_assets"   // 等待用户确认要生成的资产（需要调用 confirmAssets）
  | "generating"        // 正在生成资产（需要调用 generateScript/PPT/OnePager）
  | "editing";          // 所有资产已生成，用户可以修改（需要调用 reviseAsset）

// ========== 从消息历史中提取已完成的工具调用 ==========
//
// 原理：assistant-ui 每次发送请求时，会把完整的消息历史传给后端。
// 消息中的 assistant 消息包含 parts 数组，其中工具调用的 part 格式为：
//   { type: "tool-invocation", toolInvocation: { toolName, state, result } }
//
// 当 state === "result" 时，表示工具已执行完成。
// 我们遍历所有消息，收集已完成的工具名和它们的返回值。

interface CompletedToolCall {
  toolName: string;
  result: Record<string, unknown>;
}

function extractCompletedToolCalls(messages: UIMessage[]): CompletedToolCall[] {
  const completed: CompletedToolCall[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const part of message.parts) {
      // AI SDK v6 + assistant-ui 的 UIMessage part 格式：
      //   type: "tool-{toolName}"  (如 "tool-analyzeProject")
      //   state: "output-available" (已完成) / "call" (调用中)
      //   output: { ... }  (工具返回值)
      //
      // 注意：不是 "tool-invocation" + 嵌套的 toolInvocation 对象！
      // type 本身包含工具名，字段直接在 part 上。
      const partType = part.type as string;
      if (partType.startsWith("tool-")) {
        const p = part as Record<string, unknown>;
        // 检查工具是否已完成（有 output 字段）
        if (p.output !== undefined && p.output !== null) {
          const toolName = partType.replace("tool-", "");
          completed.push({
            toolName,
            result: p.output as Record<string, unknown>,
          });
        }
      }
    }
  }

  return completed;
}

// ========== 从已完成的工具中提取业务数据 ==========
// 用于在 generating 状态判断哪些资产已经生成了

// 获取用户在 confirmAssets 中选择的资产类型列表
function getSelectedAssets(completedCalls: CompletedToolCall[]): string[] {
  // 找到最后一次 confirmAssets 的结果
  const confirmCall = [...completedCalls]
    .reverse()
    .find((c) => c.toolName === "confirmAssets");

  if (!confirmCall) return [];
  const result = confirmCall.result as { selectedAssets?: string[] };
  return result.selectedAssets || [];
}

// 获取已经生成的资产类型集合
function getGeneratedAssets(completedCalls: CompletedToolCall[]): Set<string> {
  const generated = new Set<string>();
  for (const call of completedCalls) {
    if (call.toolName === "generateScript") generated.add("script");
    if (call.toolName === "generatePPT") generated.add("ppt");
    if (call.toolName === "generateOnePager") generated.add("onepager");
  }
  return generated;
}

// ========== 核心函数：推导当前状态 ==========
//
// 原理：这是一个纯函数——给定消息历史，确定性地返回状态。
// 从"已完成的工具列表"逐步检查每个里程碑是否达成：
//   有 analyzeProject 完成？→ 分析阶段结束
//   有 askUserChoice 完成？→ 场景选择阶段结束
//   有 planStrategy 完成？→ 策略阶段结束
//   有 confirmAssets 完成？→ 资产确认阶段结束
//   所有选中的资产都生成了？→ 生成阶段结束
//
// 如果某个里程碑未达成，就停在对应状态。

export function deriveState(messages: UIMessage[]): AgentState {
  const completedCalls = extractCompletedToolCalls(messages);

  // 用 Set 快速查找某个工具是否已完成
  const completedToolNames = new Set(completedCalls.map((c) => c.toolName));

  // 逐步检查里程碑
  if (!completedToolNames.has("analyzeProject")) {
    return "analyzing";
  }

  if (!completedToolNames.has("askUserChoice")) {
    return "awaiting_scenario";
  }

  if (!completedToolNames.has("planStrategy")) {
    return "planning";
  }

  if (!completedToolNames.has("confirmAssets")) {
    return "awaiting_assets";
  }

  // 检查资产生成进度
  const selectedAssets = getSelectedAssets(completedCalls);
  const generatedAssets = getGeneratedAssets(completedCalls);
  const allGenerated = selectedAssets.length > 0 &&
    selectedAssets.every((asset) => generatedAssets.has(asset));

  if (!allGenerated) {
    return "generating";
  }

  // 所有资产已生成，进入编辑模式
  return "editing";
}

// ========== 获取 generating 状态下还需要生成的资产 ==========
// 用于告诉 LLM "你还需要生成哪些资产"

export function getRemainingAssets(messages: UIMessage[]): string[] {
  const completedCalls = extractCompletedToolCalls(messages);
  const selectedAssets = getSelectedAssets(completedCalls);
  const generatedAssets = getGeneratedAssets(completedCalls);
  return selectedAssets.filter((asset) => !generatedAssets.has(asset));
}
