// 预览面板的状态管理 — 存储 Agent 生成的各种资产数据
// 使用 React Context 在 Agent 面板（工具调用结果）和预览面板之间共享数据
"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ProjectUnderstanding, DisplayStrategy, PptOutline, OnePager } from "@/lib/ai/schemas";

// 预览面板可展示的资产类型
export type AssetType = "project" | "strategy" | "script" | "ppt" | "onepager";

interface PreviewState {
  activeAsset: AssetType | null;
  projectUnderstanding: ProjectUnderstanding | null;
  displayStrategy: DisplayStrategy | null;
  scriptContent: string | null;        // 讲稿 Markdown 文本
  pptOutline: PptOutline | null;       // PPT 大纲结构化数据
  onePager: OnePager | null;           // One-pager 结构化数据
}

interface PreviewContextValue extends PreviewState {
  setActiveAsset: (asset: AssetType) => void;
  setProjectUnderstanding: (data: ProjectUnderstanding) => void;
  setDisplayStrategy: (data: DisplayStrategy) => void;
  setScriptContent: (data: string) => void;
  setPptOutline: (data: PptOutline) => void;
  setOnePager: (data: OnePager) => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PreviewState>({
    activeAsset: null,
    projectUnderstanding: null,
    displayStrategy: null,
    scriptContent: null,
    pptOutline: null,
    onePager: null,
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

  const setScriptContent = useCallback(
    (data: string) => {
      setState((prev) => ({
        ...prev,
        scriptContent: data,
        activeAsset: "script",
      }));
    },
    []
  );

  const setPptOutline = useCallback(
    (data: PptOutline) => {
      setState((prev) => ({
        ...prev,
        pptOutline: data,
        activeAsset: "ppt",
      }));
    },
    []
  );

  const setOnePager = useCallback(
    (data: OnePager) => {
      setState((prev) => ({
        ...prev,
        onePager: data,
        activeAsset: "onepager",
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
        setScriptContent,
        setPptOutline,
        setOnePager,
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
