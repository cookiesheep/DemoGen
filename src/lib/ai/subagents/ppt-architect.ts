// PPT Architect Subagent — 生成 PPT 大纲
// 使用 generateObjectCompat 兼容不支持 json_schema 的中转 API
import { pptOutlineSchema, type PptOutline, type ProjectUnderstanding, type DisplayStrategy } from "../schemas";
import { PPT_PROMPT } from "../prompts";
import { generateObjectCompat } from "../generate-object-compat";

interface PptInput {
  projectUnderstanding: ProjectUnderstanding;
  displayStrategy: DisplayStrategy;
}

/**
 * 根据项目理解和展示策略，生成 PPT 大纲
 */
export async function generatePPT(
  input: PptInput
): Promise<PptOutline> {
  const prompt = `## 项目信息
- 项目名称：${input.projectUnderstanding.name}
- 一句话总结：${input.projectUnderstanding.summary}
- 核心功能：${input.projectUnderstanding.coreFeatures.join("、")}
- 技术亮点：${input.projectUnderstanding.highlights.join("、")}
- 技术栈：${input.projectUnderstanding.techStack.join("、")}

## 展示策略
- 场景：${input.displayStrategy.scenarioLabel}
- 观众画像：${input.displayStrategy.audienceProfile}
- 总时长：${input.displayStrategy.totalDuration}
- 重点方向：${input.displayStrategy.emphasisPoints.join("、")}

## 展示结构
${input.displayStrategy.estimatedStructure
  .map((s) => `- ${s.section}（${s.duration}）：${s.keyPoints.join("、")}`)
  .join("\n")}

请设计 PPT 大纲。`;

  return generateObjectCompat({
    system: PPT_PROMPT,
    prompt,
    schema: pptOutlineSchema,
  });
}
