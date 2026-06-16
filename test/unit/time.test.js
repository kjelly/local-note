import { describe, it, expect } from 'vitest';
import { now, formatTime, parseTime, bumpClock, mergeClock, clockDominates } from '../../src/util/time.js';

describe('now / formatTime / parseTime', () => {
  it('now 回傳數字', () => {
    expect(now()).toBeTypeOf('number');
  });
  it('formatTime 接受 timestamp', () => {
    const s = formatTime(0);
    expect(typeof s).toBe('string');
  });
  it('parseTime 把字串轉 timestamp', () => {
    expect(parseTime('2024-01-01T00:00:00Z')).toBeGreaterThan(0);
  });
  it('parseTime 空字串回 0', () => {
    expect(parseTime('')).toBe(0);
  });
});

describe('bumpClock', () => {
  it('空 clock 從 0 開始加一', () => {
    const c = bumpClock({}, 'dev-A');
    expect(c).toEqual({ 'dev-A': 1 });
  });
  it('累加同 device', () => {
    const c = bumpClock({ 'dev-A': 3 }, 'dev-A');
    expect(c['dev-A']).toBe(4);
  });
  it('不影響其他 device', () => {
    const c = bumpClock({ 'dev-A': 1, 'dev-B': 2 }, 'dev-A');
    expect(c).toEqual({ 'dev-A': 2, 'dev-B': 2 });
  });
});

describe('mergeClock', () => {
  it('取每個 key 較大者', () => {
    const m = mergeClock({ A: 2, B: 1 }, { A: 1, B: 3, C: 5 });
    expect(m).toEqual({ A: 2, B: 3, C: 5 });
  });
  it('空時不爆', () => {
    expect(mergeClock(null, null)).toEqual({});
  });
});

describe('clockDominates', () => {
  it('A 全大於 B', () => {
    expect(clockDominates({ A: 2, B: 3 }, { A: 1, B: 2 })).toBe(true);
  });
  it('A 至少一項小於 B 就 false', () => {
    expect(clockDominates({ A: 2, B: 1 }, { A: 1, B: 2 })).toBe(false);
  });
  it('全等不算 dominates', () => {
    expect(clockDominates({ A: 1 }, { A: 1 })).toBe(false);
  });
});
