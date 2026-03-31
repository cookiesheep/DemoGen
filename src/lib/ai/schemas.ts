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

// 资产类型值 → 标准 enum 值
const ASSET_TYPE_MAP: Record<string, string> = {
  "script": "script", "讲稿": "script", "演讲稿": "script",
  "ppt": "ppt", "PPT": "ppt", "PPT大纲": "ppt", "ppt大纲": "ppt", "幻灯片": "ppt",
  "onepager": "onepager", "一页纸": "onepager", "one-pager": "onepager", "onePager": "onepager",
};

// 资产类型 → 中文 label
const ASSET_LABEL_MAP: Record<string, string> = {
  script: "演讲稿",
  ppt: "PPT大纲",
  onepager: "一页纸",
};

function normalizeAssetType(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return ASSET_TYPE_MAP[v] ?? v.toLowerCase();
}

// 单个 recommendedAsset item 的字段规范化：
//   - 模型可能用 assetType 代替 type
//   - 模型可能没有 label 字段（从 type 推导）
//   - 过滤掉非 script/ppt/onepager 的 item（如"演示环境/录屏"）
function normalizeAssetItem(v: unknown): unknown {
  if (typeof v !== "object" || v === null) return v;
  const obj = v as Record<string, unknown>;
  // 字段重映射：assetType → type
  if (!obj.type && obj.assetType) {
    obj.type = obj.assetType;
  }
  // 归一化 type 值
  if (typeof obj.type === "string") {
    obj.type = ASSET_TYPE_MAP[obj.type] ?? obj.type.toLowerCase();
  }
  // 补全 label：如果没有则从标准 type 推导
  if (!obj.label && typeof obj.type === "string" && ASSET_LABEL_MAP[obj.type]) {
    obj.label = ASSET_LABEL_MAP[obj.type];
  }
  return obj;
}

// ========== 展示策略 Schema — Strategy Subagent 的输出格式 ==========
export const displayStrategySchema = z.object({
  // 展示场景 — 用 catch 兜底，避免模型返回中文场景名时整个 schema 失败
  scenario: scenarioEnum.catch("custom").describe("选中的展示场景"),
  // 场景中文名称
  scenarioLabel: z.string().catch("").describe("场景的中文名称，如'课程答辩'"),
  // 观众画像
  audienceProfile: z.string().catch("").describe("目标观众画像描述，1-2 句话"),
  // 推荐的资产组合
  // 修复：type 字段用 preprocess 归一化中文/别名 → enum；其余字段加 catch 防止截断
  recommendedAssets: z
    .array(
      z.preprocess(
        normalizeAssetItem,
        z.object({
          // 只接受标准 enum 值；归一化后若仍不合法则整个 item 会被 catch 过滤
          type: z.enum(["script", "ppt", "onepager"]),
          label: z.string().catch(""),
          reason: z.string().catch(""),
        }).catch(null as unknown as { type: "script"; label: ""; reason: "" })
      )
    )
    .catch([])
    // 过滤掉 catch 产生的 null（非法 type，如"演示环境/录屏"）
    .transform((items) => items.filter((i): i is { type: "script" | "ppt" | "onepager"; label: string; reason: string } => i !== null && !!i.type))
    .describe("推荐生成的资产列表"),
  // 展示重点方向
  emphasisPoints: z.array(z.string().catch("")).catch([])
    .describe("展示时应该重点强调的方向，2-3 个"),
  // 预估展示结构
  // 修复：模型有时生成超额 item 且末尾字段缺失；各字段加 catch，过滤掉空 item
  estimatedStructure: z
    .array(
      z.object({
        section: z.string().catch("").describe("段落名称"),
        duration: z.string().catch("").describe("建议时长，如'2分钟'"),
        keyPoints: z.array(z.string().catch("")).catch([]).describe("该段落的要点，1-3 个"),
      }).catch({ section: "", duration: "", keyPoints: [] })
    )
    .transform((items) => items.filter((i) => i.section && i.duration))
    .describe("建议的展示结构和时间分配"),
  // 总时长建议
  totalDuration: z.string().catch("").describe("建议总时长，如'8-10分钟'"),
});

export type DisplayStrategy = z.infer<typeof displayStrategySchema>;

// ========== PPT 大纲 Schema — PPT Architect Subagent 的输出格式 ==========
export const pptOutlineSchema = z.object({
  title: z.string().catch("").describe("PPT 的主标题"),
  subtitle: z.string().catch("").describe("副标题，通常是项目一句话介绍"),
  slides: z
    .array(
      z.object({
        title: z.string().catch("").describe("这一页的标题"),
        // 修复：模型可能输出非标准 layout 值
        layout: z
          .enum(["title", "content", "two-column", "image-text", "bullets", "summary"])
          .catch("content")
          .describe("页面布局类型"),
        bullets: z.array(z.string().catch("")).catch([]).describe("这一页的要点"),
        speakerNotes: z.string().catch("").describe("演讲者备注"),
      }).catch({ title: "", layout: "content" as const, bullets: [], speakerNotes: "" })
    )
    .transform((slides) => slides.filter((s) => s.title))
    .describe("PPT 的所有页面"),
  // totalSlides 以实际 slides 数量为准，防止模型填错
  totalSlides: z.number().catch(0),
}).transform((obj) => ({ ...obj, totalSlides: obj.slides.length }));

export type PptOutline = z.infer<typeof pptOutlineSchema>;

// ========== One-pager Schema — One-pager Designer Subagent 的输出格式 ==========
export const onePagerSchema = z.object({
  projectName: z.string().catch("").describe("项目名称"),
  tagline: z.string().catch("").describe("一句话标语，简洁有力"),
  problem: z.string().catch("").describe("解决什么问题，2-3 句话"),
  solution: z.string().catch("").describe("怎么解决的，2-3 句话"),
  keyFeatures: z
    .array(
      z.object({
        title: z.string().catch("").describe("功能名称"),
        description: z.string().catch("").describe("功能描述，一句话"),
      }).catch({ title: "", description: "" })
    )
    .transform((items) => items.filter((i) => i.title))
    .describe("核心功能列表，3 个"),
  techHighlight: z.string().catch("").describe("技术架构或亮点的一句话概述"),
  targetAudience: z.string().catch("").describe("目标用户一句话"),
  callToAction: z.string().catch("").describe("CTA 文案，如'立即体验'、'Star on GitHub'"),
});

export type OnePager = z.infer<typeof onePagerSchema>;
