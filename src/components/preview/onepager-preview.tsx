// One-pager 预览组件 — 模拟一页纸的排版效果
"use client";

import type { OnePager } from "@/lib/ai/schemas";
import { Zap, Target, Users, ArrowRight } from "lucide-react";

interface OnePagerPreviewProps {
  data: OnePager;
}

export function OnePagerPreview({ data }: OnePagerPreviewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* 头部：项目名 + 标语 */}
      <div className="text-center pb-4 border-b border-border">
        <h2 className="text-2xl font-bold">{data.projectName}</h2>
        <p className="text-base text-muted-foreground mt-1 italic">
          {data.tagline}
        </p>
      </div>

      {/* 问题 → 方案 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            问题
          </h3>
          <p className="text-sm text-red-900">{data.problem}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            方案
          </h3>
          <p className="text-sm text-green-900">{data.solution}</p>
        </div>
      </div>

      {/* 核心功能 */}
      <div>
        <h3 className="text-sm font-semibold mb-3">核心功能</h3>
        <div className="grid grid-cols-3 gap-3">
          {data.keyFeatures.map((feature, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-3 text-center"
            >
              <div className="text-sm font-medium mb-1">{feature.title}</div>
              <p className="text-xs text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 技术亮点 + 目标用户 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-1">
            技术亮点
          </h3>
          <p className="text-sm">{data.techHighlight}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            目标用户
          </h3>
          <p className="text-sm">{data.targetAudience}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium">
          {data.callToAction}
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
