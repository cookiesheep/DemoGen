# DemoGen 新会话开场白

> 把下面的内容直接粘贴到新的 Claude Code 会话中作为第一条消息。

---

我在开发 DemoGen 项目（D:\code\demogen），这是一个 AI Agent 驱动的项目展示资产生成器。

## 快速恢复上下文

请先读以下文件了解项目全貌：
1. `docs/HANDOFF.md` — 完整的交接文档（架构、文件清单、踩坑记录、待做事项）
2. `docs/DEVELOPMENT-PLAN.md` — 开发计划和已完成阶段
3. `CLAUDE.md` — 项目指令和技术栈

## 当前状态

架构已从"纯 Prompt 驱动"重构为"状态机驱动"（state-machine.ts + route.ts）。
核心设计：代码控制流程，LLM 只负责生成内容。每个状态只暴露 1-3 个工具给 LLM。

最近修复了几个关键 bug：
- UIMessage part 格式：type 是 `"tool-{name}"` 而非 `"tool-invocation"`
- stepCountIs + toolChoice 控制防止废话
- awaiting_scenario/awaiting_assets 跳过 LLM 直接发工具调用
- generating 动态 maxSteps = remaining.length 防止重复调用

## 我需要你做的

[在这里写你需要新会话做的事情，比如：]
- 先运行 npm run dev 帮我测试完整流程
- 清理 route.ts 中的调试日志
- 继续开发 Phase 7（导出+打磨）
- 修复 xxx bug

## 开发偏好

- 中文交流，保留英文术语
- 写代码时加注释让我能看懂
- 每完成一个步骤就 commit
- 不要一次性改太多，一步步来
- 边写代码边讲解原理（我对 Agent 架构很感兴趣）
