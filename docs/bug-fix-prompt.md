# DemoGen Bug 修复 + 产品方向升级提示词

## 你的身份

你是负责 DemoGen 项目代码开发的 AI 工程师。项目目录在当前工作区。
请先阅读 CLAUDE.md 了解项目架构，然后按以下两个阶段执行任务。

---

## 阶段一：修复 3 个已知 Bug（优先级最高）

当前状态机架构有 3 个 bug 导致 agent 行为不准确。请按顺序修复。

### Bug 1：editing 状态的 toolChoice 强制调用工具

**问题位置**：`src/app/api/agent/route.ts`，约第 448 行

**现象**：所有状态统一用 `toolChoice: "required"`，导致 editing 状态下用户说"谢谢""不错"等闲聊时，LLM 被强制调用 `reviseAsset`，乱填参数导致资产被意外修改。

**修复**：

```typescript
// 修改前（有 bug）
toolChoice: "required",

// 修改后
toolChoice: state === "editing" ? "auto" : "required",
```

editing 状态用 `"auto"` 让 LLM 自己判断是否需要调用工具。其他状态保持 `"required"`。

**验证**：`npm run build` 通过 → 进入 editing 状态后发送"谢谢" → AI 应该正常回复文字而不是调用 reviseAsset。

---

### Bug 2：planning/generating 工具要求 LLM 从历史提取大量参数

**问题位置**：`src/app/api/agent/route.ts`，planStrategy（约第 92-129 行）、generateScript/generatePPT/generateOnePager 的 inputSchema

**现象**：planStrategy 的 inputSchema 有 9 个字段（projectName, projectSummary, projectType, targetUsers, coreFeatures, highlights, techStack, risks, scenario），全部要求 LLM 从对话历史中自行提取。弱模型（DeepSeek）经常漏字段、填错、幻觉。generateScript/generatePPT/generateOnePager 同样有 13 个字段需要 LLM 提取。

**修复思路**：

1. 新增辅助函数，从消息历史中提取前面工具的结构化结果：

```typescript
// 从消息历史中提取 analyzeProject 工具的输出结果
function extractProjectUnderstanding(messages: UIMessage[]): ProjectUnderstanding | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-analyzeProject" && p.output) {
        const output = p.output as { success?: boolean; data?: ProjectUnderstanding };
        if (output.success && output.data) return output.data;
      }
    }
  }
  return null;
}

// 从消息历史中提取用户选择的场景
function extractScenario(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-askUserChoice" && p.output) {
        const output = p.output as { selectedOption?: string };
        if (output.selectedOption) return output.selectedOption;
      }
    }
  }
  return null;
}

// 从消息历史中提取 planStrategy 的输出结果
function extractStrategy(messages: UIMessage[]): DisplayStrategy | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (p.type === "tool-planStrategy" && p.output) {
        const output = p.output as { success?: boolean; data?: DisplayStrategy };
        if (output.success && output.data) return output.data;
      }
    }
  }
  return null;
}
```

2. 修改 planStrategy 工具：简化 inputSchema，execute 内部使用辅助函数提取上下文：

```typescript
planStrategy: tool({
  description: "根据项目理解和展示场景，规划展示策略",
  inputSchema: z.object({
    // 只保留 LLM 真正需要"判断"的参数
    scenario: z.string().describe("用户选择的展示场景"),
  }),
  execute: async ({ scenario }, { messages }) => {
    // 代码提取上下文，不靠 LLM
    const understanding = extractProjectUnderstanding(messages);
    if (!understanding) return { error: "未找到项目分析结果" };

    const strategy = await planStrategy({
      scenario,
      projectUnderstanding: understanding,
    });
    return { success: true, data: strategy, ... };
  },
}),
```

**注意**：AI SDK v6 的 tool execute 函数的第二个参数可能不直接包含 messages。如果不行，需要改为在 POST handler 里提前提取，然后通过闭包传入。具体做法：

```typescript
// 在 POST handler 里
const understanding = extractProjectUnderstanding(messages);
const scenario = extractScenario(messages);
const strategy = extractStrategy(messages);

// 然后在 getToolsForState 里根据状态动态创建工具，通过闭包传入上下文
```

3. 同样修改 generateScript/generatePPT/generateOnePager：简化 inputSchema 为空或极少参数，execute 内部用代码提取所有上下文。

**验证**：`npm run build` 通过 → 完整流程走一遍 → 检查 planStrategy 和 generate* 是否正确拿到上下文。

---

### Bug 3：reviseAsset 的 currentContent 由 LLM 搬运

**问题位置**：`src/app/api/agent/route.ts`，reviseAsset 工具（约第 252-280 行）

**现象**：reviseAsset 的 inputSchema 包含 `currentContent: z.string()`，要求 LLM 把资产全文（可能几千字）从消息历史中提取出来传给工具。LLM 经常截断或修改内容。

**修复**：

1. 从 inputSchema 中删除 `currentContent`
2. 在 execute 函数内部，用辅助函数从消息历史中提取最新版本的资产内容：

```typescript
// 从消息历史中提取某类资产的最新内容
function extractLatestAsset(messages: UIMessage[], assetType: string): string | null {
  // 倒序搜索，找到最新的 generate* 或 reviseAsset 的输出
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      // 检查 reviseAsset 的输出（优先，因为可能已经修改过）
      if (p.type === "tool-reviseAsset" && p.output) {
        const output = p.output as { success?: boolean; assetType?: string; data?: unknown };
        if (output.success && output.assetType === assetType) {
          return typeof output.data === "string" ? output.data : JSON.stringify(output.data);
        }
      }
      // 检查 generate* 的输出
      const toolMap: Record<string, string> = {
        script: "tool-generateScript",
        ppt: "tool-generatePPT",
        onepager: "tool-generateOnePager",
      };
      if (p.type === toolMap[assetType] && p.output) {
        const output = p.output as { success?: boolean; data?: unknown };
        if (output.success) {
          return typeof output.data === "string" ? output.data : JSON.stringify(output.data);
        }
      }
    }
  }
  return null;
}
```

3. 修改 reviseAsset：

```typescript
reviseAsset: tool({
  description: "根据用户指令修改已生成的资产",
  inputSchema: z.object({
    assetType: z.enum(["script", "ppt", "onepager"]).describe("要修改的资产类型"),
    instructions: z.string().describe("用户的修改指令"),
    // 删掉 currentContent
  }),
  execute: async ({ assetType, instructions }) => {
    // 代码提取最新内容
    const currentContent = extractLatestAsset(messages, assetType);
    if (!currentContent) return { error: `未找到 ${assetType} 的内容` };
    // ... 其余逻辑不变
  },
}),
```

**验证**：进入 editing 状态 → 发送"把讲稿标题改成 XXX" → reviseAsset 应该正确拿到当前讲稿内容并修改。

---

## 阶段二的说明（本次不执行，仅知晓）

修完 3 个 bug 后，下一步将会扩展产品方向。新方向是把 DemoGen 从"只生成讲稿/PPT"升级为"多渠道宣传资产生成平台"，增加截图标注、多平台文案、GIF 等输出类型。但这是后续任务，本次只需要完成阶段一的 bug 修复。

---

## 执行要求

1. 先读 `CLAUDE.md` 和 `src/app/api/agent/route.ts` 了解当前架构
2. 按 Bug 1 → Bug 2 → Bug 3 的顺序修复
3. 每修完一个 bug 就 `npm run build` 验证
4. 每个 bug 修完后单独 git commit
5. 全部修完后 `git push`
6. 代码中保留中文注释解释修改原因
