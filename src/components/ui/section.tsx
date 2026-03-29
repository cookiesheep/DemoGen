// 通用 Section 卡片 — 图标 + 标题 + 内容，用于预览面板的各种卡片
// variant="warning" 时显示黄色边框和背景（用于风险提醒等）
import type { ComponentType, ReactNode } from "react";

interface SectionProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  variant?: "warning";
  children: ReactNode;
}

export function Section({ icon: Icon, title, variant, children }: SectionProps) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        variant === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`h-4 w-4 ${
            variant === "warning" ? "text-amber-500" : "text-muted-foreground"
          }`}
        />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
