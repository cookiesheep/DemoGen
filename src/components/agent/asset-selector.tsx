// 资产选择组件 — Agent 生成策略后，让用户多选要生成的资产（Generative UI）
// 当 Agent 调用 confirmAssets 工具时，前端渲染为 checkbox 列表
// 用户勾选后通过 addResult 将选中的资产列表返回给 Agent
"use client";

import { useState } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { Check, Package, SendHorizontal } from "lucide-react";

// confirmAssets 工具的参数类型
interface ConfirmAssetsArgs {
  recommendedAssets: {
    type: string;
    label: string;
    reason: string;
  }[];
}

// confirmAssets 工具的结果类型
interface ConfirmAssetsResult {
  selectedAssets: string[];
}

// 资产类型对应的 emoji
const ASSET_ICONS: Record<string, string> = {
  script: "📝",
  ppt: "📊",
  onepager: "📄",
};

export function AssetSelector(
  props: ToolCallMessagePartProps<ConfirmAssetsArgs, ConfirmAssetsResult>
) {
  const { args, result, status, addResult } = props;
  const assets = args.recommendedAssets || [];

  // 默认全选
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(assets.map((a) => a.type))
  );

  const isWaiting = status.type === "requires-action";
  const isComplete = status.type === "complete";

  // 切换某个资产的选中状态
  const toggleAsset = (type: string) => {
    if (!isWaiting) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // 提交选择
  const handleConfirm = () => {
    if (!isWaiting || selected.size === 0) return;
    addResult({ selectedAssets: Array.from(selected) });
  };

  // 已有结果（历史加载）
  const selectedAssets = result?.selectedAssets;

  return (
    <div className="my-3">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">选择要生成的展示资产：</p>
      </div>

      <div className="space-y-2">
        {assets.map((asset) => {
          // 完成后显示最终选中状态
          const isSelected = isComplete
            ? selectedAssets?.includes(asset.type)
            : selected.has(asset.type);
          const icon = ASSET_ICONS[asset.type] || "📦";

          return (
            <button
              key={asset.type}
              onClick={() => toggleAsset(asset.type)}
              disabled={!isWaiting}
              className={`
                w-full flex items-start gap-3 px-3.5 py-2.5 rounded-lg text-left
                border transition-all
                ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : isWaiting
                      ? "border-border hover:border-primary/40 hover:bg-muted/30"
                      : "border-border/50 opacity-50"
                }
              `}
            >
              {/* Checkbox 指示器 */}
              <div
                className={`
                  mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
                  ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40"
                  }
                `}
              >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>

              {/* 资产信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{icon}</span>
                  <span className="text-sm font-medium">{asset.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {asset.reason}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 等待状态：显示确认按钮 */}
      {isWaiting && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            已选 {selected.size}/{assets.length} 项
          </span>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-30 transition-opacity hover:opacity-90"
          >
            <SendHorizontal className="h-3.5 w-3.5" />
            开始生成
          </button>
        </div>
      )}

      {/* 完成状态：显示已选结果 */}
      {isComplete && selectedAssets && (
        <p className="text-xs text-muted-foreground mt-2">
          已选择 {selectedAssets.length} 项资产，生成中...
        </p>
      )}
    </div>
  );
}
