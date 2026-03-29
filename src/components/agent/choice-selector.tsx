// 场景选择组件 — Agent 动态生成的选项按钮（Generative UI）
// 当 Agent 调用 askUserChoice 工具时，前端渲染为可点击的按钮组
// 包含"自定义"选项，选中后显示文本输入框
// 用户选择/输入后通过 addResult 将结果返回给 Agent
"use client";

import { useState, useRef, useEffect } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { Check, Pencil, SendHorizontal } from "lucide-react";

// askUserChoice 工具的参数类型
interface AskUserChoiceArgs {
  question: string;
  options: string[];
}

// askUserChoice 工具的结果类型
interface AskUserChoiceResult {
  selectedOption: string;
}

/**
 * 渲染 askUserChoice 工具调用为交互式按钮组
 * 最后一个选项始终是"自定义"，点击后展开文本输入框
 */
export function ChoiceSelector(
  props: ToolCallMessagePartProps<AskUserChoiceArgs, AskUserChoiceResult>
) {
  const { args, result, status, addResult } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 如果已有结果（历史加载），显示已选状态
  const selectedOption = result?.selectedOption || selected;
  const isWaiting = status.type === "requires-action";
  const isComplete = status.type === "complete";

  // 自定义输入框显示时自动聚焦
  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  // 处理用户点击预设选项
  const handleSelect = (option: string) => {
    if (!isWaiting) return;
    setSelected(option);
    setShowCustomInput(false);
    addResult({ selectedOption: option });
  };

  // 处理点击"自定义"按钮
  const handleCustomClick = () => {
    if (!isWaiting) return;
    setShowCustomInput(true);
  };

  // 提交自定义输入
  const handleCustomSubmit = () => {
    if (!isWaiting || !customText.trim()) return;
    const text = customText.trim();
    setSelected(text);
    setShowCustomInput(false);
    addResult({ selectedOption: text });
  };

  return (
    <div className="my-3">
      {/* 问题文字 */}
      <p className="text-sm mb-2.5 font-medium">{args.question}</p>

      {/* 选项按钮组 */}
      <div className="flex flex-wrap gap-2">
        {/* 预设选项 */}
        {args.options.map((option) => {
          const isSelected = selectedOption === option;
          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={!isWaiting}
              className={`
                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm
                border transition-all
                ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : isWaiting
                      ? "border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
                      : "border-border/50 text-muted-foreground cursor-default opacity-60"
                }
              `}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
              {option}
            </button>
          );
        })}

        {/* 自定义选项按钮 — 仅在等待状态且未展开输入框时显示 */}
        {isWaiting && !showCustomInput && !selectedOption && (
          <button
            onClick={handleCustomClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer text-muted-foreground transition-all"
          >
            <Pencil className="h-3 w-3" />
            自定义
          </button>
        )}

        {/* 自定义输入已提交后的显示 */}
        {selectedOption &&
          !args.options.includes(selectedOption) && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border border-primary bg-primary/10 text-primary font-medium">
              <Check className="h-3.5 w-3.5" />
              {selectedOption}
            </span>
          )}
      </div>

      {/* 自定义输入框 — 点击"自定义"后展开 */}
      {showCustomInput && isWaiting && (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="输入你的展示场景..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customText.trim()) {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customText.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-9 w-9 shrink-0 disabled:opacity-30 transition-opacity"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 完成提示 */}
      {isComplete && selectedOption && (
        <p className="text-xs text-muted-foreground mt-2">
          已选择：{selectedOption}
        </p>
      )}
    </div>
  );
}
