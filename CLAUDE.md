# DemoGen - 项目展示资产编排器

## 项目简介
DemoGen 是一个面向软件项目的展示资产编排器。用户输入 GitHub 仓库/README/截图/已部署 URL，系统通过 AI 引导式对话理解项目，按展示场景生成讲稿、PPT、一页式介绍等资产包。

## 技术栈
- **框架**: Next.js 16 + TypeScript + App Router
- **AI**: Vercel AI SDK 6 (`ai` package) + OpenAI
- **Chat UI**: assistant-ui (`@assistant-ui/react`)
- **UI**: shadcn/ui + Tailwind CSS + lucide-react
- **数据库**: Supabase (Postgres + Auth + Storage)
- **PPT 导出**: Pandoc (Markdown → 可编辑 PPTX)
- **录屏**: Playwright Node.js
- **部署**: Vercel (前端) + Railway (Worker)

## 项目结构
```
src/
  app/                    # Next.js App Router 页面
    api/                  # API Route Handlers
      chat/               # AI 对话接口
      analyze/            # GitHub 仓库解析
      generate/           # 资产生成
      export/             # 导出 PPTX/PDF
    (main)/               # 主应用页面
  components/             # React 组件
    chat/                 # 聊天面板组件
    preview/              # 右侧预览面板组件
    ui/                   # shadcn/ui 基础组件
  lib/                    # 工具函数和配置
    ai/                   # AI 相关 (prompts, schemas, state machine)
    github/               # GitHub API 解析
    export/               # 导出逻辑
  types/                  # TypeScript 类型定义
docs/                     # 项目文档
```

## 开发规范
- 使用中文注释，保留英文术语
- 组件使用函数式组件 + hooks
- API 路由放在 `src/app/api/` 下
- AI 结构化输出使用 Zod schema 定义
- 状态管理使用 React state + context，不引入额外状态库
- 不要过度抽象，先让功能跑通

## 核心架构
产品交互模式是"左聊天右预览"：
- 左侧: assistant-ui 聊天面板，AI 引导用户
- 右侧: 实时预览面板，展示生成的资产（可编辑）

AI 流程使用自定义有限状态机（不用 agent 框架）：
1. 等待输入 → 2. 项目理解 → 3. 补充提问 → 4. 策略确认 → 5. 资产生成 → 6. 编辑优化

## 常用命令
- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run lint` - 运行 ESLint
