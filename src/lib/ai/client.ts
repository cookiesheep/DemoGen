// 共享的 AI 模型实例 — 所有 subagent 和 orchestrator 复用同一份配置
//
// ===== 中转 API 兼容性修复 =====
//
// 问题链条：
//   1. @ai-sdk/openai provider 把 assistant 消息转为 OpenAI wire format
//   2. 只有 tool_calls 没有 text 的 assistant 消息 → content: null 或 ""
//   3. 中转 API (packyapi) 把 OpenAI 格式转发给 Claude API
//   4. Claude API 拒绝空 text content block → 400 错误
//
// 修复：在 HTTP 层面拦截请求，给只有 tool_calls 的 assistant 消息注入占位 content。
// 这是唯一可靠的修复点——比在 AI SDK model message 层面 patch 更可靠，
// 因为 provider 会覆盖我们的 patch。
//
// 注意：必须用 openai.chat() 而不是 openai()，后者会走 Responses API（中转 API 可能不支持）

import { createOpenAI } from "@ai-sdk/openai";

// 自定义 fetch：拦截发往 LLM API 的请求，修复 Claude 不兼容的消息格式
async function patchedFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      if (Array.isArray(body.messages)) {
        let patched = false;
        for (const msg of body.messages) {
          // 修复 1：assistant 消息有 tool_calls 但 content 为空
          // Claude API 要求 assistant 消息的 text content block 不能为空
          if (
            msg.role === "assistant" &&
            Array.isArray(msg.tool_calls) &&
            msg.tool_calls.length > 0 &&
            (!msg.content || (typeof msg.content === "string" && msg.content.trim() === ""))
          ) {
            msg.content = "调用工具。";
            patched = true;
          }

          // 修复 2：如果 content 是数组（Claude 原生格式），检查空 text block
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            msg.content = msg.content.filter(
              (block: Record<string, unknown>) =>
                !(block.type === "text" && (!block.text || String(block.text).trim() === ""))
            );
            // 如果过滤后只剩 tool_use blocks，加一个占位 text
            const hasText = msg.content.some(
              (block: Record<string, unknown>) => block.type === "text"
            );
            if (!hasText && msg.content.length > 0) {
              msg.content.unshift({ type: "text", text: "调用工具。" });
              patched = true;
            }
          }
        }
        if (patched) {
          console.log("[PATCH] Fixed empty assistant content in", body.messages.length, "messages");
          init = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch {
      // JSON 解析失败，直接透传（可能是非 JSON 请求）
    }
  }
  return globalThis.fetch(url, init);
}

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  fetch: patchedFetch as typeof globalThis.fetch,
});

export const model = openai.chat(process.env.OPENAI_MODEL || "gpt-5.2");
