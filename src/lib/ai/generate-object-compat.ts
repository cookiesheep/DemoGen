// generateObject 兼容层 — 解决中转 API 不支持 json_schema response_format 的问题
//
// 问题：AI SDK 的 generateObject 依赖 response_format: { type: "json_schema" }
// 让 API 强制返回 JSON。但很多中转 API（如 packyapi）不支持这个参数，
// 模型会忽略 JSON 约束，返回 Markdown 格式的文本。
//
// 解决：用 generateText 替代 generateObject，在 prompt 里明确要求输出 JSON，
// 然后手动从响应中提取 JSON 并用 Zod schema 验证。
//
// 额外处理：LLM 经常用 snake_case 而不是 camelCase，加了自动转换兜底。

import { generateText } from "ai";
import { model } from "./client";
import type { ZodType } from "zod";

// 从 Zod schema 中提取字段名列表，用于在 prompt 中告诉 LLM 精确的字段名
function getSchemaKeys(schema: ZodType<unknown>): string[] {
  try {
    const s = schema as unknown as Record<string, unknown>;
    // Zod v4 的内部结构
    const def = s._zod_def as Record<string, unknown> | undefined;
    if (def && typeof def === "object" && def.shape) {
      return Object.keys(def.shape as Record<string, unknown>);
    }
    // fallback: 尝试 .shape 直接访问
    if (s.shape && typeof s.shape === "object") {
      return Object.keys(s.shape as Record<string, unknown>);
    }
  } catch {
    // ignore
  }
  return [];
}

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

// snake_case → camelCase 转换
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// 递归转换对象的所有 key 从 snake_case 到 camelCase
function convertKeysToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamel);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = convertKeysToCamel(value);
    }
    return result;
  }
  return obj;
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
  // 尝试从 schema 提取字段名，告诉 LLM 精确的 key
  const keys = getSchemaKeys(schema as ZodType<unknown>);
  const keysHint = keys.length > 0
    ? `\nJSON 字段名必须严格使用以下 camelCase 格式（不要用 snake_case）：\n${keys.map(k => `  "${k}"`).join("\n")}`
    : "";

  // 在 system prompt 末尾追加 JSON 格式要求
  const jsonSystem = `${system}

【输出格式要求】
你必须以纯 JSON 格式输出，不要包含任何 Markdown 标记、表格、标题或解释文字。
直接输出一个 JSON 对象，不要用 \`\`\`json 包裹。${keysHint}`;

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

  // 先尝试直接用 schema 验证
  const directResult = schema.safeParse(parsed);
  if (directResult.success) {
    return directResult.data;
  }

  // 直接验证失败，尝试 snake_case → camelCase 转换后再验证
  console.log("[DEBUG generateObjectCompat] direct parse failed, trying snake_case -> camelCase conversion");
  const converted = convertKeysToCamel(parsed);
  const convertedResult = schema.safeParse(converted);
  if (convertedResult.success) {
    return convertedResult.data;
  }

  // 两次都失败，抛出详细错误
  console.error("[DEBUG generateObjectCompat] validation failed after conversion:", JSON.stringify(convertedResult.error.issues, null, 2));
  throw new Error(JSON.stringify(convertedResult.error.issues, null, 2));
}
