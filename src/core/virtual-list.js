// core/virtual-list.js — 固定列高的虛擬捲動計算
// 給定 items（陣列）、容器尺寸、可視高度、列高、overscan，
// 回傳 { start, end, topPad, bottomPad }，呼叫者用來決定要 render 哪幾列。
// 純函式，與 DOM 解耦；易測試。

export function computeRange({
  scrollTop,
  viewportHeight,
  itemHeight,
  total,
  overscan = 5,
}) {
  if (total <= 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };
  const first = Math.floor(scrollTop / itemHeight);
  const visible = Math.ceil(viewportHeight / itemHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total, first + visible + overscan);
  return {
    start,
    end,
    topPad: start * itemHeight,
    bottomPad: Math.max(0, (total - end) * itemHeight),
  };
}

// 給定資料陣列與範圍，回傳實際要 render 的 items
export function sliceForRender(items, range) {
  return items.slice(range.start, range.end);
}

// 計算總內容高度（給 scroll container 撐出 scrollbar）
export function totalHeight(total, itemHeight) {
  return total * itemHeight;
}
