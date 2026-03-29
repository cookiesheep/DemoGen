// One-pager Designer Subagent — 生成项目一页纸
// 使用 generateObject + Zod schema 确保结构化输出
import { generateObject } from "ai";
import { model } from "../client";
import { onePagerSchema, type OnePager, type ProjectUnderstanding, type DisplayStrategy } from "../schemas";
import { ONEPAGER_PROMPT } from "../prompts";

interface OnePagerInput {
  projectUnderstanding: ProjectUnderstanding;
  displayStrategy: DisplayStrategy;
}

/**
 * 根据项目理解和展示策略，生成 One-pager
 */
export async function generateOnePager(
  input: OnePagerInput
): Promise<OnePager> {
  const prompt = `## 项目信息
- 项目名称：${input.projectUnderstanding.name}
- 一句话总结：${input.projectUnderstanding.summary}
- 目标用户：${input.projectUnderstanding.targetUsers}
- 核心功能：${input.projectUnderstanding.coreFeatures.join("、")}
- 技术亮点：${input.projectUnderstanding.highlights.join("、")}
- 技术栈：${input.projectUnderstanding.techStack.join("、")}

## 展示场景
- 场景：${input.displayStrategy.scenarioLabel}
- 观众画像：${input.displayStrategy.audienceProfile}

请生成项目一页纸。`;

  const result = await generateObject({
    model,
    system: ONEPAGER_PROMPT,
    prompt,
    schema: onePagerSchema,
  });

  return result.object;
}
