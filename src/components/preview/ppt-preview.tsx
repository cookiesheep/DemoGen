// PPT 大纲预览组件 — 卡片形式展示每一页，支持内联编辑
"use client";

import { useState, useCallback } from "react";
import type { PptOutline } from "@/lib/ai/schemas";
import { Presentation, StickyNote, Pencil, Check, X, Download } from "lucide-react";
import { usePreview } from "./preview-context";

// 布局类型的中文名和颜色
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
  // 正在编辑第几页，null 表示没有编辑
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  // 编辑中的临时数据
  const [editTitle, setEditTitle] = useState("");
  const [editBullets, setEditBullets] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const preview = usePreview();

  // 进入编辑模式
  const startEdit = useCallback((index: number) => {
    const slide = data.slides[index];
    setEditTitle(slide.title);
    setEditBullets(slide.bullets.join("\n"));
    setEditNotes(slide.speakerNotes);
    setEditingSlide(index);
  }, [data.slides]);

  // 保存编辑
  const saveEdit = useCallback(() => {
    if (editingSlide === null) return;
    const newSlides = [...data.slides];
    newSlides[editingSlide] = {
      ...newSlides[editingSlide],
      title: editTitle,
      bullets: editBullets.split("\n").filter((b) => b.trim()),
      speakerNotes: editNotes,
    };
    preview.setPptOutline({
      ...data,
      slides: newSlides,
    });
    setEditingSlide(null);
  }, [editingSlide, editTitle, editBullets, editNotes, data, preview]);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingSlide(null);
  }, []);

  // 导出为 JSON
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PPT大纲.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">
          共 {data.totalSlides} 页 · 点击页面右上角编辑
        </span>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3 w-3" />
          导出
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* PPT 标题 */}
        <div className="text-center pb-4 border-b border-border">
          <h2 className="text-xl font-bold">{data.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{data.subtitle}</p>
        </div>

        {/* 每一页的卡片 */}
        {data.slides.map((slide, i) => {
          const layoutConfig = LAYOUT_CONFIG[slide.layout] || LAYOUT_CONFIG.content;
          const isEditing = editingSlide === i;

          return (
            <div
              key={i}
              className={`rounded-lg border overflow-hidden transition-colors ${
                isEditing ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {/* 页面头部 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/50">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </div>

                {isEditing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 text-sm font-medium bg-background border border-input rounded px-2 py-1 outline-none focus:border-primary"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium flex-1">{slide.title}</span>
                )}

                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${layoutConfig.color}`}>
                  {layoutConfig.label}
                </span>

                {/* 编辑/保存/取消按钮 */}
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={saveEdit}
                      className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                      title="保存"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                      title="取消"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(i)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="编辑此页"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* 要点列表 */}
              <div className="px-3 py-2">
                {isEditing ? (
                  <textarea
                    value={editBullets}
                    onChange={(e) => setEditBullets(e.target.value)}
                    placeholder="每行一个要点"
                    className="w-full text-sm bg-background border border-input rounded px-2 py-1.5 outline-none focus:border-primary resize-none min-h-[80px]"
                    rows={Math.max(3, editBullets.split("\n").length)}
                  />
                ) : (
                  <div className="space-y-1">
                    {slide.bullets.map((bullet, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm">
                        <Presentation className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 演讲备注 */}
              {isEditing ? (
                <div className="px-3 py-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 mb-1">
                    <StickyNote className="h-3 w-3" />
                    <span>演讲备注</span>
                  </div>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="给演讲者的备注..."
                    className="w-full text-xs bg-background border border-input rounded px-2 py-1.5 outline-none focus:border-primary resize-none"
                    rows={2}
                  />
                </div>
              ) : (
                slide.speakerNotes && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <div className="flex items-start gap-1.5 text-xs text-amber-700">
                      <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{slide.speakerNotes}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
