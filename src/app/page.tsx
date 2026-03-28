// 主页面 — 左右分栏布局：左侧 Agent 面板，右侧资产预览区
"use client";

import { AgentPanel } from "@/components/agent/agent-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";

export default function Home() {
  return (
    <div className="flex h-full">
      {/* 左侧 Agent 面板 — 占 2/5 宽度 */}
      <div className="w-2/5 min-w-[360px] border-r border-border flex flex-col">
        <AgentPanel />
      </div>

      {/* 右侧资产预览区 — 占剩余空间 */}
      <div className="flex-1 flex flex-col">
        <PreviewPanel />
      </div>
    </div>
  );
}
