// Analysis Subagent — 分析项目资料，生成结构化的项目理解
// 使用 generateObjectCompat 兼容不支持 json_schema 的中转 API
import { projectUnderstandingSchema, type ProjectUnderstanding } from "../schemas";
import { ANALYSIS_PROMPT } from "../prompts";
import { generateObjectCompat } from "../generate-object-compat";
import type { GitHubRepoData } from "../../github/analyzer";

// Subagent 输入：可以是 GitHub 数据、文档、描述的组合
interface AnalysisInput {
  githubData?: GitHubRepoData;
  documents?: string[];   // 用户上传的文档内容
  description?: string;   // 用户的文字描述
}

/**
 * 分析项目资料，返回结构化的项目理解
 */
export async function analyzeProject(
  input: AnalysisInput
): Promise<ProjectUnderstanding> {
  // 构建分析材料的文本
  const materialParts: string[] = [];

  if (input.githubData) {
    const gh = input.githubData;
    materialParts.push(`## GitHub 仓库信息
- 仓库：${gh.owner}/${gh.repo}
- 描述：${gh.description || "无"}
- Star 数：${gh.stars}
- 主语言：${gh.language || "未知"}
- 标签：${gh.topics.length > 0 ? gh.topics.join(", ") : "无"}

### README
${gh.readme ? gh.readme.slice(0, 5000) : "无 README"}

### 目录结构
${gh.directoryTree.slice(0, 100).join("\n")}

### package.json
${gh.packageJson ? JSON.stringify(gh.packageJson, null, 2).slice(0, 2000) : "无 package.json"}`);
  }

  if (input.documents && input.documents.length > 0) {
    materialParts.push(
      `## 用户上传的文档\n${input.documents.join("\n\n---\n\n").slice(0, 5000)}`
    );
  }

  if (input.description) {
    materialParts.push(`## 用户描述\n${input.description}`);
  }

  const material = materialParts.join("\n\n");

  return generateObjectCompat({
    system: ANALYSIS_PROMPT,
    prompt: `请分析以下项目资料，生成结构化的项目理解：\n\n${material}`,
    schema: projectUnderstandingSchema,
  });
}
