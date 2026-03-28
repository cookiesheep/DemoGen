// 右侧预览面板 — 当前为空壳，后续展示项目理解卡片、策略卡片、讲稿、PPT 等资产
export function PreviewPanel() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center text-muted-foreground">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-lg font-medium mb-2">资产预览区</h2>
        <p className="text-sm">
          Agent 生成的内容将在这里实时预览
        </p>
      </div>
    </div>
  );
}
