// generateObject 兼容层 — 解决中转 API 不支持 json_schema response_format 的问题
//
// 问题：AI SDK 的 generateObject 依赖 response_format: { type: "json_schema" }
// 让 API 强制返回 JSON。但很多中转 API（如 packyapi）不支持这个参数，
// 模型会忽略 JSON 约束，返回 Markdown 格式的文本。
//
// 解决：用 generateText 替代 generateObject，在 prompt 里明确要求输出 JSON，
// 然后手动从响应中提取 JSON 并用 Zod schema 验证。
//
// 所有 subagent 和 revise 函数都应该用这个函数替代 generateObject。

import { generateText } from "ai";
import { model } from "./client";
import type { ZodType } from "zod";

// 从 LLM 响应文本中提取 JSON（可能被包裹在 ```json ... ``` 中）
function extractJson(text: string): string {
  // 先尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 再尝试找第一个 { 到最后一个 } 之间的内容
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  // 都找不到，返回原文（让 JSON.parse 报错）
  return text;
}

/**
 * 用 generateText + 手动 JSON 解析替代 generateObject
 * 兼容不支持 json_schema 的中转 API
 */
export async function generateObjectCompat<T>({
  system,
  prompt,
  schema,
}: {
  system: string;
  prompt: string;
  schema: ZodType<T>;
}): Promise<T> {
  // 在 system prompt 末尾追加 JSON 格式要求
  const jsonSystem = `${system}

【输出格式要求】
你必须以纯 JSON 格式输出，不要包含任何 Markdown 标记、表格、标题或解释文字。
直接输出一个 JSON 对象，不要用 \`\`\`json 包裹。`;

  const result = await generateText({
    model,
    system: jsonSystem,
    prompt,
  });

  const rawText = result.text;
  console.log("[DEBUG generateObjectCompat] raw text length:", rawText.length);
  console.log("[DEBUG generateObjectCompat] raw text preview:", rawText.slice(0, 200));

  // 从响应中提取 JSON
  const jsonStr = extractJson(rawText);

  // 解析 JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error("[DEBUG generateObjectCompat] JSON parse failed, raw:", jsonStr.slice(0, 500));
    throw new Error(`LLM 返回的内容无法解析为 JSON: ${(parseErr as Error).message}`);
  }

  // 用 Zod schema 验证并返回
  const validated = schema.parse(parsed);
  return validated;
}
