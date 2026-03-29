// One-pager 预览组件 — 模拟一页纸排版，支持内联编辑
"use client";

import { useState, useCallback } from "react";
import type { OnePager } from "@/lib/ai/schemas";
import { Zap, Target, Users, ArrowRight, Pencil, Check, Download } from "lucide-react";
import { usePreview } from "./preview-context";

interface OnePagerPreviewProps {
  data: OnePager;
}

export function OnePagerPreview({ data }: OnePagerPreviewProps) {
  const preview = usePreview();

  // 导出为 JSON
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "一页纸.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  // 更新单个字段
  const updateField = useCallback(
    (field: keyof OnePager, value: string) => {
      preview.setOnePager({ ...data, [field]: value });
    },
    [data, preview]
  );

  // 更新 keyFeatures 中某个功能
  const updateFeature = useCallback(
    (index: number, field: "title" | "description", value: string) => {
      const newFeatures = [...data.keyFeatures];
      newFeatures[index] = { ...newFeatures[index], [field]: value };
      preview.setOnePager({ ...data, keyFeatures: newFeatures });
    },
    [data, preview]
  );

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">
          点击任意文字区域即可编辑
        </span>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3 w-3" />
          导出
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 头部：项目名 + 标语 */}
        <div className="text-center pb-4 border-b border-border">
          <EditableText
            value={data.projectName}
            onSave={(v) => updateField("projectName", v)}
            className="text-2xl font-bold"
          />
          <EditableText
            value={data.tagline}
            onSave={(v) => updateField("tagline", v)}
            className="text-base text-muted-foreground mt-1 italic"
          />
        </div>

        {/* 问题 → 方案 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              问题
            </h3>
            <EditableText
              value={data.problem}
              onSave={(v) => updateField("problem", v)}
              className="text-sm text-red-900"
              multiline
            />
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
              <Zap className="h-4 w-4" />
              方案
            </h3>
            <EditableText
              value={data.solution}
              onSave={(v) => updateField("solution", v)}
              className="text-sm text-green-900"
              multiline
            />
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
                <EditableText
                  value={feature.title}
                  onSave={(v) => updateFeature(i, "title", v)}
                  className="text-sm font-medium"
                />
                <EditableText
                  value={feature.description}
                  onSave={(v) => updateFeature(i, "description", v)}
                  className="text-xs text-muted-foreground mt-1"
                />
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
            <EditableText
              value={data.techHighlight}
              onSave={(v) => updateField("techHighlight", v)}
              className="text-sm"
            />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Users className="h-3 w-3" />
              目标用户
            </h3>
            <EditableText
              value={data.targetAudience}
              onSave={(v) => updateField("targetAudience", v)}
              className="text-sm"
            />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium">
            <EditableText
              value={data.callToAction}
              onSave={(v) => updateField("callToAction", v)}
              className="text-sm font-medium text-primary-foreground"
              inputClassName="text-foreground"
            />
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ========== 通用的可编辑文本组件 ==========
// 点击文字进入编辑模式，失焦或回车保存
function EditableText({
  value,
  onSave,
  className = "",
  inputClassName = "",
  multiline = false,
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const startEdit = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  const save = () => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const cancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    const commonProps = {
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setEditValue(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          save();
        }
        if (e.key === "Escape") {
          cancel();
        }
      },
      className: `w-full bg-background border border-primary rounded px-2 py-1 outline-none text-foreground ${inputClassName}`,
      autoFocus: true,
    };

    if (multiline) {
      return (
        <textarea
          {...commonProps}
          onChange={(e) => setEditValue(e.target.value)}
          rows={3}
          className={`${commonProps.className} resize-none text-sm`}
        />
      );
    }

    return <input {...commonProps} onChange={(e) => setEditValue(e.target.value)} />;
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:bg-primary/5 hover:outline hover:outline-1 hover:outline-primary/30 rounded px-0.5 -mx-0.5 transition-colors group inline-flex items-center gap-1 ${className}`}
      title="点击编辑"
    >
      {value}
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </span>
  );
}
