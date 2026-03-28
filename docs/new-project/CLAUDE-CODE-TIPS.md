# Claude Code 高效开发技巧

> 给团队的 Claude Code 使用指南，帮助大家写出更高质量的代码

---

## 核心原则

### 1. CLAUDE.md 是灵魂

每个项目根目录的 `CLAUDE.md` 是 Claude Code 每次对话自动加载的指令文件。写好它 = 后续每次交互都更高效。

**必须包含的内容**：
- 项目简介（一段话）
- 技术栈和版本号
- 项目目录结构
- 核心架构说明
- 开发规范
- **踩坑记录**（极其重要——API 的 breaking changes、特殊配置）
- 常用命令

**不要包含**：
- 长篇教程或文档
- 不相关的历史信息

### 2. 小步快跑，频繁验证

```
❌ 错误做法：
"帮我实现整个 Phase 2"
→ 一次性生成大量代码，出错难以定位

✅ 正确做法：
"先实现 GitHub URL 解析函数 parseGitHubUrl，写完后 build 验证"
→ 小步骤，每步都验证，错误即时发现
```

### 3. 给 Claude Code 明确的上下文

```
❌ 模糊：
"帮我写一个分析功能"

✅ 明确：
"在 src/lib/ai/subagents/analysis.ts 中实现 analyzeProject 函数。
输入：GitHub 仓库数据（类型参考 lib/github/analyzer.ts 的返回值）
输出：使用 generateObject + projectUnderstandingSchema（定义在 lib/ai/schemas.ts）
参考 CLAUDE.md 中的 AI SDK v6 注意事项"
```

### 4. 报错时给完整信息

```
❌ "报错了"

✅ "npm run build 失败，错误信息：
Type error: Property 'args' does not exist on type 'ToolCall'
在 src/app/page.tsx:40:32"
```

## 实用提示词模板

### 初始化项目
```
按照 CLAUDE.md 的技术栈初始化项目：
1. create-next-app
2. 安装所有依赖
3. 配置 .env.local
4. 验证 npm run dev 能启动
每一步完成后告诉我状态
```

### 实现某个模块
```
实现 [模块名]，文件路径：[路径]

功能：[具体描述]
输入：[什么数据]
输出：[什么格式]
依赖：[用到哪些已有模块]

参考 CLAUDE.md 中的 [具体章节]

完成后 npm run build 验证
```

### 调试错误
```
[粘贴完整错误信息]

这个错误出现在 [操作描述] 时。
相关文件：[文件路径]
我已经尝试了 [你做过的尝试]
```

### 代码审查
```
请审查 [文件路径] 的代码：
1. 是否符合 CLAUDE.md 的开发规范
2. 是否有 AI SDK v6 的 API 误用
3. 是否有明显的 bug 或安全问题
不要做无关的优化，只看上面 3 点
```

## 会话管理

### 什么时候开新会话

- 一个 Phase 完成后（context 干净 = 代码质量高）
- 上下文明显变长变慢时
- 切换到完全不同的模块时

### 什么时候继续当前会话

- 正在调试一个 bug（需要上下文）
- 一个 Phase 内的连续步骤
- 需要参考刚才生成的代码

### 跨会话传递信息

1. **CLAUDE.md 是主渠道**：踩坑经验、API 变化、新的规范都更新到 CLAUDE.md
2. **git commit 消息**：写清楚每次提交做了什么
3. **向指导会话（本会话）报告**：遇到困难或完成阶段时，把关键信息发回来

## 避坑指南

### 不要一次改太多文件
Claude Code 一次修改 5+ 文件时容易出错。如果一个步骤涉及多个文件，拆成小步。

### 不要让 Claude Code 猜 API
如果不确定某个库的 API（尤其是 AI SDK v6 这种新版本），先让它 grep node_modules 查看类型定义，再写代码。

### build 失败时先看错误再修
不要说"帮我修一下"——Claude Code 可能会做一堆无关的修改。先把错误信息给它，让它针对性修复。

### 不要省略 .env 配置
每次新项目都要确认 .env.local 正确配置。DeepSeek 的 base URL 和 model 名容易忘。
