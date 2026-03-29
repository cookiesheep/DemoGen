// Strategy Subagent — 根据项目理解和展示场景，生成展示策略
// 使用 generateObject + Zod schema 确保输出格式正确
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  displayStrategySchema,
  type DisplayStrategy,
  type ProjectUnderstanding,
  type Scenario,
} from "../schemas";
import { STRATEGY_PROMPT } from "../prompts";

// 创建模型实例
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = openai.chat(process.env.OPENAI_MODEL || "gpt-5.2");

// 场景中文名映射
const SCENARIO_LABELS: Record<string, Scenario> = {
  "课程答辩": "course-defense",
  "面试展示": "job-interview",
  "开源推广": "open-source-promo",
  "产品发布": "product-launch",
  "团队汇报": "team-report",
};

interface StrategyInput {
  projectUnderstanding: ProjectUnderstanding;
  scenario: string; // 用户选择的场景（中文或英文）
}

/**
 * 根据项目理解和展示场景，生成展示策略
 */
export async function planStrategy(
  input: StrategyInput
): Promise<DisplayStrategy> {
  // 将中文场景名转为 enum 值
  const scenarioKey =
    SCENARIO_LABELS[input.scenario] || (input.scenario as Scenario) || "custom";

  const prompt = `## 项目信息
- 项目名称：${input.projectUnderstanding.name}
- 项目类型：${input.projectUnderstanding.type}
- 一句话总结：${input.projectUnderstanding.summary}
- 目标用户：${input.projectUnderstanding.targetUsers}
- 核心功能：${input.projectUnderstanding.coreFeatures.join("、")}
- 技术亮点：${input.projectUnderstanding.highlights.join("、")}
- 技术栈：${input.projectUnderstanding.techStack.join("、")}
- 风险提醒：${input.projectUnderstanding.risks.join("、")}

## 展示场景
${input.scenario}（场景代码：${scenarioKey}）

请根据以上信息，规划展示策略。`;

  const result = await generateObject({
    model,
    system: STRATEGY_PROMPT,
    prompt,
    schema: displayStrategySchema,
  });

  return result.object;
}
