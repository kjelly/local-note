import { describe, it, expect, beforeEach } from 'vitest';
import { signal, combine } from '../../src/core/store.js';

describe('signal', () => {
  it('初始值', () => {
    const s = signal(10);
    expect(s.get()).toBe(10);
  });

  it('set 通知 subscriber', () => {
    const s = signal(0);
    const seen = [];
    s.subscribe((v) => seen.push(v));
    s.set(1);
    s.set(2);
    expect(seen).toEqual([1, 2]);
  });

  it('同值不通知', () => {
    const s = signal(1);
    let n = 0;
    s.subscribe(() => n++);
    s.set(1);
    s.set(1);
    expect(n).toBe(0);
  });

  it('update 套用函式', () => {
    const s = signal(5);
    s.update((v) => v * 2);
    expect(s.get()).toBe(10);
  });

  it('unsubscribe 停止通知', () => {
    const s = signal(0);
    let n = 0;
    const off = s.subscribe(() => n++);
    s.set(1);
    off();
    s.set(2);
    expect(n).toBe(1);
  });
});

describe('combine', () => {
  it('啟動時 emit 一次，之後任一變動都觸發', () => {
    const a = signal(1);
    const b = signal(2);
    const seen = [];
    const off = combine([a, b], (x, y) => seen.push([x, y]));
    a.set(10);
    b.set(20);
    off();
    expect(seen).toEqual([[1, 2], [10, 2], [10, 20]]);
  });
});
