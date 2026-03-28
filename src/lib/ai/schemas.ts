// src/lib/ai/schemas.ts
// AI 结构化输出的 Zod Schema 定义
// 这些 schema 约束 AI 必须返回特定格式的 JSON，而不是自由文本
// 前端根据这些结构渲染对应的 UI 组件

import { z } from "zod";

/**
 * 项目类型枚举
 * AI 会将用户的项目归入这些类别之一
 * 不同类型对应不同的展示策略
 */
export const projectTypeEnum = z.enum([
  "web-app",          // Web 应用（React/Vue/Next.js 等）
  "api-service",      // API / 后端服务
  "cli-tool",         // 命令行工具
  "data-viz",         // 数据可视化工具
  "ai-service",       // AI 服务 / LLM 应用
  "agent-workflow",   // Agent / 工作流工具
  "library",          // 开源库 / SDK
  "algorithm",        // 算法 / 研究型项目
  "other",            // 其他
]);

/**
 * 项目理解卡片的 Schema
 * AI 分析完项目后输出的结构化理解结果
 * 对应右侧预览面板的"项目理解卡片"组件
 */
export const projectUnderstandingSchema = z.object({
  // 项目名称
  name: z.string().describe("项目名称"),
  // 一句话描述项目做了什么
  summary: z.string().describe("一句话总结项目的核心价值，不超过 50 字"),
  // 项目类型分类
  type: projectTypeEnum.describe("项目类型分类"),
  // 目标用户是谁
  targetUsers: z.string().describe("项目的目标用户群体，一句话"),
  // 核心功能列表（3-5 个）
  coreFeatures: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("核心功能，每条不超过 20 字"),
  // 最值得展示的亮点（2-3 个）
  highlights: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("最值得展示的技术亮点或差异化点"),
  // 技术栈
  techStack: z
    .array(z.string())
    .max(8)
    .describe("使用的主要技术栈"),
  // 风险和限制
  risks: z
    .array(z.string())
    .max(3)
    .describe("展示时可能遇到的风险或需要注意的限制"),
});

/**
 * 从 schema 推导 TypeScript 类型
 * 这样组件可以直接使用类型提示，不用手动定义 interface
 */
export type ProjectUnderstanding = z.infer<typeof projectUnderstandingSchema>;
export type ProjectType = z.infer<typeof projectTypeEnum>;

// ─── Step 3: 展示策略 ───

/**
 * 资产类型枚举
 * DemoGen 能生成的展示资产种类
 */
export const assetTypeEnum = z.enum([
  "speech-script",    // 讲稿
  "ppt-outline",      // PPT 大纲
  "one-pager",        // 一页式介绍
  "demo-video",       // Demo 录屏
  "readme-rewrite",   // README 改写
]);

/**
 * 展示策略卡片的 Schema
 * AI 了解用户展示场景后输出的结构化策略推荐
 * 对应右侧预览面板的"展示策略卡片"组件
 */
export const displayStrategySchema = z.object({
  // 展示场景
  scenario: z.string().describe("展示场景，如 课程答辩、面试、开源推广"),
  // 观众画像
  audienceProfile: z.string().describe("观众画像，一句话描述"),
  // 推荐生成的资产列表
  recommendedAssets: z
    .array(
      z.object({
        type: assetTypeEnum.describe("资产类型"),
        label: z.string().describe("中文名称，如 答辩讲稿"),
        reason: z.string().describe("推荐理由"),
      })
    )
    .min(1)
    .max(4)
    .describe("推荐的展示资产组合"),
  // 建议重点突出的方面
  emphasisPoints: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("建议重点突出的方面"),
  // 展示结构安排
  estimatedStructure: z
    .array(
      z.object({
        section: z.string().describe("章节名，如 项目动机"),
        duration: z.string().describe("建议时长，如 1-2 分钟"),
        notes: z.string().describe("简要说明"),
      })
    )
    .min(2)
    .max(6)
    .describe("建议的展示结构"),
  // 预计总时长
  totalDuration: z.string().describe("预计总时长，如 8-10 分钟"),
});

export type DisplayStrategy = z.infer<typeof displayStrategySchema>;
export type AssetType = z.infer<typeof assetTypeEnum>;
