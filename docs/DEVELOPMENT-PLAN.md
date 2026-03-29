# DemoGen 开发计划

## 已完成阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 项目初始化 + 最小 Agent 对话 | ✅ 完成 |
| Phase 2 | GitHub 分析 + 项目理解卡片 | ✅ 完成 |
| Phase 3 | 多输入 + 场景选择 + 策略推荐 | ✅ 完成 |
| Phase 4 | 资产生成（讲稿 + PPT + One-pager） | ✅ 完成 |
| Phase 5A | 工具调用增强展示 | ✅ 完成 |
| Phase 5B | 资产多选确认框 | ✅ 完成 |
| Phase 5C | 讲稿可编辑 | ✅ 完成 |
| Phase 5D | PPT/One-pager 可编辑 | ✅ 完成 |
| Phase 5E | 对话式资产修改 | ✅ 完成（prompt 遵从性不足，需重构） |

---

## 架构重构：从 Prompt 驱动到代码驱动

### 为什么要重构

Phase 1-5 采用"纯 LLM 自由决策"：Orchestrator 持有所有工具，靠 prompt 控制流程。
这导致 3 个根本问题：

1. **LLM 不听话** — DeepSeek/中转 API 的 prompt 遵从性弱，Agent 生成资产后还在左侧输出大段内容
2. **Prompt 补救是死胡同** — 5A-5E 本质都在"用更强硬的 prompt 补救架构缺陷"
3. **流程不确定** — 每次运行结果不一样，用户体验不可预测

### 解决方案：状态机 + 工具限制

**核心思想：代码控制流程，LLM 只负责生成内容。**

每次 API 请求到达后端时：
1. 从消息历史中**推导当前状态**（哪些工具已完成）
2. 只暴露当前状态下**允许的工具**给 LLM
3. 给 LLM 一个**极简的、状态专用的 prompt**（1-2 句话）

LLM 无法"走偏"，因为它**字面上没有错误工具可以调用**。

---

## 状态机设计

### 状态枚举

```
ANALYZING        → 分析项目（只有 analyzeProject 可用）
AWAITING_SCENARIO → 等待用户选择场景（只有 askUserChoice 可用）
PLANNING         → 生成展示策略（只有 planStrategy 可用）
AWAITING_ASSETS  → 等待用户确认资产（只有 confirmAssets 可用）
GENERATING       → 批量生成资产（只有 generateScript/PPT/OnePager 可用）
EDITING          → 编辑和修改（只有 reviseAsset 可用）
```

### 状态转移图

```
用户首次输入
    │
    ▼
ANALYZING ──analyzeProject完成──▶ AWAITING_SCENARIO
                                        │
                                  用户选择场景
                                        │
                                        ▼
                                    PLANNING ──planStrategy完成──▶ AWAITING_ASSETS
                                                                        │
                                                                  用户确认资产
                                                                        │
                                                                        ▼
                                                                  GENERATING
                                                                  │ 逐个生成
                                                                  │ 选中的资产
                                                                  ▼
                                                               EDITING
                                                               │ 用户修改
                                                               │ 任意资产
                                                               ▼
                                                             (循环)
```

### 状态推导逻辑

后端从消息历史中扫描已完成的工具调用来确定状态：

```typescript
function deriveState(messages: UIMessage[]): AgentState {
  // 扫描所有消息中已完成的工具调用
  const completedTools = extractCompletedToolCalls(messages);

  const hasAnalysis   = completedTools.has("analyzeProject");
  const hasScenario   = completedTools.has("askUserChoice");
  const hasStrategy   = completedTools.has("planStrategy");
  const hasAssetConf  = completedTools.has("confirmAssets");

  // 检查资产生成进度
  const selectedAssets  = getSelectedAssets(completedTools);  // 用户选了哪些
  const generatedAssets = getGeneratedAssets(completedTools); // 已生成哪些
  const allGenerated    = selectedAssets.every(a => generatedAssets.has(a));

  if (!hasAnalysis)   return "analyzing";
  if (!hasScenario)   return "awaiting_scenario";
  if (!hasStrategy)   return "planning";
  if (!hasAssetConf)  return "awaiting_assets";
  if (!allGenerated)  return "generating";
  return "editing";
}
```

### 每个状态的配置

| 状态 | 可用工具 | System Prompt |
|------|---------|---------------|
| analyzing | analyzeProject | "调用 analyzeProject 分析项目。完成后只说'已完成分析。'" |
| awaiting_scenario | askUserChoice | "调用 askUserChoice 让用户选场景。options: [课程答辩,面试展示,开源推广,产品发布,团队汇报]" |
| planning | planStrategy | "调用 planStrategy 生成展示策略。完成后只说'策略已生成。'" |
| awaiting_assets | confirmAssets | "调用 confirmAssets，把策略中的 recommendedAssets 传给用户确认。" |
| generating | generateScript/PPT/OnePager | "依次调用工具生成资产。不要输出任何文字，只调用工具。" |
| editing | reviseAsset | "用户可以编辑资产。收到修改请求时调用 reviseAsset。只回复1句话。" |

---

## 改动影响评估

### 需要改动的文件

| 文件 | 改动类型 | 影响 |
|------|---------|------|
| `src/lib/ai/state-machine.ts` | **新建** | 状态推导 + 状态配置（~120 行） |
| `src/app/api/agent/route.ts` | **重写** | 使用状态机驱动流程（从 ~400 行简化到 ~150 行） |
| `src/lib/ai/prompts.ts` | **简化** | 一个大 prompt → 6 个小 prompt（更可控） |
| `src/components/agent/tool-call-display.tsx` | **不变** | 已有的增强展示继续工作 |
| `src/components/agent/choice-selector.tsx` | **不变** | 前端工具组件不需要改 |
| `src/components/agent/asset-selector.tsx` | **不变** | 前端工具组件不需要改 |
| `src/components/preview/*` | **不变** | 预览和编辑组件全部保留 |
| `src/lib/ai/subagents/*` | **不变** | Subagent 内部逻辑不变 |
| `src/lib/ai/revise.ts` | **不变** | 资产修改逻辑不变 |

### 不需要改动的部分

- **所有前端组件** — assistant-ui 无感知，消息格式不变
- **所有 Subagent** — 仍然是纯函数，被工具的 execute 调用
- **PreviewContext** — 数据流不变，仍由 ToolCallDisplay 推送
- **资产编辑功能** — 5C/5D 的编辑完全保留

### 工期估计

| 步骤 | 内容 | 预计 |
|------|------|------|
| R1 | 创建 state-machine.ts（状态推导 + 配置） | 30 分钟 |
| R2 | 重写 route.ts（使用状态机） | 30 分钟 |
| R3 | 重写 prompts.ts（状态专用 prompt） | 15 分钟 |
| R4 | 测试全流程 | 15 分钟 |
| **合计** | | **~1.5 小时** |

---

## 实施步骤

### Step R1: 创建状态机模块

新建 `src/lib/ai/state-machine.ts`：
- `AgentState` 类型定义
- `deriveState(messages)` — 从消息历史推导状态
- `getStateConfig(state, context)` — 返回该状态的工具集和 prompt
- 辅助函数：提取已完成的工具调用、已选资产、已生成资产

**验收**：单元级别 — 函数逻辑正确，TypeScript 编译通过

### Step R2: 重写 route.ts

将当前的"一个大 streamText + 全部工具"改为：
```
POST → 解析消息 → deriveState → getStateConfig → streamText(限制工具+精简prompt)
```

**验收**：`npm run build` 通过

### Step R3: 重写 prompts.ts

删除 ORCHESTRATOR_PROMPT（一个 80 行的大 prompt），替换为 6 个状态专用 prompt：
- 每个 prompt 只有 1-3 句话
- 只描述当前状态该做什么
- LLM 不需要理解整个流程

**验收**：`npm run build` 通过

### Step R4: 端到端测试

1. 提交项目 → 分析 → 场景选择 → 策略 → 资产确认 → 生成 → 完成
2. 验证左侧不会输出大段文字
3. 验证修改资产走 reviseAsset 工具
4. 验证每个状态只有正确的工具可用

**验收**：全流程无异常，Agent 行为完全可预测

---

## 重构后 Phase 5 的状态

| 原 Phase | 是否仍需要 | 说明 |
|----------|-----------|------|
| 5A 工具调用增强展示 | ✅ 保留 | ToolCallDisplay 组件不变，继续提供人类可读的行为卡片 |
| 5B 资产多选确认框 | ✅ 保留 | AssetSelector 组件不变，confirmAssets 工具不变 |
| 5C 讲稿可编辑 | ✅ 保留 | ScriptPreview 编辑模式不变 |
| 5D PPT/One-pager 可编辑 | ✅ 保留 | 内联编辑组件不变 |
| 5E 对话式资产修改 | ✅ 修复 | reviseAsset 工具不变，但现在 LLM 在 editing 状态**只有这个工具可用**，不会再"自己输出文字" |
| Phase 6 Subagent 切换 | ❌ 不再需要 | 状态机已经让流程完全可见，不需要额外的 Subagent UI |

---

## 历史阶段（折叠）

<details>
<summary>展开查看 Phase 1-5 详细步骤</summary>

### Phase 1-4: 核心功能链路
- Phase 1: 项目初始化 + 最小 Agent 对话
- Phase 2: GitHub 分析 + 项目理解卡片
- Phase 3: 多输入 + 场景选择 + 策略推荐
- Phase 4: 资产生成（讲稿 + PPT + One-pager）

### Phase 5A-5E: 交互改进
- 5A: 工具调用增强展示（ToolCallDisplay 重写）
- 5B: 资产多选确认框（AssetSelector + confirmAssets）
- 5C: 讲稿可编辑（ScriptPreview 编辑/预览双模式）
- 5D: PPT/One-pager 可编辑（内联编辑 + EditableText）
- 5E: 对话式资产修改（reviseAsset 工具 + revise.ts）

</details>
