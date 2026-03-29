// 共享的 AI 模型实例 — 所有 subagent 和 orchestrator 复用同一份配置
// 注意：必须用 openai.chat() 而不是 openai()，后者会走 Responses API（DeepSeek 不支持）
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export const model = openai.chat(process.env.OPENAI_MODEL || "gpt-5.2");
