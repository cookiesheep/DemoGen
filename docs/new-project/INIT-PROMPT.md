# DemoGen 新会话启动提示词

> 将此内容作为新 Claude Code 会话的第一条消息发送

---

我要开发一个叫 DemoGen 的项目——AI Agent 驱动的项目展示资产生成器。用户提交 GitHub 链接/文档/截图，Agent 自主分析项目并生成讲稿、PPT、One-pager 等展示资产包。

## 项目关键特征

1. **Agent-Native 架构**：不是传统 AI 聊天应用。Orchestrator Agent 驱动流程，通过 subagent 分工完成任务
2. **过程可观察**：用户能看到 Agent 的工具调用、进度、状态（类似 Claude Code 的体验）
3. **结构化输出**：每个 subagent 用 `generateObject` + Zod schema 确保输出格式正确
4. **Generative UI**：Agent 动态生成选项按钮，不是前端硬编码

## 技术栈

- Next.js 16 + TypeScript + App Router
- Vercel AI SDK 6（`ai` package）— Agent 循环 + 工具调用 + 结构化输出
- assistant-ui（`@assistant-ui/react` + `@assistant-ui/react-ai-sdk`）— Agent 面板 UI
- assistant-ui tool-ui（`@assistant-ui/tool-ui`）— 工具调用状态展示组件
- shadcn/ui + Tailwind CSS — 基础 UI
- Zod 4 — Schema 定义
- lucide-react — 图标
- LLM: DeepSeek（通过 @ai-sdk/openai 的 OpenAI 兼容接口）

## 当前任务

请先阅读项目根目录的 CLAUDE.md 了解完整的项目规范和架构设计，然后按照 docs/DEVELOPMENT-PLAN.md 的 Phase 1 开始实施：

1. 项目初始化（create-next-app + 安装依赖）
2. 左右分栏布局
3. 最小 Agent API（streamText + tools + 一个测试工具）
4. Agent 面板（消息 + 工具调用可见）
5. 验证：对话能跑通，工具调用状态用户可见

## 重要注意事项

- AI SDK v6 有很多 breaking changes，CLAUDE.md 里有踩坑记录，编码前务必阅读
- DeepSeek API 必须用 `openai.chat("model")` 而不是 `openai("model")`
- 每完成一个可测试的步骤就 commit
- 中文注释，保留英文术语
- 先跑通再优化，不要过度抽象

## 环境

DeepSeek API Key: （你的key）
Base URL: https://api.deepseek.com
Model: deepseek-chat
