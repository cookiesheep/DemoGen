// 场景选择组件 — Agent 动态生成的选项按钮（Generative UI）
// 当 Agent 调用 askUserChoice 工具时，前端渲染为可点击的按钮组
// 用户点击后通过 addResult 将选择结果返回给 Agent
"use client";

import { useState } from "react";
import type { ToolCallMessagePartProps } from "@assistant-ui/react";
import { Check } from "lucide-react";

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
 * 这是一个前端工具 — Agent 调用时没有 execute，
 * 前端通过 addResult 将用户选择回传给 Agent
 */
export function ChoiceSelector(
  props: ToolCallMessagePartProps<AskUserChoiceArgs, AskUserChoiceResult>
) {
  const { args, result, status, addResult } = props;
  const [selected, setSelected] = useState<string | null>(null);

  // 如果已有结果（可能是从历史加载的），显示已选状态
  const selectedOption = result?.selectedOption || selected;
  const isWaiting = status.type === "requires-action";
  const isComplete = status.type === "complete";

  // 处理用户点击选项
  const handleSelect = (option: string) => {
    if (!isWaiting) return; // 只在等待状态下允许点击
    setSelected(option);
    // 通过 addResult 将选择结果返回给 Agent，Agent 会继续执行
    addResult({ selectedOption: option });
  };

  return (
    <div className="my-3">
      {/* 问题文字 */}
      <p className="text-sm mb-2.5 font-medium">{args.question}</p>

      {/* 选项按钮组 */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* 完成提示 */}
      {isComplete && selectedOption && (
        <p className="text-xs text-muted-foreground mt-2">
          已选择：{selectedOption}
        </p>
      )}
    </div>
  );
}
