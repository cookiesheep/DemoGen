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

// ========== 展示场景枚举 ==========
export const scenarioEnum = z.enum([
  "course-defense",    // 课程答辩
  "job-interview",     // 面试展示
  "open-source-promo", // 开源推广
  "product-launch",    // 产品发布
  "team-report",       // 团队汇报
  "custom",            // 自定义
]);

export type Scenario = z.infer<typeof scenarioEnum>;

// ========== 展示策略 Schema — Strategy Subagent 的输出格式 ==========
export const displayStrategySchema = z.object({
  // 展示场景
  scenario: scenarioEnum.describe("选中的展示场景"),
  // 场景中文名称
  scenarioLabel: z.string().describe("场景的中文名称，如'课程答辩'"),
  // 观众画像（评委/面试官/社区开发者等）
  audienceProfile: z.string().describe("目标观众画像描述，1-2 句话"),
  // 推荐的资产组合
  recommendedAssets: z
    .array(
      z.object({
        type: z.enum(["script", "ppt", "onepager"]).describe("资产类型"),
        label: z.string().describe("资产中文名称"),
        reason: z.string().describe("为什么推荐这个资产，一句话"),
      })
    )
    .describe("推荐生成的资产列表"),
  // 展示重点方向
  emphasisPoints: z
    .array(z.string())
    .describe("展示时应该重点强调的方向，2-3 个"),
  // 预估展示结构
  estimatedStructure: z
    .array(
      z.object({
        section: z.string().describe("段落名称"),
        duration: z.string().describe("建议时长，如'2分钟'"),
        keyPoints: z.array(z.string()).describe("该段落的要点，1-3 个"),
      })
    )
    .describe("建议的展示结构和时间分配"),
  // 总时长建议
  totalDuration: z.string().describe("建议总时长，如'8-10分钟'"),
});

export type DisplayStrategy = z.infer<typeof displayStrategySchema>;

// ========== PPT 大纲 Schema — PPT Architect Subagent 的输出格式 ==========
export const pptOutlineSchema = z.object({
  // PPT 标题
  title: z.string().describe("PPT 的主标题"),
  // PPT 副标题
  subtitle: z.string().describe("副标题，通常是项目一句话介绍"),
  // 每一页的内容
  slides: z
    .array(
      z.object({
        // 页面标题
        title: z.string().describe("这一页的标题"),
        // 页面布局类型
        layout: z
          .enum(["title", "content", "two-column", "image-text", "bullets", "summary"])
          .describe("页面布局类型"),
        // 要点列表
        bullets: z.array(z.string()).describe("这一页的要点，每个 bullet 不超过 25 字"),
        // 演讲备注（给演讲者看的）
        speakerNotes: z.string().describe("演讲者备注，提示这页该说什么"),
      })
    )
    .describe("PPT 的所有页面"),
  // 总页数
  totalSlides: z.number().describe("PPT 总页数"),
});

export type PptOutline = z.infer<typeof pptOutlineSchema>;

// ========== One-pager Schema — One-pager Designer Subagent 的输出格式 ==========
export const onePagerSchema = z.object({
  // 项目名称
  projectName: z.string().describe("项目名称"),
  // 项目标语
  tagline: z.string().describe("一句话标语，简洁有力"),
  // 问题陈述
  problem: z.string().describe("解决什么问题，2-3 句话"),
  // 解决方案
  solution: z.string().describe("怎么解决的，2-3 句话"),
  // 核心功能（3 个）
  keyFeatures: z
    .array(
      z.object({
        title: z.string().describe("功能名称"),
        description: z.string().describe("功能描述，一句话"),
      })
    )
    .describe("核心功能列表，3 个"),
  // 技术架构概述
  techHighlight: z.string().describe("技术架构或亮点的一句话概述"),
  // 目标用户
  targetAudience: z.string().describe("目标用户一句话"),
  // 行动号召
  callToAction: z.string().describe("CTA 文案，如'立即体验'、'Star on GitHub'"),
});

export type OnePager = z.infer<typeof onePagerSchema>;
