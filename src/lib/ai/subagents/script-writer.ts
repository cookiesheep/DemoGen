// Script Writer Subagent — 生成演讲稿
// 使用 streamText 流式输出，让用户实时看到生成过程
import { generateText } from "ai";
import { model } from "../client";
import { SCRIPT_PROMPT } from "../prompts";
import type { ProjectUnderstanding, DisplayStrategy } from "../schemas";

interface ScriptInput {
  projectUnderstanding: ProjectUnderstanding;
  displayStrategy: DisplayStrategy;
}

/**
 * 根据项目理解和展示策略，生成演讲稿（Markdown 格式）
 * 返回完整的讲稿文本
 */
export async function generateScript(
  input: ScriptInput
): Promise<string> {
  const prompt = `## 项目信息
- 项目名称：${input.projectUnderstanding.name}
- 项目类型：${input.projectUnderstanding.type}
- 一句话总结：${input.projectUnderstanding.summary}
- 目标用户：${input.projectUnderstanding.targetUsers}
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
  .map((s) => `### ${s.section}（${s.duration}）\n要点：${s.keyPoints.join("、")}`)
  .join("\n\n")}

请按照以上展示结构撰写完整的演讲稿。`;

  const result = await generateText({
    model,
    system: SCRIPT_PROMPT,
    prompt,
  });

  return result.text;
}
