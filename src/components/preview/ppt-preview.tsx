// PPT 大纲预览组件 — 以卡片形式展示每一页的内容
"use client";

import type { PptOutline } from "@/lib/ai/schemas";
import { Presentation, StickyNote } from "lucide-react";

// 布局类型的中文名和图标颜色
const LAYOUT_CONFIG: Record<string, { label: string; color: string }> = {
  title: { label: "标题页", color: "bg-blue-100 text-blue-700" },
  content: { label: "内容页", color: "bg-gray-100 text-gray-700" },
  "two-column": { label: "双栏", color: "bg-purple-100 text-purple-700" },
  "image-text": { label: "图文", color: "bg-green-100 text-green-700" },
  bullets: { label: "要点", color: "bg-orange-100 text-orange-700" },
  summary: { label: "总结页", color: "bg-cyan-100 text-cyan-700" },
};

interface PptPreviewProps {
  data: PptOutline;
}

export function PptPreview({ data }: PptPreviewProps) {
  return (
    <div className="p-6 space-y-4">
      {/* PPT 标题 */}
      <div className="text-center pb-4 border-b border-border">
        <h2 className="text-xl font-bold">{data.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{data.subtitle}</p>
        <p className="text-xs text-muted-foreground mt-2">
          共 {data.totalSlides} 页
        </p>
      </div>

      {/* 每一页的卡片 */}
      {data.slides.map((slide, i) => {
        const layoutConfig = LAYOUT_CONFIG[slide.layout] || LAYOUT_CONFIG.content;
        return (
          <div
            key={i}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            {/* 页面头部：页码 + 标题 + 布局类型 */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/50">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <span className="text-sm font-medium flex-1">{slide.title}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${layoutConfig.color}`}
              >
                {layoutConfig.label}
              </span>
            </div>

            {/* 要点列表 */}
            <div className="px-3 py-2 space-y-1">
              {slide.bullets.map((bullet, j) => (
                <div key={j} className="flex items-start gap-2 text-sm">
                  <Presentation className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            {/* 演讲备注 */}
            {slide.speakerNotes && (
              <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                <div className="flex items-start gap-1.5 text-xs text-amber-700">
                  <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{slide.speakerNotes}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
