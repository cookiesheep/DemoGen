# DemoGen - AI Agent 驱动的项目展示资产生成器

## 项目简介

DemoGen 帮助开发者快速生成项目展示资产（讲稿、PPT、One-pager）。用户提交 GitHub 链接/文档/截图，AI Agent 自主分析项目并生成展示资产包。

**核心特征**：不是套壳 AI 聊天，而是有执行力的 Agent —— 用户能看到 Agent 在做什么（调用工具、分析数据、生成内容），可以随时干预。

## 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 框架 | Next.js + TypeScript | 16.x | 全栈，App Router |
| Agent 引擎 | Vercel AI SDK | 6.x (`ai` package) | Agent 循环、工具调用、结构化输出 |
| Agent UI | assistant-ui | `@assistant-ui/react` | 聊天面板、流式消息 |
| Agent 可见性 | assistant-ui tool-ui | `@assistant-ui/tool-ui` | 工具调用展示、Plan/Progress 组件 |
| AI SDK 集成 | assistant-ui AI SDK | `@assistant-ui/react-ai-sdk` | 连接 AI SDK runtime |
| UI 组件 | shadcn/ui + Tailwind CSS | 4.x | 基础 UI |
| 图标 | lucide-react | — | 图标库 |
| Schema | Zod | 4.x | AI 结构化输出约束 |
| LLM | DeepSeek（默认）/ OpenAI / Claude | — | 通过 `@ai-sdk/openai` 适配 |
| PPT 导出 | Pandoc（后期） | — | Markdown → 可编辑 PPTX |

## 项目结构

```
src/
  app/
    page.tsx                    # 主页面（左右分栏布局）
    layout.tsx                  # 根布局
    api/
      agent/route.ts            # 主 Agent API 入口（唯一的 AI 接口）
      upload/route.ts           # 文件上传接口
      export/
        pptx/route.ts           # PPTX 导出（后期）
        pdf/route.ts            # PDF 导出（后期）
  components/
    agent/                      # Agent 面板相关组件
      agent-panel.tsx           # 左侧 Agent 面板（消息 + 工具调用 + 进度）
      tool-call-display.tsx     # 工具调用状态展示
      choice-selector.tsx       # Agent 动态生成的选项按钮
      input-area.tsx            # 输入区（链接 + 文件上传 + 文字）
    preview/                    # 右侧资产预览相关
      preview-panel.tsx         # 右侧主面板
      asset-dock.tsx            # 底部资产切换栏（类 macOS Dock）
      project-card.tsx          # 项目理解卡片
      strategy-card.tsx         # 展示策略卡片
      script-preview.tsx        # 讲稿预览（Markdown）
      ppt-preview.tsx           # PPT 大纲预览
      onepager-preview.tsx      # One-pager 预览
    ui/                         # shadcn/ui 基础组件
  lib/
    ai/
      orchestrator.ts           # Orchestrator Agent 定义（核心）
      subagents/
        analysis.ts             # Analysis Subagent（项目理解）
        strategy.ts             # Strategy Subagent（策略规划）
        script-writer.ts        # 讲稿生成 Subagent
        ppt-architect.ts        # PPT 大纲 Subagent
        onepager-designer.ts    # One-pager Subagent
      schemas.ts                # 所有 Zod Schema 定义
      prompts.ts                # System Prompt 集合
    github/
      analyzer.ts               # GitHub API 解析
    upload/
      parser.ts                 # 上传文件解析（Markdown/PDF/图片）
  types/
    index.ts                    # 全局类型定义
```

## 核心架构

### Agent 编排模式

采用 Orchestrator + Subagent 模式：

```
Orchestrator Agent（主 Agent）
  ├─ 工具: analyzeProject    → 内部调用 Analysis Subagent
  ├─ 工具: planStrategy      → 内部调用 Strategy Subagent
  ├─ 工具: generateScript    → 内部调用 Script Writer Subagent
  ├─ 工具: generatePPT       → 内部调用 PPT Architect Subagent
  ├─ 工具: generateOnePager  → 内部调用 One-pager Subagent
  └─ 工具: askUserChoice     → 前端工具，动态展示选项按钮
```

每个 subagent 是 Orchestrator 工具的 `execute` 函数内部的一次 `generateObject` 或 `streamText` 调用，拥有独立的 system prompt 和 schema。

### AI 调用方式

- **结构化输出**用 `generateObject()`：项目理解、策略推荐、PPT 大纲、One-pager
- **长文本生成**用 `streamText()`：讲稿（需要流式输出给用户实时看到）
- **Orchestrator** 用 `streamText()` + tools + `stopWhen`：驱动整个流程

### 前端渲染

- Orchestrator 的工具调用结果通过 assistant-ui 的 `makeAssistantToolUI` 渲染
- 每个工具调用有对应的 UI 组件，显示状态（running/complete/error）
- 结构化输出直接渲染为右侧的卡片/预览

## 开发规范

- 中文注释，保留英文技术术语
- 每个文件头部加注释说明用途
- 组件使用函数式组件 + hooks
- AI 结构化输出必须用 Zod schema 定义
- 不要过度抽象，先让功能跑通
- 每完成一个可测试的步骤就 commit
- Git 分支策略：main（稳定）← dev（开发）← feature/xxx

## 环境变量

```
OPENAI_API_KEY=         # DeepSeek 或 OpenAI 的 API Key
OPENAI_BASE_URL=        # DeepSeek: https://api.deepseek.com
OPENAI_MODEL=           # 默认: deepseek-chat
```

## 常用命令

- `npm run dev` — 启动开发服务器
- `npm run build` — 构建（含 TypeScript 类型检查）
- `npm run lint` — ESLint 检查

## 重要注意事项

### AI SDK v6 的 API 变化（踩坑记录）

这些是 v5 → v6 的 breaking changes，编码时必须注意：

1. **工具定义用 `inputSchema` 不是 `parameters`**
   ```typescript
   // ✅ 正确
   tool({ inputSchema: z.object({ url: z.string() }), execute: ... })
   // ❌ 错误
   tool({ parameters: z.object({ url: z.string() }), execute: ... })
   ```

2. **工具调用参数用 `input` 不是 `args`**
   ```typescript
   // ✅ toolCall.input
   // ❌ toolCall.args
   ```

3. **多步工具调用用 `stopWhen` 不是 `maxSteps`**
   ```typescript
   import { stepCountIs } from "ai";
   streamText({ ..., stopWhen: stepCountIs(10) })
   ```

4. **消息格式转换必须用 `convertToModelMessages`**
   ```typescript
   import { convertToModelMessages } from "ai";
   const modelMessages = await convertToModelMessages(messages);
   ```

5. **模型创建用 `openai.chat("model")` 不是 `openai("model")`**
   — `openai("model")` 会走 Responses API，DeepSeek 不支持

6. **流式响应用 `toUIMessageStreamResponse()` 不是 `toDataStreamResponse()`**

7. **`onToolCall` 回调返回值必须是 void**

### DeepSeek API 兼容性

DeepSeek 使用 OpenAI 兼容接口，通过 `@ai-sdk/openai` 配置：
- base URL: `https://api.deepseek.com`
- 必须用 `openai.chat()` 而不是 `openai()`
- 支持 `generateObject` 的结构化输出（Zod schema）

### assistant-ui 工具 UI

使用 `@assistant-ui/tool-ui` 展示工具调用状态：
- 安装组件：`npx shadcn@latest add @tool-ui/plan @tool-ui/progress-tracker`
- `makeAssistantToolUI` 可为每个工具自定义渲染组件
- 状态类型：`running` | `complete` | `incomplete` | `requires_action`
