// 预览面板的状态管理 — 存储 Agent 生成的各种资产数据
// 使用 React Context 在 Agent 面板（工具调用结果）和预览面板之间共享数据
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ProjectUnderstanding, DisplayStrategy } from "@/lib/ai/schemas";

// 预览面板可展示的资产类型
export type AssetType = "project" | "strategy" | "script" | "ppt" | "onepager";

interface PreviewState {
  // 当前活跃的资产类型（决定右侧显示什么）
  activeAsset: AssetType | null;
  // 各类资产的数据
  projectUnderstanding: ProjectUnderstanding | null;
  displayStrategy: DisplayStrategy | null;
  // 后续扩展：script, ppt, onepager...
}

interface PreviewContextValue extends PreviewState {
  setActiveAsset: (asset: AssetType) => void;
  setProjectUnderstanding: (data: ProjectUnderstanding) => void;
  setDisplayStrategy: (data: DisplayStrategy) => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PreviewState>({
    activeAsset: null,
    projectUnderstanding: null,
    displayStrategy: null,
  });

  const setActiveAsset = useCallback((asset: AssetType) => {
    setState((prev) => ({ ...prev, activeAsset: asset }));
  }, []);

  const setProjectUnderstanding = useCallback(
    (data: ProjectUnderstanding) => {
      setState((prev) => ({
        ...prev,
        projectUnderstanding: data,
        activeAsset: "project",
      }));
    },
    []
  );

  const setDisplayStrategy = useCallback(
    (data: DisplayStrategy) => {
      setState((prev) => ({
        ...prev,
        displayStrategy: data,
        activeAsset: "strategy",
      }));
    },
    []
  );

  return (
    <PreviewContext.Provider
      value={{
        ...state,
        setActiveAsset,
        setProjectUnderstanding,
        setDisplayStrategy,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreview must be used within PreviewProvider");
  }
  return context;
}
