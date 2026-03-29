// 右侧预览面板 — 根据当前活跃资产类型展示对应的预览内容
// 数据来源：Agent 工具调用结果通过 PreviewContext 传入
// 顶部有资产标签切换，允许用户在已生成的资产之间切换
"use client";

import { usePreview, type AssetType } from "./preview-context";
import { ProjectCard } from "./project-card";
import { StrategyCard } from "./strategy-card";
import { ScriptPreview } from "./script-preview";
import { PptPreview } from "./ppt-preview";
import { OnePagerPreview } from "./onepager-preview";

// 资产标签配置
const ASSET_TABS: { key: AssetType; label: string; icon: string }[] = [
  { key: "project", label: "项目理解", icon: "📋" },
  { key: "strategy", label: "展示策略", icon: "🎯" },
  { key: "script", label: "讲稿", icon: "📝" },
  { key: "ppt", label: "PPT 大纲", icon: "📊" },
  { key: "onepager", label: "一页纸", icon: "📄" },
];

export function PreviewPanel() {
  const preview = usePreview();
  const { activeAsset, setActiveAsset } = preview;

  // 判断哪些资产已经生成了
  const availableAssets = ASSET_TABS.filter((tab) => {
    if (tab.key === "project") return preview.projectUnderstanding !== null;
    if (tab.key === "strategy") return preview.displayStrategy !== null;
    if (tab.key === "script") return preview.scriptContent !== null;
    if (tab.key === "ppt") return preview.pptOutline !== null;
    if (tab.key === "onepager") return preview.onePager !== null;
    return false;
  });

  // 如果没有任何资产，显示空状态
  if (availableAssets.length === 0) {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部资产标签栏 — 只在有多个资产时显示 */}
      {availableAssets.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background">
          {availableAssets.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveAsset(tab.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${
                  activeAsset === tab.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 只有一个资产时显示简单标题栏 */}
      {availableAssets.length === 1 && (
        <div className="px-6 py-3 border-b border-border bg-background">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {availableAssets[0].icon} {availableAssets[0].label}
          </h2>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {/* 带工具栏的资产用 flex 布局占满高度 */}
        {activeAsset === "script" && preview.scriptContent && (
          <ScriptPreview content={preview.scriptContent} />
        )}
        {activeAsset === "ppt" && preview.pptOutline && (
          <PptPreview data={preview.pptOutline} />
        )}
        {activeAsset === "onepager" && preview.onePager && (
          <OnePagerPreview data={preview.onePager} />
        )}

        {/* 只读资产用滚动容器 */}
        {activeAsset !== "script" && activeAsset !== "ppt" && activeAsset !== "onepager" && (
          <div className="h-full overflow-y-auto">
            {activeAsset === "project" && preview.projectUnderstanding && (
              <ProjectCard data={preview.projectUnderstanding} />
            )}
            {activeAsset === "strategy" && preview.displayStrategy && (
              <StrategyCard data={preview.displayStrategy} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
