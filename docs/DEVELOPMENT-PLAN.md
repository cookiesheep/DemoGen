# DemoGen v2 开发计划

## 开发阶段概览

| 阶段 | 内容 | 预计产出 |
|------|------|----------|
| Phase 1 | 项目初始化 + 最小 Agent 对话 | Agent 能对话、能调工具、用户能看到工具调用 |
| Phase 2 | GitHub 分析 + 项目理解卡片 | 输入链接 → Agent 自动分析 → 右侧显示卡片 |
| Phase 3 | 多输入 + 场景选择 + 策略推荐 | 支持文件上传、Agent 动态展示选项、策略卡片 |
| Phase 4 | 资产生成（讲稿 + PPT 大纲） | 讲稿流式预览 + PPT 大纲卡片 + 资产 Dock 栏 |
| Phase 5 | 编辑 + 导出 | 讲稿可编辑、PPT 导出 PPTX、PDF 导出 |
| Phase 6 | 打磨 + 测试 + 部署 | 3-5 个真实项目测试、bug 修复、Vercel 部署 |

---

## Phase 1: 项目初始化 + 最小 Agent 对话

### 目标
搭建项目骨架，实现一个能对话、能调用工具、工具调用过程可见的 Agent。

### 步骤

#### 1.1 项目初始化
- `npx create-next-app@latest demogen --typescript --tailwind --app --src-dir`
- 安装依赖：
  ```bash
  npm install ai @ai-sdk/openai @assistant-ui/react @assistant-ui/react-ai-sdk zod lucide-react
  ```
- 安装 shadcn/ui：`npx shadcn@latest init`
- 安装 tool-ui 组件（按需）：`npx shadcn@latest add @tool-ui/progress-tracker`
- 配置 `.env.local`（DeepSeek API）
- 将 CLAUDE.md 放到项目根目录
- 配置 layout.tsx（中文 lang、系统字体）

#### 1.2 左右分栏布局
- `page.tsx`：左侧 Agent 面板 + 右侧预览面板
- 左侧占 2/5 宽度，右侧 flex-1
- 先用空壳组件

#### 1.3 最小 Agent API（`/api/agent/route.ts`）
- 使用 `streamText` + `tools` + `stopWhen: stepCountIs(10)`
- Orchestrator system prompt（简单版，先只支持对话）
- 定义一个测试工具（如 `getCurrentTime`），验证工具调用能跑通
- 返回 `toUIMessageStreamResponse()`

#### 1.4 Agent 面板（`agent-panel.tsx`）
- 使用 `useChatRuntime` 连接 `/api/agent`
- 使用 assistant-ui 的 `ThreadPrimitive` 渲染消息
- 使用 `makeAssistantToolUI` 为测试工具自定义渲染组件
- 验证：工具调用时用户能看到"🔧 getCurrentTime — running..." → "✅ complete"

#### 1.5 验证 & 提交
- `npm run build` 通过
- 能对话、工具调用可见
- git commit

---

## Phase 2: GitHub 分析 + 项目理解卡片

### 目标
输入 GitHub 链接，Agent 自动调用 GitHub API 分析仓库，生成项目理解卡片显示在右侧。

### 步骤

#### 2.1 GitHub 分析器（`lib/github/analyzer.ts`）
- `parseGitHubUrl(url)` — 解析 owner/repo
- `analyzeRepo(owner, repo)` — 并行获取 README、目录树、package.json、仓库信息
- 纯工具函数，不依赖 AI

#### 2.2 项目理解 Schema（`lib/ai/schemas.ts`）
- `projectUnderstandingSchema`：name/summary/type/targetUsers/coreFeatures/highlights/techStack/risks
- `projectTypeEnum`：web-app/api-service/cli-tool/data-viz/ai-service/agent-workflow/library/algorithm/other

#### 2.3 Analysis Subagent（`lib/ai/subagents/analysis.ts`）
- 导出一个函数 `analyzeProject(repoData)`
- 内部调用 `generateObject` + `projectUnderstandingSchema`
- 专属 system prompt 引导 AI 做结构化分析

#### 2.4 Orchestrator 增加 `analyzeProject` 工具
- 工具 execute 函数：调用 GitHub API → 调用 Analysis Subagent → 返回结构化结果
- 工具调用过程 UI 可见

#### 2.5 项目理解卡片（`components/preview/project-card.tsx`）
- 展示项目类型标签、一句话总结、核心功能、亮点、技术栈、风险
- 接收结构化数据作为 props

#### 2.6 右侧预览面板（`components/preview/preview-panel.tsx`）
- 从 Agent 工具调用结果获取数据，渲染 ProjectCard
- 使用 `makeAssistantToolUI` 将 `analyzeProject` 工具的结果渲染为卡片

#### 2.7 验证 & 提交
- 输入 GitHub 链接 → Agent 自动分析（过程可见）→ 右侧显示卡片
- git commit & push

---

## Phase 3: 多输入 + 场景选择 + 策略推荐

### 目标
支持文件上传和文字输入，Agent 动态展示场景选项，生成展示策略卡片。

### 步骤

#### 3.1 输入区组件（`components/agent/input-area.tsx`）
- 支持：粘贴链接、上传文件（.md/.txt/.pdf）、文字描述
- 已添加文件列表展示
- "开始分析"按钮

#### 3.2 文件上传 API（`/api/upload/route.ts`）
- 接收上传文件，解析内容（Markdown 直读、PDF 提取文本）
- 返回解析后的文本

#### 3.3 Analysis Subagent 支持多输入
- 修改分析函数，接收 { githubData?, documents?, description? }
- 综合所有输入材料生成项目理解

#### 3.4 策略推荐 Schema + Subagent
- `displayStrategySchema`：scenario/audienceProfile/recommendedAssets/emphasisPoints/estimatedStructure/totalDuration
- Strategy Subagent：`generateObject` + schema

#### 3.5 Agent 动态选项（Generative UI）
- Orchestrator 的 `askUserChoice` 工具：前端工具，无 execute
- 使用 `makeAssistantToolUI` 渲染为按钮组
- Agent 分析完后调用此工具展示场景选项
- 用户点击后结果返回给 Agent

#### 3.6 策略卡片（`components/preview/strategy-card.tsx`）
- 场景标签 + 总时长 + 观众画像 + 推荐资产 + 重点 + 结构时间线

#### 3.7 验证 & 提交
- GitHub 链接 / 文档上传 / 文字描述 → Agent 分析 → 场景选择按钮 → 策略卡片
- git commit & push

---

## Phase 4: 资产生成（讲稿 + PPT 大纲）

### 目标
Agent 根据策略自动生成讲稿和 PPT 大纲，右侧实时预览，资产 Dock 切换。

### 步骤

#### 4.1 讲稿 Subagent（`lib/ai/subagents/script-writer.ts`）
- 使用 `streamText`（流式输出，用户实时看到）
- 专属 prompt 引导写出"像有经验的学长写的"讲稿

#### 4.2 PPT 大纲 Subagent（`lib/ai/subagents/ppt-architect.ts`）
- 使用 `generateObject` + `pptOutlineSchema`
- 输出：每页标题/要点/备注

#### 4.3 资产 Dock 栏（`components/preview/asset-dock.tsx`）
- 底部图标栏，显示所有资产类型
- 已生成的高亮，生成中有 loading 动画，未生成灰色
- 点击切换右侧预览内容

#### 4.4 讲稿预览（`components/preview/script-preview.tsx`）
- Markdown 渲染
- 流式实时更新

#### 4.5 PPT 预览（`components/preview/ppt-preview.tsx`）
- 卡片式展示每一页的标题和要点

#### 4.6 验证 & 提交
- 全流程：输入 → 分析 → 场景 → 策略 → 讲稿 + PPT 自动生成
- git commit & push

---

## Phase 5: 编辑 + 导出

### 步骤
- 讲稿 Markdown 编辑器
- PPT 通过 Pandoc 导出 PPTX
- PDF 导出
- 聊天式修改（用户在聊天中说"修改讲稿第3段"，Agent 理解并重生成）

---

## Phase 6: 打磨 + 测试 + 部署

### 步骤
- 3-5 个真实 GitHub 项目端到端测试
- UI 打磨（loading 状态、错误处理、空状态）
- Vercel 部署
- 准备答辩材料
