import { describe, it, expect } from 'vitest';
import { computeRange, sliceForRender, totalHeight } from '../../src/core/virtual-list.js';

describe('computeRange', () => {
  it('空 total 回零', () => {
    expect(computeRange({ scrollTop: 0, viewportHeight: 300, itemHeight: 50, total: 0 }))
      .toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0 });
  });

  it('捲動在最頂端', () => {
    const r = computeRange({ scrollTop: 0, viewportHeight: 300, itemHeight: 50, total: 100, overscan: 3 });
    // first = 0, visible = ceil(300/50) = 6 → end = 0 + 6 + 3 = 9
    expect(r.start).toBe(0);
    expect(r.end).toBe(9);
    expect(r.topPad).toBe(0);
    expect(r.bottomPad).toBe((100 - 9) * 50);
  });

  it('捲動到中段', () => {
    const r = computeRange({ scrollTop: 1000, viewportHeight: 200, itemHeight: 50, total: 200, overscan: 5 });
    // first = 20, visible = ceil(200/50) = 4 → end = 20 + 4 + 5 = 29
    expect(r.start).toBe(15);
    expect(r.end).toBe(29);
    expect(r.topPad).toBe(15 * 50);
    expect(r.bottomPad).toBe((200 - 29) * 50);
  });

  it('overscan 不超過邊界', () => {
    const r = computeRange({ scrollTop: 0, viewportHeight: 300, itemHeight: 50, total: 3, overscan: 5 });
    expect(r.start).toBe(0);
    expect(r.end).toBe(3); // 不超過 total
    expect(r.bottomPad).toBe(0);
  });

  it('overscan 太大時 start 不小於 0', () => {
    const r = computeRange({ scrollTop: 10000, viewportHeight: 300, itemHeight: 50, total: 50, overscan: 5 });
    expect(r.start).toBeGreaterThanOrEqual(0);
  });

  it('最後一段 end 不超過 total', () => {
    const r = computeRange({ scrollTop: 100000, viewportHeight: 300, itemHeight: 50, total: 200, overscan: 3 });
    expect(r.end).toBeLessThanOrEqual(200);
  });
});

describe('sliceForRender', () => {
  const arr = [1, 2, 3, 4, 5];
  it('切出範圍內的 items', () => {
    expect(sliceForRender(arr, { start: 1, end: 4 })).toEqual([2, 3, 4]);
  });
  it('空範圍回空', () => {
    expect(sliceForRender(arr, { start: 3, end: 3 })).toEqual([]);
  });
});

describe('totalHeight', () => {
  it('總高度 = 數量 × 列高', () => {
    expect(totalHeight(100, 50)).toBe(5000);
  });
  it('0 筆回 0', () => {
    expect(totalHeight(0, 50)).toBe(0);
  });
});
