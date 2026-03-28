// 右侧预览面板 — 根据当前活跃资产类型展示对应的预览内容
// 数据来源：Agent 工具调用结果通过 PreviewContext 传入
"use client";

import { usePreview } from "./preview-context";
import { ProjectCard } from "./project-card";

export function PreviewPanel() {
  const { activeAsset, projectUnderstanding } = usePreview();

  // 根据活跃的资产类型渲染对应内容
  if (activeAsset === "project" && projectUnderstanding) {
    return (
      <div className="flex-1 overflow-y-auto">
        {/* 顶部标题栏 */}
        <div className="px-6 py-3 border-b border-border bg-background sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-muted-foreground">
            项目理解
          </h2>
        </div>
        <ProjectCard data={projectUnderstanding} />
      </div>
    );
  }

  // 空状态 — 没有资产时显示引导
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center text-muted-foreground">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-lg font-medium mb-2">资产预览区</h2>
        <p className="text-sm">Agent 生成的内容将在这里实时预览</p>
      </div>
    </div>
  );
}
