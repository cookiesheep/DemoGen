// src/types/index.ts
// 全局类型定义 — 在多个组件和模块间共享的类型

import type { ProjectUnderstanding } from "@/lib/ai/schemas";

/**
 * DemoGen 应用全局状态
 * 用于在聊天面板和预览面板之间共享数据
 *
 * 这些状态由 AI 工具调用产生，通过 React Context 传递给预览面板
 */
export interface DemoGenState {
  // 项目理解卡片数据（AI 分析完仓库后填充）
  projectUnderstanding: ProjectUnderstanding | null;
  // 当前阶段标识
  phase: "idle" | "analyzing" | "understood" | "generating" | "done";
}

/**
 * 初始状态
 */
export const initialDemoGenState: DemoGenState = {
  projectUnderstanding: null,
  phase: "idle",
};
