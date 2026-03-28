// src/components/preview/strategy-card.tsx
// 展示策略卡片 — 展示 AI 推荐的展示方案
"use client";

import type { DisplayStrategy, AssetType } from "@/lib/ai/schemas";
import {
  FileText,
  Presentation,
  Layout,
  Video,
  BookOpen,
  Target,
  Users,
  Sparkles,
  Clock,
  ListOrdered,
} from "lucide-react";

/**
 * 资产类型 → 图标和颜色的映射
 */
const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { icon: React.ElementType; color: string }
> = {
  "speech-script": { icon: FileText, color: "text-blue-600 bg-blue-50" },
  "ppt-outline": { icon: Presentation, color: "text-purple-600 bg-purple-50" },
  "one-pager": { icon: Layout, color: "text-green-600 bg-green-50" },
  "demo-video": { icon: Video, color: "text-red-600 bg-red-50" },
  "readme-rewrite": { icon: BookOpen, color: "text-amber-600 bg-amber-50" },
};

interface StrategyCardProps {
  data: DisplayStrategy;
}

/**
 * StrategyCard — 展示策略卡片
 *
 * 展示 AI 推荐的展示方案，包括：
 * - 展示场景和观众画像
 * - 推荐资产组合
 * - 重点突出方面
 * - 建议结构和时间分配
 */
export function StrategyCard({ data }: StrategyCardProps) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
      {/* 卡片头部 — 场景和总时长 */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">展示策略</h3>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            <Clock className="h-3 w-3" />
            {data.totalDuration}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-violet-100 text-violet-700">
            {data.scenario}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* 观众画像 */}
        <Section icon={Users} title="观众画像">
          <p className="text-sm text-zinc-600">{data.audienceProfile}</p>
        </Section>

        {/* 推荐资产 */}
        <Section icon={Target} title="推荐资产">
          <div className="space-y-2">
            {data.recommendedAssets.map((asset, i) => {
              const config = ASSET_TYPE_CONFIG[asset.type] || ASSET_TYPE_CONFIG["speech-script"];
              const AssetIcon = config.icon;
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`p-1 rounded ${config.color}`}>
                    <AssetIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-700">
                      {asset.label}
                    </span>
                    <p className="text-xs text-zinc-500">{asset.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 重点突出 */}
        <Section icon={Sparkles} title="重点突出">
          <ul className="space-y-1">
            {data.emphasisPoints.map((point, i) => (
              <li key={i} className="text-sm text-zinc-600 flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">●</span>
                {point}
              </li>
            ))}
          </ul>
        </Section>

        {/* 建议结构 */}
        <Section icon={ListOrdered} title="建议结构">
          <div className="space-y-1.5">
            {data.estimatedStructure.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-700">{item.section}</span>
                    <span className="text-xs text-zinc-400">{item.duration}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{item.notes}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

/**
 * 通用分区组件
 */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
