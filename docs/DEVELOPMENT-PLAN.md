# DemoGen 开发计划

## 已完成阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 项目初始化 + 最小 Agent 对话 | ✅ 完成 |
| Phase 2 | GitHub 分析 + 项目理解卡片 | ✅ 完成 |
| Phase 3 | 多输入 + 场景选择 + 策略推荐 | ✅ 完成 |
| Phase 4 | 资产生成（讲稿 + PPT + One-pager） | ✅ 完成 |

## 第二轮改进：从"能用"到"好用"

Phase 1-4 打通了核心链路，但存在 4 个严重的交互问题：

1. **Agent 行为不可见** — 用户看不到 Agent 在做什么，只看到工具名和 JSON
2. **资产不可交互** — 右侧生成的内容只读，不能编辑修改
3. **没有资产选择框** — 场景选好后 Agent 自己决定生成什么，用户没有选择权
4. **Subagent 状态不可见** — 不知道哪个 Subagent 在工作，无法单独和它对话

这些问题按"影响 × 可行性"排优先级，拆成 5 个小阶段，每个阶段聚焦一个问题。

---

## 未完成阶段概览

| 阶段 | 内容 | 优先级 | 难度 | 解决的问题 |
|------|------|--------|------|-----------|
| Phase 5A | 工具调用增强展示 | 🔴 最高 | ⭐⭐ | 问题1：Agent 行为不可见 |
| Phase 5B | 资产多选确认框 | 🟡 高 | ⭐ | 问题3：没有资产选择框 |
| Phase 5C | 讲稿可编辑 | 🔴 最高 | ⭐⭐ | 问题2：资产不可交互（讲稿） |
| Phase 5D | PPT/One-pager 可编辑 | 🟡 高 | ⭐⭐⭐ | 问题2：资产不可交互（其余） |
| Phase 5E | 对话式资产修改 | 🟡 高 | ⭐⭐⭐ | 问题2：对话驱动的修改能力 |
| Phase 6 | Subagent 可见性与切换 | 🟢 中 | ⭐⭐⭐⭐ | 问题4：Subagent 状态 |
| Phase 7 | 导出 + 打磨 + 部署 | 🟢 中 | ⭐⭐ | 产品化收尾 |

---

## Phase 5A: 工具调用增强展示

### 解决的问题
当前 ToolCallDisplay 只显示工具英文名、原始 JSON 参数、和"执行中..."文字。
用户完全看不懂 Agent 在做什么。

### 目标
每个工具调用显示为**人类可读的行为卡片**，包含：
- 清晰的中文行为描述（不是 JSON）
- 工具执行中：显示正在做什么（如"分析 GitHub 仓库 owner/repo..."）
- 工具完成后：显示关键发现摘要（如"识别为 Web App，3 个核心功能"）

### 效果示例

```
🔍 分析项目
  执行中...
  ├─ GitHub 仓库: owner/repo
  └─ 同时分析用户描述和上传文档
```

完成后变为：

```
✅ 分析项目 — 完成
  项目类型: Web App
  核心功能: 3 个
  技术亮点: 2 个
  → 已生成项目理解卡片，请查看右侧
```

### 具体改动

#### 5A.1 重写 ToolCallDisplay 组件
- 不再显示原始 JSON args
- 为每种工具定义**运行时描述**和**完成摘要**的渲染逻辑
- `analyzeProject`：运行时显示仓库名或"分析上传文档"；完成后显示项目类型、功能数量等
- `planStrategy`：运行时显示场景名；完成后显示推荐资产列表、总时长
- `generateScript`：运行时显示"正在撰写讲稿..."；完成后显示字数
- `generatePPT`：运行时显示"正在设计 PPT 大纲..."；完成后显示页数
- `generateOnePager`：运行时显示"正在生成一页纸..."；完成后显示标语

#### 5A.2 工具结果结构增强
- 修改各 tool 的 execute 返回值，增加 `summary` 字段
- 例如 `analyzeProject` 完成后返回：
  ```typescript
  {
    success: true,
    data: understanding,
    summary: {
      projectType: "web-app",
      featureCount: 3,
      highlightCount: 2,
    }
  }
  ```
- ToolCallDisplay 用 summary 渲染人类可读的摘要

#### 5A.3 运行时参数可读化
- 替换 `formatArgs` 函数，为每种工具定义专用的运行时描述
- 例如 `analyzeProject` 运行时不显示 `githubUrl: "https://..."`, 而是显示 `分析仓库 owner/repo`

### 不做的事
- 不做 sub-step 流式进度（工具是原子执行的，无法流式展示内部步骤）
- 不拆分 analyzeProject 为多个小工具（保持架构简单）

### 验证
- 每个工具调用显示清晰的中文描述
- 运行中和完成后的显示不同
- 不再出现任何 JSON
- `npm run build` 通过

---

## Phase 5B: 资产多选确认框

### 解决的问题
当前用户选完场景后，Agent 自己决定生成什么资产。用户没有选择权。

### 目标
策略生成后，弹出资产选择框（多选），用户勾选想要的资产后才开始生成。

### 效果示例

```
根据"课程答辩"场景，推荐生成以下资产：

[✅] 答辩讲稿 — 8分钟演讲稿 (Markdown)
[✅] 答辩PPT大纲 — 含备注的幻灯片结构
[✅] 项目一页纸 — 精炼的项目介绍卡

[开始生成]
```

### 具体改动

#### 5B.1 新建 AssetSelector 组件
- 类似 ChoiceSelector，但支持**多选**（checkbox 而非 radio）
- 每个选项显示资产名称 + 简短描述
- 默认全选（根据策略推荐）
- 底部"开始生成"按钮

#### 5B.2 注册 confirmAssets 前端工具
- 在 route.ts 中添加 `confirmAssets` 工具（无 execute，前端工具）
- inputSchema: `{ recommendedAssets: [{ type, label, reason }] }`
- result: `{ selectedAssets: string[] }` — 用户勾选的资产类型列表

#### 5B.3 修改 Orchestrator 流程
- 更新 ORCHESTRATOR_PROMPT，在 Step 4 中：
  - planStrategy 完成后，调用 `confirmAssets` 展示推荐资产
  - 用户确认后，只生成用户选择的资产
- Step 5 的生成逻辑根据 selectedAssets 决定调用哪些工具

#### 5B.4 在 thread.tsx 注册渲染
- `tools.by_name.confirmAssets: AssetSelector`

### 验证
- 策略生成后弹出多选框
- 用户可以取消不想要的资产
- 只生成用户选择的资产
- `npm run build` 通过

---

## Phase 5C: 讲稿可编辑

### 解决的问题
右侧生成的讲稿只能看不能改。这是用户最直接需要的编辑功能。

### 目标
讲稿预览区支持**编辑/预览双模式**，用户可以直接修改文本并保存。

### 效果示例

```
📝 讲稿                    [预览] [编辑] [导出]
─────────────────────────────────────────
## 第一章：开场与问题定义（1分钟）

各位老师好，今天我们团队要展示的项目是...
```

点击"编辑"后切换为 textarea：

```
📝 讲稿                    [预览] [编辑✓] [导出]
─────────────────────────────────────────
┌──────────────────────────────────────┐
│ ## 第一章：开场与问题定义（1分钟）    │
│                                      │
│ 各位老师好，今天我们团队要展示的...   │
│ [用户可以直接在这里修改文本]         │
└──────────────────────────────────────┘
```

### 具体改动

#### 5C.1 改造 ScriptPreview 组件
- 添加编辑/预览模式切换状态
- 预览模式：现有的 ReactMarkdown 渲染（不变）
- 编辑模式：全屏 textarea，等宽字体，显示 Markdown 源码
- 顶部工具栏：模式切换按钮 + 导出按钮（导出先占位）

#### 5C.2 PreviewContext 添加更新方法
- 添加 `updateScriptContent(content: string)` 方法
- 编辑保存时调用，更新 Context 中的讲稿内容
- 其他组件（如未来的导出功能）始终读取最新内容

#### 5C.3 编辑器 UX 细节
- 编辑模式下 textarea 自动聚焦
- 实时同步（onChange 直接更新 Context，无需手动保存按钮）
- 切换到预览模式时立即渲染最新内容
- textarea 高度自适应内容

### 不做的事
- 不引入重量级编辑器库（CodeMirror/Monaco）—— textarea 足够用
- 不做实时 Markdown 预览分屏 —— 两个模式切换即可
- 导出 PDF 功能留到 Phase 7

### 验证
- 讲稿可以在编辑和预览模式之间切换
- 编辑内容保存到 PreviewContext
- 切回预览模式显示最新内容
- `npm run build` 通过

---

## Phase 5D: PPT 大纲 + One-pager 可编辑

### 解决的问题
PPT 大纲和 One-pager 也需要可编辑能力。

### 目标
PPT 每一页的标题/要点/备注可以内联编辑。One-pager 的每个字段可以内联编辑。

### 具体改动

#### 5D.1 PptPreview 支持内联编辑
- 每个 slide 卡片添加"编辑"按钮
- 点击后，标题变为 input，bullets 变为 textarea（每行一个要点）
- speakerNotes 变为 textarea
- "保存"按钮提交修改到 PreviewContext

#### 5D.2 OnePagerPreview 支持内联编辑
- 每个区块（problem/solution/features/techHighlight 等）添加编辑按钮
- 点击后对应文本变为 input/textarea
- 保存到 PreviewContext

#### 5D.3 PreviewContext 添加更新方法
- `updatePptOutline(data: PptOutline)` — 更新整个 PPT 大纲
- `updateOnePager(data: OnePager)` — 更新整个 One-pager
- 组件内部管理临时编辑状态，保存时一次性更新 Context

### 验证
- PPT 每页可编辑标题、要点、备注
- One-pager 每个字段可编辑
- 编辑保存后 PreviewContext 更新
- `npm run build` 通过

---

## Phase 5E: 对话式资产修改

### 解决的问题
用户想通过对话修改资产（"把讲稿第三段改成..."），而不是手动编辑。

### 目标
用户在左侧聊天中描述修改需求，Agent 调用对应的 Subagent 重新生成指定部分。

### 具体改动

#### 5E.1 新增 reviseAsset 工具
- 在 route.ts 注册 `reviseAsset` 工具
- inputSchema:
  ```typescript
  {
    assetType: z.enum(["script", "ppt", "onepager"]),
    currentContent: z.string(), // 当前资产内容（JSON 或 Markdown）
    instructions: z.string(),   // 用户的修改指令
  }
  ```
- execute: 根据 assetType 调用对应的 Subagent，传入当前内容 + 修改指令

#### 5E.2 新增修改用 Subagent prompt
- 为每种资产的 Subagent 添加"修改模式"的 prompt
- 接收当前内容 + 修改指令，输出修改后的完整内容
- 保持与原始生成相同的 schema 约束

#### 5E.3 更新 Orchestrator prompt
- 添加规则：当用户发送修改请求时，调用 reviseAsset 工具
- Agent 需要判断用户想修改哪种资产

#### 5E.4 前端处理 reviseAsset 结果
- ToolCallDisplay 识别 reviseAsset 工具
- 完成后更新 PreviewContext 中对应资产的内容

### 验证
- 用户说"把讲稿开头改成更有吸引力的"，Agent 调用 reviseAsset
- 讲稿内容在右侧更新
- PPT 和 One-pager 的对话式修改同样工作
- `npm run build` 通过

---

## Phase 6: Subagent 可见性与切换（可延后）

### 解决的问题
用户看不到各个 Subagent 的状态，无法单独和某个 Subagent 对话。

### 目标
左侧面板顶部显示 Subagent 状态栏，点击可切换对话对象。

### 评估
这是架构级改动，需要：
- 重新设计消息的归属（哪条消息来自哪个 Subagent）
- 多个对话线程的状态管理
- assistant-ui 消息结构可能需要扩展

**建议：在 5A-5E 全部完成、产品基本可用后再考虑。**
如果时间不够，用 Phase 5A 的增强展示代替（工具调用卡片已经能间接展示 Subagent 行为）。

### 具体改动（草案）

#### 6.1 Subagent 状态栏组件
- 顶部显示所有 Subagent 状态：`[Orchestrator] [Analysis ✅] [Strategy ✅] [Script 🔄] [PPT]`
- 从 PreviewContext 推导状态（有数据 = 完成）

#### 6.2 消息标签
- 在 AssistantMessage 组件中添加来源标签
- 根据工具调用上下文推断消息来自哪个 Subagent

#### 6.3 对话切换（高难度）
- 需要多个独立的 thread 或 filtered view
- 可能需要自定义 assistant-ui runtime

---

## Phase 7: 导出 + 打磨 + 部署

### 步骤

#### 7.1 导出功能
- 讲稿导出为 Markdown 文件（浏览器端下载）
- PPT 大纲导出为 Markdown 或 JSON（后期可接 Pandoc 转 PPTX）
- One-pager 导出为 PDF（使用浏览器 print API）

#### 7.2 UI 打磨
- Loading 状态完善（骨架屏）
- 错误处理和重试机制
- 空状态优化
- 移动端适配（折叠面板）

#### 7.3 测试 + 部署
- 3-5 个真实 GitHub 项目端到端测试
- Vercel 部署配置
- 环境变量和 API Key 管理

---

## 实施建议

1. **每次只做一个 Phase**，完成后测试确认再继续
2. **推荐顺序：5A → 5B → 5C → 5D → 5E → 7 → 6**
3. Phase 5A 和 5B 可以独立并行开发
4. Phase 6 视时间决定是否实施，不影响产品核心体验
5. 每个 Phase 完成后 commit，保持可回滚

---

## 历史记录

### Phase 1-4 详细步骤（已完成，折叠保存）

<details>
<summary>展开查看 Phase 1-4 详细步骤</summary>

### Phase 1: 项目初始化 + 最小 Agent 对话
- 1.1 项目初始化（create-next-app + 依赖安装 + shadcn/ui）
- 1.2 左右分栏布局（page.tsx）
- 1.3 最小 Agent API（/api/agent/route.ts + getCurrentTime 测试工具）
- 1.4 Agent 面板（useChatRuntime + ThreadPrimitive + ToolCallDisplay）
- 1.5 验证 & 提交

### Phase 2: GitHub 分析 + 项目理解卡片
- 2.1 GitHub 分析器（parseGitHubUrl + analyzeRepo）
- 2.2 项目理解 Schema（projectUnderstandingSchema）
- 2.3 Analysis Subagent（generateObject + schema）
- 2.4 analyzeProject 工具注册
- 2.5 项目理解卡片（ProjectCard 组件）
- 2.6 PreviewContext + PreviewPanel
- 2.7 验证 & 提交

### Phase 3: 多输入 + 场景选择 + 策略推荐
- 3.1 InputArea 组件（链接 + 文件上传 + 文字描述）
- 3.2 文件上传 API（/api/upload）
- 3.3 Analysis Subagent 支持多输入
- 3.4 策略 Schema + Strategy Subagent
- 3.5 askUserChoice 前端工具 + ChoiceSelector
- 3.6 StrategyCard 组件
- 3.7 验证 & 提交

### Phase 4: 资产生成（讲稿 + PPT + One-pager）
- 4.1 Script Writer Subagent（generateText）
- 4.2 PPT Architect Subagent（generateObject + pptOutlineSchema）
- 4.3 One-pager Designer Subagent（generateObject + onePagerSchema）
- 4.4 三个生成工具注册到 route.ts
- 4.5 PreviewContext 扩展（scriptContent/pptOutline/onePager）
- 4.6 ScriptPreview / PptPreview / OnePagerPreview 组件
- 4.7 PreviewPanel 标签栏支持全部 5 种资产
- 4.8 验证 & 提交

</details>
