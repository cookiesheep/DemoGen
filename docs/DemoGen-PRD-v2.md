# DemoGen 产品需求文档 v2（Agent-Native 架构）

> 版本：v2.0 | 2026-03-28 | DemoGen 团队
> 替代 v1.0（纯聊天驱动架构），基于实际开发中发现的问题重新设计

---

## 一、产品定位

### 一句话定义

**DemoGen** 是一个 AI Agent 驱动的项目展示资产生成器——用户提交项目资料，Agent 自主分析项目、规划展示策略、生成讲稿/PPT/One-pager 等资产包，用户全程可观察、可干预、可编辑。

### 核心比喻

> GitHub 项目就像淘宝上没有图片的商品——有参数说明（README），但没人想花 20 分钟看文字。DemoGen 就是帮你给"商品"拍照、写文案、做详情页的 AI 团队。
>
> 和直接用 ChatGPT 的区别：ChatGPT 是一个什么都能聊的顾问；DemoGen 是一个专门干活的团队——你交代目标，它们分工协作，你看着它们干活，不满意就说一声。

### v1 → v2 为什么要改

v1 的核心问题是"把流程控制权交给了 AI 对话"：
- AI 不听 prompt 指令，说了"让我生成"然后不调工具
- 用户需要反复催促才能推进流程
- 体验和直接用 ChatGPT 网页对话无本质区别
- DeepSeek 等模型的 prompt 遵从度不够

v2 的核心改变：**Agent 有执行力，不只会说话。** 它像 Claude Code 一样——你看到它在调用工具、在读取数据、在生成内容，而不是只看到一个聊天气泡。

---

## 二、目标用户（不变）

| 用户群体 | 场景 | 痛点 |
|---|---|---|
| 课程项目团队 | 期末答辩、课设展示 | 做了 3 周的项目，准备答辩资料又花 2 天 |
| 求职开发者 | 面试、作品集 | 有项目但不知道怎么展示给非技术面试官 |
| 独立开发者 | Product Hunt、社媒推广 | 产品做完了，宣传是另一个技能 |
| 开源维护者 | 项目推广 | README 写得再好，新人也很难 30 秒理解价值 |

---

## 三、输入方式（重要改进）

### 问题

v1 只支持 GitHub 链接，但现实中：
- 很多项目没有公开 GitHub 仓库（私有仓库、Gitee、商业保密）
- 有些仓库只是代码仓库，README 几乎没内容
- 大型项目代码量巨大，靠读代码理解不现实
- 小程序、移动端项目的代码结构和 Web 项目完全不同

### 支持的输入方式（按优先级）

| 输入方式 | 描述 | 优先级 |
|---|---|---|
| **GitHub/Gitee 链接** | 自动获取 README、目录树、依赖信息 | P0 |
| **上传 README / 文档** | 用户上传 .md / .txt / .pdf 文件 | P0 |
| **文字描述** | 用户在输入框直接描述项目 | P0 |
| **上传截图** | 产品截图、UI 设计图、架构图（多模态理解） | P1 |
| **已部署 URL** | Agent 自动访问并截图/分析 | P2 |

### 输入交互设计

输入区不是单一的聊天输入框，而是一个"提交面板"：

```
┌─────────────────────────────────┐
│  📎 上传文件  🔗 粘贴链接        │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 粘贴 GitHub 链接、上传   │   │
│  │ 文档，或直接描述你的项目  │   │
│  └─────────────────────────┘   │
│                                 │
│  已添加：                       │
│  📄 README.md  🖼 screenshot.png │
│                                 │
│         [ 开始分析 →]           │
└─────────────────────────────────┘
```

用户可以一次性提交多种输入，Agent 综合所有材料理解项目。

---

## 四、产品架构（Agent-Native）

### 核心理念

1. **Agent 有执行力** — 不只会对话，能自主调用工具完成任务
2. **过程可观察** — 用户能看到 Agent 在做什么（读取仓库、分析项目、生成内容...）
3. **随时可干预** — 用户可以在任何阶段插入修改意见
4. **多 Agent 协作** — 不同任务分配给专长不同的 Agent（或 subagent）

### Agent 系统设计

```
┌─────────────────────────────────────────────────┐
│                  Orchestrator Agent               │
│  (主 Agent — 负责流程编排和用户交互)               │
│                                                   │
│  职责：                                           │
│  · 接收用户输入，判断类型和完整度                    │
│  · 决定下一步该做什么                              │
│  · 分派任务给 subagent                            │
│  · 汇总结果给用户，处理用户反馈                     │
│  · 展示选项让用户做选择（Generative UI）            │
└───────┬──────────┬──────────┬────────────────────┘
        │          │          │
        ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Analysis │ │ Strategy │ │  Asset   │
│ Subagent │ │ Subagent │ │ Subagent │
│          │ │          │ │          │
│ · 读 GitHub│ · 选场景  │ │ · 讲稿   │
│ · 读文档  │ │ · 选资产  │ │ · PPT    │
│ · 读截图  │ │ · 安排结构│ │ · One-pg │
│ · 输出理解│ │ · 规划时间│ │ · 按需切换│
│   卡片    │ │          │ │   模型   │
└──────────┘ └──────────┘ └──────────┘
```

**为什么用 subagent 而不是一个大 agent？**
1. 每个 subagent 有专注的 system prompt，输出质量更高
2. 不同 subagent 可以用不同模型（分析用 Claude，生成用 GPT-4.1，降低成本）
3. 一个 subagent 失败不影响整体流程
4. 方便后续扩展新的资产类型（加一个 subagent 即可）
5. 用户可以只重跑某个 subagent 而不用重来整个流程

### Agent 可见性

用户能看到的 Agent 状态（参考 Claude Code 的体验）：

```
🔵 Agent 正在工作...

  ┌ 📡 读取 GitHub 仓库信息
  │   → 获取 README.md ✓
  │   → 获取目录结构 ✓
  │   → 获取 package.json ✓
  ├ 🔍 分析项目...
  │   → 识别项目类型: Web 应用 ✓
  │   → 提取核心功能 ✓
  │   → 识别技术亮点 ✓
  └ ✅ 项目理解完成

  [项目理解卡片已生成，请在右侧查看]

  接下来我需要了解你的展示场景：
  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────┐
  │ 课程答辩 │ │ 面试展示 │ │ 开源推广  │ │ 自定义│
  └─────────┘ └─────────┘ └──────────┘ └──────┘
```

关键点：
- **工具调用可见**：每次 Agent 调用工具，用户都能看到（类似 Claude Code 的 tool use 显示）
- **进度可追踪**：多步任务有 Plan 组件显示整体进度
- **选项由 Agent 动态生成**：不是前端硬编码按钮，而是 Agent 根据上下文生成适当的选项（Generative UI）
- **中间结果可预览**：Agent 生成的每个中间产物都实时渲染到右侧

---

## 五、用户旅程（Agent 驱动）

### 主流程

```
Step 1: 提交项目资料
  用户上传 GitHub 链接 / README / 截图 / 文字描述（可组合）
  点击"开始分析"
      ↓
Step 2: Agent 分析项目（自动执行，用户观察）
  Analysis Subagent 工作：
  · [工具调用] 获取 GitHub 仓库数据（如有链接）
  · [工具调用] 解析上传的文档（如有文件）
  · [AI 分析] 综合所有输入，生成结构化项目理解
  · → 右侧渲染"项目理解卡片"
  · Agent 向用户确认："这是我对项目的理解，有什么需要修正的吗？"
      ↓
Step 3: 确认理解 + 选择场景
  用户确认或修改项目理解
  Agent 动态展示场景选项（答辩/面试/推广/自定义）
  用户选择后，Agent 可能追问 1 个问题（时长/重点/观众）
      ↓
Step 4: Agent 规划展示策略（自动执行）
  Strategy Subagent 工作：
  · [AI 规划] 根据项目类型 + 场景生成展示策略
  · → 右侧渲染"展示策略卡片"（推荐资产/结构/时间分配）
  · Agent 向用户确认策略
      ↓
Step 5: Agent 生成资产（自动执行，用户观察）
  Asset Subagent(s) 并行/串行工作：
  · [AI 生成] 讲稿（Markdown）    → 右侧实时预览
  · [AI 生成] PPT 大纲（JSON）    → 右侧卡片预览
  · [AI 生成] One-pager（HTML）   → 右侧渲染预览
  · 右侧资产栏（Dock）显示所有生成的资产，点击切换
      ↓
Step 6: 编辑与导出
  用户在右侧编辑任意资产
  可通过聊天要求 Agent 修改特定部分
  导出：讲稿 PDF / PPT PPTX / One-pager PDF
```

### 和 v1 的关键区别

| 维度 | v1（聊天驱动） | v2（Agent 驱动） |
|---|---|---|
| 流程控制 | AI 通过 prompt 自己决定 | Agent 代码逻辑控制 |
| 用户推进 | 需要反复追问 | 自动执行，用户观察 |
| 中间状态 | 不可见，只有聊天文字 | 工具调用、进度条、状态标签 |
| 选项展示 | AI 在聊天中文字描述 | Agent 动态生成 UI 按钮 |
| 失败恢复 | 从头开始 | 重跑某个 subagent |
| 模型灵活性 | 整个流程一个模型 | 不同步骤可用不同模型 |

---

## 六、界面设计

### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  DemoGen                                        [设置] [导出]│
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│   左侧：Agent 面板    │   右侧：资产预览区                    │
│                      │                                      │
│  ┌────────────────┐  │  ┌────────────────────────────────┐  │
│  │ 输入区          │  │  │                                │  │
│  │ (链接/文件/描述) │  │  │   当前选中的资产预览            │  │
│  └────────────────┘  │  │                                │  │
│                      │  │   · 项目理解卡片                │  │
│  ┌────────────────┐  │  │   · 展示策略卡片                │  │
│  │ Agent 对话区    │  │  │   · 讲稿 Markdown              │  │
│  │                │  │  │   · PPT 大纲                   │  │
│  │ 显示：          │  │  │   · One-pager                  │  │
│  │ · Agent 消息    │  │  │                                │  │
│  │ · 工具调用状态  │  │  │                                │  │
│  │ · 动态选项按钮  │  │  │                                │  │
│  │ · 进度指示器    │  │  └────────────────────────────────┘  │
│  │ · 用户消息      │  │                                      │
│  │                │  │  ┌──┐┌──┐┌──┐┌──┐┌──┐               │
│  └────────────────┘  │  │📋││📊││📄││🖼││📹│  ← 资产 Dock   │
│                      │  └──┘└──┘└──┘└──┘└──┘               │
│  [消息输入框...]     │                                      │
├──────────────────────┴──────────────────────────────────────┤
│  Agent: Analysis Subagent · 状态: 分析 README... · ⏱ 3s     │
└─────────────────────────────────────────────────────────────┘
```

### 左侧 Agent 面板

不是传统聊天窗口。它是一个"Agent 活动面板"，混合展示：

1. **Agent 消息** — Agent 的文字回复（简洁，不像传统 AI 那么啰嗦）
2. **工具调用卡片** — 类似 Claude Code 的工具调用展示：
   ```
   ┌ 🔧 analyzeGitHubRepo
   │ url: github.com/user/project
   │ status: ✅ 完成 (2.3s)
   │ 获取了 README (2.4KB), 目录树 (156 个文件), package.json
   └
   ```
3. **动态选项** — Agent 在需要用户输入时弹出选项按钮（不是硬编码，是 Agent 生成的）
4. **进度组件** — 多步任务时显示 Plan/Progress Tracker
5. **用户消息** — 用户可以随时打字干预

### 右侧资产预览区

- 主体是当前选中资产的大面积预览
- 底部（或侧边）是 **资产 Dock 栏**（类似 macOS Dock）：
  - 每个已生成的资产一个图标
  - 点击切换预览内容
  - 未生成的资产灰色显示
  - 生成中的资产有 loading 动画
- 每个资产预览区内有"编辑"和"导出"按钮

### 底部状态栏

全局显示当前活跃的 Agent/Subagent 名称、状态、耗时。

---

## 七、功能需求

### P0 — 核心功能

#### F1: 多模态项目输入
- 支持 GitHub 链接（自动解析）
- 支持上传 .md / .txt / .pdf 文档
- 支持文字描述
- 可同时提交多种输入

#### F2: Agent 项目理解
- Analysis Subagent 综合所有输入材料
- 使用 `generateObject` + Zod schema 输出结构化项目理解
- 工具调用过程可见（读取仓库、解析文档...）
- 输出"项目理解卡片"到右侧
- 用户可修改

#### F3: 场景选择（Agent 动态生成 UI）
- Agent 根据项目类型推荐场景选项
- 以交互式按钮呈现（Generative UI / Tool UI）
- 支持自定义场景输入
- Agent 可追问 1 个补充问题

#### F4: 展示策略推荐
- Strategy Subagent 基于项目 + 场景生成策略
- 输出：推荐资产组合/展示结构/时间分配/重点方向
- 展示为"策略卡片"

#### F5: 讲稿生成
- Asset Subagent 生成展示讲稿（Markdown）
- 流式输出，右侧实时预览
- 支持导出 PDF

#### F6: PPT 大纲生成
- 结构化 JSON（每页标题/要点/备注）
- 右侧卡片式预览
- 通过 Pandoc 导出可编辑 PPTX

#### F7: Agent 活动可见性
- 工具调用实时展示（名称、参数、状态、耗时）
- 多步任务显示 Plan/Progress 组件
- 底部状态栏显示当前 Agent 状态

### P1 — 重要功能

#### F8: One-pager 生成
- HTML 模板渲染
- 支持导出 PDF/图片

#### F9: 资产 Dock 栏
- 底部图标栏切换不同资产预览
- 生成中动画、未生成灰显

#### F10: 聊天式修改
- 用户对任意资产提出修改意见
- Agent 理解上下文，局部重生成

#### F11: 截图上传 + 多模态理解
- 上传产品截图、架构图
- AI 视觉理解，纳入项目分析

### P2 — 加分功能

#### F12: BYOK（Bring Your Own Key）
- 用户设置自己的 API Key（OpenAI/Claude/DeepSeek/Gemini）
- 不同 subagent 可配置不同模型
- 默认使用平台提供的 Key

#### F13: Demo 录屏
- 对已部署 URL 用 Playwright 录屏
- 失败退化为截图

#### F14: 用户认证 + 历史记录
- Supabase Auth
- 项目和资产持久化存储

---

## 八、技术架构

### 技术栈

| 层 | 技术 | 角色 |
|---|---|---|
| 框架 | Next.js 16 + TypeScript | 全栈框架 |
| Agent 引擎 | **Vercel AI SDK v6**（ToolLoopAgent + subagents） | Agent 循环、工具调用、结构化输出 |
| Agent UI | **assistant-ui** + **@assistant-ui/tool-ui** | 聊天面板、工具调用展示、Plan/Progress 组件 |
| 结构化输出 | **generateObject** + Zod schema | 确保 AI 输出符合格式 |
| 流式生成 | **streamText** | 讲稿等长文本流式输出 |
| UI 组件 | shadcn/ui + Tailwind CSS | 基础 UI |
| 数据库 | Supabase（后期） | 认证、存储 |
| PPT 导出 | Pandoc | Markdown → PPTX |

### 为什么继续用 AI SDK 而不换框架

1. **已有基础** — 项目已经跑通了 AI SDK 的基本流程
2. **原生 Next.js 集成** — 其他框架（Mastra、LangGraph JS）都需要额外适配
3. **v6 的 Agent 功能足够** — ToolLoopAgent + subagent 模式覆盖我们的需求
4. **assistant-ui 深度集成** — tool-ui 组件库直接解决 Agent 可见性问题
5. **团队学习成本最低** — 不用学新框架，在已有基础上增量开发

### Agent 编排架构

```typescript
// 伪代码 — Orchestrator Agent 的工作方式
const orchestrator = new ToolLoopAgent({
  model: openai.chat("deepseek-chat"),
  system: ORCHESTRATOR_PROMPT,
  tools: {
    // 分析工具 — 派发给 Analysis Subagent
    analyzeProject: tool({
      description: "分析用户提交的项目资料",
      inputSchema: z.object({ ... }),
      execute: async (input) => {
        // Subagent 在这里工作
        const result = await generateObject({
          model: openai.chat("deepseek-chat"),
          system: ANALYSIS_PROMPT,
          schema: projectUnderstandingSchema,
          prompt: buildAnalysisPrompt(input),
        });
        return result.object; // 返回结构化结果给 Orchestrator
      },
    }),

    // 策略工具
    planStrategy: tool({ ... }),

    // 生成工具
    generateScript: tool({ ... }),
    generatePPTOutline: tool({ ... }),
    generateOnePager: tool({ ... }),

    // UI 交互工具（Generative UI）
    askUserChoice: tool({
      description: "向用户展示选项并等待选择",
      inputSchema: z.object({
        question: z.string(),
        options: z.array(z.string()),
      }),
      // 前端工具 — 无 execute，由前端 tool-ui 渲染为按钮
    }),
  },
});
```

### API 设计

| 路由 | 功能 |
|---|---|
| `/api/agent` | 主 Agent 入口，接收用户消息，流式返回 Agent 活动 |
| `/api/upload` | 文件上传（文档、截图） |
| `/api/export/pptx` | Pandoc 导出 PPTX |
| `/api/export/pdf` | 导出 PDF |

注意：不再有多个分散的 `/api/understand`, `/api/strategy` 等接口。**所有 AI 调用由 Agent 自主编排**，通过一个统一的 `/api/agent` 入口。

---

## 九、Subagent 技能设计（可扩展）

| Subagent | 专长 | 工具 | 推荐模型 |
|---|---|---|---|
| **Analysis** | 项目理解 | GitHub API、文档解析、截图 OCR | Claude（理解力强） |
| **Strategy** | 展示规划 | 场景模板库 | GPT-4.1（推理好） |
| **Script Writer** | 讲稿撰写 | — | GPT-4.1（文笔好） |
| **PPT Architect** | PPT 结构 | Pandoc 模板 | DeepSeek（结构化输出够用） |
| **One-pager Designer** | 一页介绍 | HTML 模板 | DeepSeek |
| **Recorder**（P2） | Demo 录屏 | Playwright | 不用 LLM |

这个设计让 BYOK 变得自然：用户可以给不同 subagent 配置不同的 API Key 和模型。

---

## 十、成功指标

### MVP 验收标准（学期第 10 周末）

- [ ] 支持 GitHub 链接 + 文档上传 + 文字描述三种输入
- [ ] Agent 全流程自动执行，无需用户追问
- [ ] 用户能看到 Agent 的每一步操作（工具调用、进度、状态）
- [ ] 输入 3 个不同类型的项目，都能稳定生成讲稿 + PPT 大纲
- [ ] PPT 导出为可编辑 PPTX
- [ ] 单次完整流程 < 60 秒

### 答辩差异化卖点

1. **Agent-Native 架构** — 不是套壳 AI 聊天，是真正有执行力的 Agent
2. **过程可观察** — 用户能看到 Agent 在做什么，像 Claude Code 一样透明
3. **Multi-Agent 协作** — 不同 subagent 处理不同任务，可配置不同模型
4. **Meta-demo** — 用 DemoGen 生成 DemoGen 自己的展示资产

---

## 十一、开放问题

1. **assistant-ui 的 tool-ui 组件是否足以实现 Agent 可见性需求？** 需要实际测试。如果不够，考虑引入 CopilotKit 的 AG-UI Protocol。
2. **DeepSeek 在 `generateObject` 模式下质量如何？** 需要用真实项目测试。如果不行就切 GPT-4.1 或 Claude。
3. **Orchestrator Agent 用 `streamText` + tools 还是 `ToolLoopAgent`？** 需要看 AI SDK v6 的 ToolLoopAgent 文档确认 API。
4. **PPT 模板设计** — 需要预制好看的 Pandoc 模板。
5. **文件上传** — Next.js 处理文件上传的最佳实践（可能直接用 Supabase Storage）。

---

## 十二、与 v1 PRD 的对照

| 方面 | v1 | v2 |
|---|---|---|
| 架构 | 聊天驱动 | Agent 驱动 |
| 流程控制 | prompt 指令 | 代码 + Agent 逻辑 |
| 输入 | 仅 GitHub 链接 | 链接 + 文档 + 截图 + 描述 |
| AI 调用 | `streamText` + 前端工具 | `generateObject` + `ToolLoopAgent` + subagents |
| 用户体验 | 和 AI 网页聊天类似 | 像 Claude Code 一样看 Agent 工作 |
| UI 交互 | 前端硬编码按钮 | Agent 动态生成 UI（Generative UI） |
| 可见性 | 只看到聊天文字 | 工具调用、进度、状态全可见 |
| 模型 | 全流程一个模型 | 不同 subagent 可用不同模型 |
| 扩展性 | 加功能要改 prompt + 前端 | 加一个 subagent 即可 |
