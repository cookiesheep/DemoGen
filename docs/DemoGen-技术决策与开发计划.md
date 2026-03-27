# DemoGen 技术决策文档 + 开发计划

> 最后更新：2026-03-28
> 状态：已确认，准备执行

## 一、项目概况

**产品**：DemoGen —— 面向软件项目的展示资产编排器
**团队**：5 人（大二 CS 学生），组长有 Next.js + Supabase 浅经验
**时间**：学期第 4 周 ~ 第 14 周（共 10 周，第 12-13 周为缓冲）
**协作**：微信/飞书沟通 + GitHub 代码托管
**开发模式**：Claude 完成大部分代码编写，每位组员有明确的负责模块和学习目标

---

## 二、技术栈决策（ADR）

### 最终技术栈

| 层 | 技术 | 决策理由 |
|---|---|---|
| **框架** | Next.js 16 + TypeScript | AI 工具生成代码质量最高，文档最全，全栈一体减少协调成本 |
| **AI SDK** | Vercel AI SDK 6 | 流式输出/工具调用/结构化输出开箱即用，23k star，每周更新 |
| **Chat UI** | assistant-ui | YC 投资，9k star，原生集成 AI SDK，省去自建 chat UI 的大量工作 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 复制粘贴式组件，和 v0 生成的代码天然兼容 |
| **数据库** | Supabase (Postgres + Auth + Storage) | 免费层够用，组长有经验，一站式解决认证/存储 |
| **PPT 生成** | Pandoc (可编辑 PPTX) + Slidev (网页预览) | Pandoc 一行命令出可编辑 PPTX；Slidev 做实时预览 |
| **录屏** | Playwright Node.js | 与主栈一致，录屏/截图 API 成熟 |
| **部署** | Vercel (前端+轻后端) + Railway/Render (重任务 worker) | Vercel 免费一键部署；录屏等长任务单独 worker |
| **LLM** | OpenAI GPT-4.1 Nano (~$0.009/次) 为主，可切换 DeepSeek 降成本 | Vercel AI SDK 一行切换 provider；结构化输出 OpenAI 最稳 |
| **脚手架** | v0.dev | 快速生成初始页面骨架，导出后团队在此基础上改 |

### 明确不用的技术

| 技术 | 不用的原因 |
|---|---|
| CopilotKit | 29k star 但零独立评测，"框架上的框架"，团队无 React 基础时风险太高 |
| LangGraph / CrewAI | 太重，DemoGen 的流程用状态机就够 |
| DeerFlow | 后端 agent 执行底座，不是前台产品框架 |
| Marp 做 PPTX | PPTX 导出是图片不可编辑（已验证） |
| Streamlit / Gradio | 无法实现"左聊天右预览"的产品交互 |

### Agent 实现方式

**不使用任何 agent 框架。** 用 Vercel AI SDK 的 `streamText` + `generateObject` + 自定义有限状态机实现：

```
状态 1: 等待输入 → 用户提交 repo/README/截图
状态 2: 项目理解 → AI 分析并输出结构化理解卡片
状态 3: 补充提问 → AI 判断缺什么信息，向用户提问 1-2 轮
状态 4: 策略确认 → AI 推荐展示策略，用户确认/修改
状态 5: 资产生成 → 按策略生成讲稿/PPT/one-pager
状态 6: 编辑优化 → 用户在右侧预览区编辑，可要求 AI 重写局部
```

每个状态的 AI 输出都是结构化 JSON（通过 Zod schema 约束），前端根据 JSON 渲染对应 UI。

---

## 三、产品架构

```
┌──────────────────────────────────────────────────┐
│                    前端 (Next.js)                  │
│  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  Chat Panel      │  │  Preview Panel         │ │
│  │  (assistant-ui)  │  │  · 项目理解卡片         │ │
│  │                  │  │  · 讲稿 (Markdown)      │ │
│  │  AI 引导式对话    │  │  · PPT 预览 (Slidev)   │ │
│  │  状态指示器       │  │  · One-pager (HTML)    │ │
│  │  文件上传         │  │  · 录屏视频 (可选)      │ │
│  └─────────────────┘  └────────────────────────┘ │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────┐
│              API Layer (Next.js Route Handlers)    │
│  · /api/chat — AI 对话 (streamText)               │
│  · /api/analyze — 仓库解析 (GitHub API)           │
│  · /api/generate — 资产生成 (generateObject)       │
│  · /api/export — 导出 PPTX/PDF (Pandoc)           │
│  · /api/record — 触发录屏任务                      │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────┐
│              外部服务                              │
│  · Supabase: 用户认证 + 项目数据 + 文件存储        │
│  · OpenAI API: LLM 调用                           │
│  · GitHub API: 仓库解析                            │
│  · Worker 服务: Playwright 录屏 (Railway/Render)   │
└──────────────────────────────────────────────────┘
```

---

## 四、核心功能优先级

### 必做（决定成败的 3 个核心功能）

1. **GitHub 项目理解 + AI 引导式问答**
   - 输入 repo 链接/README → AI 输出结构化理解卡片
   - AI 补充提问 1-2 轮 → 确认展示策略

2. **右侧实时资产预览 + 可编辑**
   - 讲稿（Markdown 编辑器）
   - PPT 大纲（Slidev 预览 或 结构化卡片）
   - One-pager（HTML 预览）

3. **两种高质量资产导出**
   - 讲稿导出（Markdown/PDF）
   - PPT 导出（Pandoc → 可编辑 PPTX）

### 加分项（做完必做后再碰）

4. Playwright 录屏（仅已部署 Web URL）
5. 社媒宣传文案版本
6. GitHub README 增强版本

### 不做

- 自动运行任意 GitHub 仓库
- 复杂多 agent 编排
- 全自动 UI 探索
- 海报/图片生成

---

## 五、10 周开发计划

### 第 4 周（当前周）—— 基建与学习

**全队**：
- 统一开发环境：Node.js 20+, VS Code/Cursor, Git
- 每人完成 Next.js 官方教程前 3 章
- 组长用 v0.dev 生成 DemoGen 初始页面骨架并导出到 GitHub

**具体任务**：

| 人 | 任务 | 学习目标 |
|---|---|---|
| 组长 | v0 生成骨架 + GitHub repo 初始化 + Supabase 项目创建 | 项目搭建、团队协作流程 |
| 成员 A | 跑通 Vercel AI SDK 的 `useChat` 示例 | 理解流式 AI 交互 |
| 成员 B | 用 GitHub REST API 拿一个 repo 的 README 和目录树 | 理解 API 调用 |
| 成员 C | 跑通 Pandoc markdown→PPTX + 研究 Slidev 基础 | 理解资产渲染流程 |
| 成员 D | 跑通 Playwright 截图 + 录屏示例 | 理解浏览器自动化 |

**本周产出**：GitHub repo 初始化完成，每人完成各自技术验证 demo

---

### 第 5 周 —— 核心页面 + AI 对话接通

**目标**：能在页面上和 AI 聊天，输入 repo 链接后 AI 返回结构化分析

| 人 | 任务 |
|---|---|
| 组长 | 集成 assistant-ui 到项目，搭建左右双栏布局 |
| 成员 A | 实现 `/api/chat` 路由，接通 OpenAI，实现流式对话 |
| 成员 B | 实现 `/api/analyze`，输入 GitHub URL → 返回 README + 目录树 + package.json |
| 成员 C | 设计"项目理解卡片"组件（展示项目类型/功能/亮点/风险） |
| 成员 D | 设计数据库 schema（用户、项目、生成记录）并在 Supabase 创建 |

**本周产出**：输入 repo → AI 返回项目摘要 → 右侧显示理解卡片

---

### 第 6 周 —— 状态机 + 展示策略

**目标**：AI 能根据项目类型推荐展示策略，用户能选择目标场景

| 人 | 任务 |
|---|---|
| 组长 | 实现前端状态机（理解→提问→策略→生成），控制页面流转 |
| 成员 A | 完善 AI prompt：补充提问逻辑 + 结构化输出 (Zod schema) |
| 成员 B | 实现项目分类逻辑（Web/CLI/API/Agent 等）+ 策略映射 |
| 成员 C | 做"目标场景选择"UI（答辩/作品集/社媒）+ "展示策略卡片" |
| 成员 D | 实现截图上传功能（Supabase Storage）+ 用户补充说明输入 |

**本周产出**：完整的"输入→理解→提问→策略推荐"闭环

---

### 第 7 周 —— 资产生成（核心冲刺）

**目标**：能生成讲稿 + PPT 大纲，右侧实时预览

| 人 | 任务 |
|---|---|
| 组长 | 实现 `/api/generate`，编排多步 AI 生成（讲稿 → PPT → one-pager） |
| 成员 A | 实现讲稿生成 prompt + 右侧 Markdown 预览组件 |
| 成员 B | 实现 PPT 大纲生成 prompt + 结构化 JSON → 卡片式预览 |
| 成员 C | 实现 one-pager 生成 + HTML 预览组件 |
| 成员 D | 实现资产保存到数据库 + 历史记录列表页 |

**本周产出**：输入 repo → 全流程 → 右侧显示讲稿 + PPT 大纲 + one-pager

---

### 第 8 周 —— 可编辑 + 导出

**目标**：用户能编辑资产，能导出 PPTX 和 PDF

| 人 | 任务 |
|---|---|
| 组长 | 实现"局部重写"功能（用户选中一段 → AI 重写） |
| 成员 A | 集成 Markdown 编辑器（讲稿可编辑） |
| 成员 B | 实现 Pandoc 导出：Markdown → PPTX（设计一个基础模板） |
| 成员 C | 实现 PDF 导出（one-pager → PDF） |
| 成员 D | 实现导出下载 API + 前端下载按钮 + loading 状态 |

**本周产出**：生成的资产可编辑、可导出为 PPTX/PDF

---

### 第 9 周 —— 录屏（加分项）+ 打磨

**目标**：对已部署 URL 能生成简单录屏；整体 UI 打磨

| 人 | 任务 |
|---|---|
| 组长 | 实现录屏 worker 服务（Playwright 访问 URL → 录制 → 返回视频） |
| 成员 A | 录屏任务状态管理（排队/进行中/完成/失败） |
| 成员 B | 录屏结果展示组件 + 失败退化提示 |
| 成员 C | UI 整体打磨：loading 状态、错误提示、空状态 |
| 成员 D | Supabase Auth 集成（简单登录/注册） |

**本周产出**：录屏 demo 跑通；产品整体可用性提升

---

### 第 10 周 —— 端到端测试 + bug 修复

**目标**：用 3-5 个真实 GitHub 项目跑完整流程，修复问题

| 人 | 任务 |
|---|---|
| 全队 | 每人找 1 个真实 GitHub 项目作为测试用例 |
| 组长 | 汇总问题 + 排优先级 + 修复核心 bug |
| 成员 A | 修复 AI 输出质量问题（调 prompt） |
| 成员 B | 修复导出问题 |
| 成员 C | 修复 UI 问题 |
| 成员 D | 修复录屏 / 部署问题 |

**本周产出**：3-5 个项目能稳定走完全流程

---

### 第 11 周 —— 部署 + 演示准备

**目标**：线上版本稳定可用，准备答辩材料

| 人 | 任务 |
|---|---|
| 组长 | 最终部署到 Vercel（前端）+ Railway（worker），确保线上稳定 |
| 成员 A | 用 DemoGen 生成 DemoGen 自己的展示资产（meta-demo） |
| 成员 B | 准备答辩 PPT |
| 成员 C | 录制产品演示视频（备用，防止现场翻车） |
| 成员 D | 写项目文档（技术架构、使用说明） |

**本周产出**：线上可访问 + 答辩材料齐全

---

### 第 12-13 周 —— 缓冲 + 答辩

预留 2 周作为缓冲，处理：
- 延期的功能
- 最后发现的 bug
- 答辩材料完善
- 期末考试准备

---

## 六、5 人角色分工

| 角色 | 人 | 核心职责 | 学到什么 |
|---|---|---|---|
| **项目负责人 + 架构** | 组长（你） | 项目搭建、架构设计、状态机、AI 编排、录屏 worker | 全栈架构、AI 产品编排、项目管理 |
| **AI 交互工程师** | 成员 A | AI 对话流、prompt 工程、流式输出、结构化输出 | LLM API 使用、prompt engineering |
| **数据与集成工程师** | 成员 B | GitHub API 解析、数据库、资产导出(Pandoc) | API 集成、数据处理、后端服务 |
| **前端体验工程师** | 成员 C | UI 组件、预览面板、交互状态、视觉打磨 | React 组件开发、前端状态管理 |
| **基础设施工程师** | 成员 D | 数据库 schema、Auth、部署、Playwright、文件存储 | DevOps、自动化、系统集成 |

### 协作规则

1. **每周一次全队同步**（飞书/微信，30 分钟），对齐进度和问题
2. **GitHub 分支策略**：`main`（稳定）← `dev`（开发）← 个人 feature 分支
3. **Claude 的角色**：组长通过 Claude 完成主要代码编写，然后拆成 PR 让组员 review + 理解 + 小改。组员各自负责的模块也可以借助 AI 工具（Cursor/Claude）完成
4. **代码 Review**：每个 PR 至少 1 人 review 后才合并

---

## 七、风险与应对

| 风险 | 概率 | 应对 |
|---|---|---|
| React/Next.js 学习卡住 | 高 | 第 4 周专门学习 + v0 生成骨架降低门槛 + Claude 写主要代码 |
| AI 输出质量差（像总结器） | 中 | 第 7-8 周专门调 prompt，用真实项目反复测试 |
| 录屏不稳定 | 高 | 录屏是加分项，失败则退化为截图 + 图文 |
| 导出 PPTX 排版丑 | 中 | 准备 2-3 个 Pandoc 模板，选最好看的 |
| Vercel serverless 超时 | 中 | 长任务（录屏、大仓库解析）单独 worker |
| 组员参与度不均 | 中 | 每人有明确可验收的产出物，周会同步 |

---

## 八、验证计划

### MVP 验收标准（第 10 周末）

- [ ] 输入 3 个不同类型的 GitHub 项目（Web App / CLI / API），都能稳定生成资产包
- [ ] 生成的讲稿读起来像"有经验的学长写的"，不像 AI 废话
- [ ] PPT 导出为可编辑 PPTX，能用 PowerPoint 打开并修改
- [ ] 右侧预览区能实时显示，用户能编辑后触发局部重生成
- [ ] 至少 1 个已部署 URL 能生成录屏视频（加分项）

### 答辩演示策略

**用 DemoGen 生成 DemoGen 自己的展示资产（meta-demo）**，同时准备：
1. 一个提前录好的演示视频（防翻车）
2. 现场演示一个新的 GitHub 项目输入（展示实时能力）
3. 导出的 PPTX 作为答辩 PPT 的一部分（展示真实产出）

---

## 九、关键技术验证清单（第 4 周完成）

每项验证都是独立的小 demo，证明该技术路线可行：

- [ ] `create-next-app` + TypeScript + Tailwind + shadcn/ui 跑通
- [ ] Vercel AI SDK `useChat` + OpenAI 流式对话跑通
- [ ] assistant-ui 组件集成到 Next.js 跑通
- [ ] GitHub REST API 拿到 repo README + 目录树
- [ ] `generateObject` + Zod schema 返回结构化 JSON
- [ ] Pandoc 把 Markdown 转成可编辑 PPTX
- [ ] Playwright 截图 + 录屏跑通
- [ ] Supabase 建表 + 读写数据跑通
- [ ] Vercel 部署跑通
