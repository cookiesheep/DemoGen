// AI 结构化输出的 Zod Schema 定义
// 所有 subagent 的输出格式都在这里定义，确保类型安全
import { z } from "zod";

// 项目类型枚举 — Agent 识别出的项目分类
export const projectTypeEnum = z.enum([
  "web-app",        // Web 应用（前端/全栈）
  "api-service",    // API 服务/后端
  "cli-tool",       // 命令行工具
  "data-viz",       // 数据可视化
  "ai-service",     // AI/ML 服务
  "agent-workflow",  // Agent 工作流
  "library",        // 库/框架
  "algorithm",      // 算法/数据结构
  "mobile-app",     // 移动端应用
  "other",          // 其他
]);

// 项目理解 Schema — Analysis Subagent 的输出格式
export const projectUnderstandingSchema = z.object({
  // 项目名称
  name: z.string().describe("项目名称"),
  // 一句话总结（不超过 50 字）
  summary: z.string().describe("一句话总结项目，不超过 50 字"),
  // 项目类型
  type: projectTypeEnum.describe("项目类型分类"),
  // 目标用户群体
  targetUsers: z.string().describe("目标用户群体描述，一句话"),
  // 核心功能列表（3-5 个）
  coreFeatures: z
    .array(z.string())
    .describe("核心功能列表，3-5 个，每个不超过 20 字"),
  // 技术亮点（让评委/观众印象深刻的点）
  highlights: z
    .array(z.string())
    .describe("技术亮点或创新点，2-3 个"),
  // 技术栈
  techStack: z
    .array(z.string())
    .describe("主要技术栈列表"),
  // 潜在风险/薄弱点（帮用户提前准备应对）
  risks: z
    .array(z.string())
    .describe("潜在的展示风险或薄弱点，1-2 个"),
});

// 从 Schema 推导 TypeScript 类型
export type ProjectUnderstanding = z.infer<typeof projectUnderstandingSchema>;
export type ProjectType = z.infer<typeof projectTypeEnum>;
