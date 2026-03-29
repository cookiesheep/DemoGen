# DemoGen 开发交接文档

> 新会话开场白：将本文件内容直接贴给 Claude Code 即可恢复上下文。

---

## 项目概述

DemoGen 是一个 AI Agent 驱动的项目展示资产生成器。用户提交 GitHub 链接/文档/描述 → Agent 分析项目 → 选择展示场景 → 生成策略 → 生成讲稿/PPT/One-pager。

代码目录：`D:\code\demogen`
技术栈：Next.js 16 + Vercel AI SDK 6 + assistant-ui + Tailwind CSS 4

## 当前架构：状态机驱动

### 核心文件
| 文件 | 作用 |
|------|------|
| `src/lib/ai/state-machine.ts` | 状态推导纯函数，从消息历史推导 6 个状态 |
| `src/app/api/agent/route.ts` | API 入口，根据状态选工具+prompt，部分状态跳过 LLM |
| `src/lib/ai/prompts.ts` | 状态专用 prompt（STATE_PROMPTS）+ Subagent prompt |
| `src/lib/ai/client.ts` | 共享 LLM 客户端 |
| `src/lib/ai/schemas.ts` | 所有 Zod schema |
| `src/lib/ai/revise.ts` | 资产修改函数 |
| `src/lib/ai/subagents/*.ts` | 5 个 Subagent（analysis/strategy/script/ppt/onepager） |

### 前端组件
| 文件 | 作用 |
|------|------|
| `src/components/agent/thread.tsx` | 消息线程，注册工具渲染组件 |
| `src/components/agent/tool-call-display.tsx` | 工具调用行为卡片（人类可读） |
| `src/components/agent/choice-selector.tsx` | askUserChoice 的选择按钮组 |
| `src/components/agent/asset-selector.tsx` | confirmAssets 的多选 checkbox |
| `src/components/agent/input-area.tsx` | 多模态输入区 |
| `src/components/agent/markdown-text.tsx` | Markdown 渲染 |
| `src/components/preview/preview-context.tsx` | 资产状态 Context |
| `src/components/preview/preview-panel.tsx` | 右侧预览面板 |
| `src/components/preview/script-preview.tsx` | 讲稿预览/编辑 |
| `src/components/preview/ppt-preview.tsx` | PPT 大纲预览/编辑 |
| `src/components/preview/onepager-preview.tsx` | One-pager 预览/编辑 |

### 状态机流转
```
analyzing (LLM调analyzeProject)
  → awaiting_scenario (代码直接发askUserChoice，不走LLM)
    → planning (LLM调planStrategy)
      → awaiting_assets (代码直接发confirmAssets，不走LLM)
        → generating (LLM调generateScript/PPT/OnePager，maxSteps=remaining.length)
          → editing (LLM可调reviseAsset，toolChoice:auto)
```

### 关键踩坑记录（必读）
1. **UIMessage part 格式**：`part.type` 是 `"tool-analyzeProject"`（不是 `"tool-invocation"`），字段 `toolCallId/state/input/output` 直接在 part 上
2. **stepCountIs(N)**：N 是最大步数，工具完成后 LLM 还有剩余步数会输出废话。单工具状态必须 `stepCountIs(1)`
3. **toolChoice:"required"**：强制调工具。editing 状态用 `"auto"`（用户可能只是聊天）
4. **generating 动态 maxSteps**：`maxSteps = remaining.length`，防止重复调用
5. **createUIMessageStream**：用于跳过 LLM 直接发工具调用给前端

## 当前待确认/待做

### 待确认
- [ ] 最新的 generating 修复（maxSteps=remaining.length）是否解决了重复调用
- [ ] 全流程端到端测试是否通过
- [ ] route.ts 中的调试日志（[DEBUG]）需要在确认无问题后清理

### 待做（按优先级）
1. 清理调试日志
2. 端到端测试 3-5 个 GitHub 项目
3. Phase 7：导出功能（Markdown 下载已有，PDF/PPTX 待做）
4. UI 打磨（loading 状态、错误处理）
5. Vercel 部署

## 环境变量（.env.local）
```
OPENAI_API_KEY=sk-UXba3Rm3ZOWr7PWEn3KbPsWeMyeWwIw0ZsylSMkIb6CfQhTS
OPENAI_BASE_URL=https://www.packyapi.com/v1
OPENAI_MODEL=gpt-5.4
```

## 常用命令
```bash
npm run dev    # 开发服务器
npm run build  # 构建（含 TypeScript 类型检查）
```

## 开发规范
- 中文注释，保留英文技术术语
- 代码注释让用户（大二学生）能看懂
- 修改代码时边写边讲解原理
- 每完成一个可测试的步骤就 git commit
- 不要一次性改太多东西
