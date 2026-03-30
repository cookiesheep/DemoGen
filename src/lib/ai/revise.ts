// 资产修改模块 — 根据用户指令修改已生成的资产
// 支持讲稿（Markdown）、PPT 大纲（JSON）、One-pager（JSON）
import { generateText } from "ai";
import { model } from "./client";
import { pptOutlineSchema, onePagerSchema, type PptOutline, type OnePager } from "./schemas";
import { generateObjectCompat } from "./generate-object-compat";

// 修改讲稿 — 接收当前讲稿 + 修改指令，返回修改后的完整讲稿
export async function reviseScript(
  currentContent: string,
  instructions: string
): Promise<string> {
  const result = await generateText({
    model,
    system: `你是一位演讲稿修改师。用户会给你一份已有的演讲稿和修改指令。
请根据指令修改讲稿，输出修改后的**完整讲稿**（Markdown 格式）。
只修改用户要求的部分，其余保持不变。不要添加解释或说明，直接输出讲稿。`,
    prompt: `## 当前讲稿

${currentContent}

## 修改指令

${instructions}

请输出修改后的完整讲稿：`,
  });
  return result.text;
}

// 修改 PPT 大纲 — 接收当前大纲 + 修改指令，返回修改后的完整大纲
export async function revisePpt(
  currentData: PptOutline,
  instructions: string
): Promise<PptOutline> {
  return generateObjectCompat({
    system: `你是一位 PPT 架构师。用户会给你一份已有的 PPT 大纲和修改指令。
请根据指令修改大纲，输出修改后的**完整大纲**。
只修改用户要求的部分，其余保持不变。`,
    prompt: `## 当前 PPT 大纲

${JSON.stringify(currentData, null, 2)}

## 修改指令

${instructions}

请输出修改后的完整 PPT 大纲：`,
    schema: pptOutlineSchema,
  });
}

// 修改 One-pager — 接收当前内容 + 修改指令，返回修改后的完整内容
export async function reviseOnePager(
  currentData: OnePager,
  instructions: string
): Promise<OnePager> {
  return generateObjectCompat({
    system: `你是一位产品 One-pager 设计师。用户会给你一份已有的项目一页纸和修改指令。
请根据指令修改内容，输出修改后的**完整一页纸**。
只修改用户要求的部分，其余保持不变。`,
    prompt: `## 当前一页纸

${JSON.stringify(currentData, null, 2)}

## 修改指令

${instructions}

请输出修改后的完整一页纸：`,
    schema: onePagerSchema,
  });
}
