// 策略卡片 — 展示 Strategy Subagent 生成的展示策略
// 包含场景标签、总时长、观众画像、推荐资产、重点方向、时间线
"use client";

import type { DisplayStrategy } from "@/lib/ai/schemas";
import { Section } from "@/components/ui/section";
import {
  Target,
  Users,
  Clock,
  Package,
  Compass,
  ListOrdered,
} from "lucide-react";

// 场景标签颜色配置
const SCENARIO_COLORS: Record<string, string> = {
  "course-defense": "bg-blue-100 text-blue-700",
  "job-interview": "bg-green-100 text-green-700",
  "open-source-promo": "bg-purple-100 text-purple-700",
  "product-launch": "bg-orange-100 text-orange-700",
  "team-report": "bg-cyan-100 text-cyan-700",
  custom: "bg-gray-100 text-gray-700",
};

// 资产类型图标
const ASSET_ICONS: Record<string, string> = {
  script: "📝",
  ppt: "📊",
  onepager: "📄",
};

interface StrategyCardProps {
  data: DisplayStrategy;
}

export function StrategyCard({ data }: StrategyCardProps) {
  const scenarioColor =
    SCENARIO_COLORS[data.scenario] || SCENARIO_COLORS.custom;

  return (
    <div className="space-y-5 p-6">
      {/* 头部：场景标签 + 总时长 */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${scenarioColor}`}
        >
          {data.scenarioLabel}
        </span>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>建议 {data.totalDuration}</span>
        </div>
      </div>

      {/* 观众画像 */}
      <Section icon={Users} title="观众画像">
        <p className="text-sm">{data.audienceProfile}</p>
      </Section>

      {/* 推荐资产 */}
      <Section icon={Package} title="推荐资产">
        <div className="space-y-2">
          {data.recommendedAssets.map((asset, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 text-sm"
            >
              <span className="text-base shrink-0">
                {ASSET_ICONS[asset.type] || "📦"}
              </span>
              <div>
                <span className="font-medium">{asset.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {asset.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 重点方向 */}
      <Section icon={Target} title="重点强调">
        <ul className="space-y-1">
          {data.emphasisPoints.map((point, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <Compass className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              {point}
            </li>
          ))}
        </ul>
      </Section>

      {/* 展示结构时间线 */}
      <Section icon={ListOrdered} title="展示结构">
        <div className="space-y-3">
          {data.estimatedStructure.map((section, i) => (
            <div key={i} className="relative pl-6">
              {/* 时间线指示器 */}
              <div className="absolute left-0 top-0.5 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
              </div>
              {/* 连接线（非最后一项时显示） */}
              {i < data.estimatedStructure.length - 1 && (
                <div className="absolute left-[7px] top-5 w-0.5 h-full bg-border" />
              )}
              {/* 内容 */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{section.section}</span>
                  <span className="text-xs text-muted-foreground">
                    {section.duration}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {section.keyPoints.map((point, j) => (
                    <li
                      key={j}
                      className="text-xs text-muted-foreground flex items-start gap-1.5"
                    >
                      <span className="mt-0.5">·</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

