// 主页面 — 左右分栏布局：左侧 Agent 面板，右侧资产预览区
// PreviewProvider 包裹两侧，使工具调用结果能传递到预览面板
"use client";

import { AgentPanel } from "@/components/agent/agent-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { PreviewProvider } from "@/components/preview/preview-context";

export default function Home() {
  return (
    <PreviewProvider>
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
    </PreviewProvider>
  );
}
