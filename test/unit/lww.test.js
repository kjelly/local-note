import { describe, it, expect } from 'vitest';
import {
  bumpField, mergeField, mergeNote, diffNote, pickFieldWinner,
} from '../../src/core/lww.js';
import { bumpClock, mergeClock, clockDominates } from '../../src/util/time.js';

function makeField(value, rev, clock, updatedAt = Date.now()) {
  return { value, rev, clock: clock || {}, updatedAt };
}

describe('bumpField', () => {
  it('從空 bump 到 rev 1', () => {
    const f = bumpField(null, 'dev-A');
    expect(f.rev).toBe(1);
    expect(f.clock).toEqual({ 'dev-A': 1 });
  });

  it('已存在時累加', () => {
    const f = bumpField({ value: 'x', rev: 3, clock: { 'dev-A': 3 } }, 'dev-A');
    expect(f.rev).toBe(4);
    expect(f.clock).toEqual({ 'dev-A': 4 });
  });
});

describe('mergeField', () => {
  it('local 缺回 remote', () => {
    const r = makeField('x', 5, { 'dev-B': 5 });
    expect(mergeField(null, r)).toBe(r);
  });

  it('remote 缺回 local', () => {
    const l = makeField('x', 5, { 'dev-A': 5 });
    expect(mergeField(l, null)).toBe(l);
  });

  it('同 device、rev 較大者勝', () => {
    const l = makeField('L', 1, { 'dev-A': 1 });
    const r = makeField('R', 2, { 'dev-A': 2 });
    const m = mergeField(l, r);
    expect(m.value).toBe('R');
    expect(m.rev).toBe(2);
  });

  it('clock dominates 較大者勝（含自身 device）', () => {
    const l = makeField('L', 1, { 'dev-A': 1 });
    const r = makeField('R', 1, { 'dev-A': 1, 'dev-B': 5 });
    const m = mergeField(l, r);
    expect(m.value).toBe('R');
    expect(m.rev).toBe(1);
    expect(m.clock).toEqual({ 'dev-A': 1, 'dev-B': 5 });
  });

  it('全等時計入合併後 clock（no-op）', () => {
    const l = makeField('S', 1, { 'dev-A': 1 });
    const r = makeField('S', 1, { 'dev-B': 1 });
    const m = mergeField(l, r);
    expect(m.value).toBe('S');
    expect(m.clock).toEqual({ 'dev-A': 1, 'dev-B': 1 });
  });
});

describe('pickFieldWinner', () => {
  it('同 device rev 較大者勝', () => {
    const l = makeField('L', 1, { 'dev-A': 1 });
    const r = makeField('R', 2, { 'dev-A': 2 });
    expect(pickFieldWinner(l, r)).toBe(r);
  });

  it('clock dominates 較大者勝', () => {
    const l = makeField('L', 1, { 'dev-A': 1 });
    const r = makeField('R', 1, { 'dev-A': 1, 'dev-B': 5 });
    expect(pickFieldWinner(l, r)).toBe(r);
  });

  it('完全 disjoint + 同 rev 視為 same（回 local）', () => {
    const l = makeField('L', 1, { 'dev-A': 1 });
    const r = makeField('R', 1, { 'dev-B': 1 });
    expect(pickFieldWinner(l, r)).toBe(l);
  });
});

describe('mergeNote (整筆)', () => {
  it('不同 id 不合併', () => {
    const a = { id: 'a', title: makeField('t', 1, {}) };
    const b = { id: 'b', title: makeField('t', 1, {}) };
    expect(mergeNote(a, b)).toBeNull();
  });

  it('欄位各自合併：title 採 B、content 採 A', () => {
    const l = {
      id: 'x',
      createdAt: 1000,
      title:   makeField('LT', 1, { 'dev-A': 1, 'dev-B': 1 }, 100),
      content: makeField('LC', 5, { 'dev-A': 5, 'dev-B': 1 }, 500),
    };
    const r = {
      id: 'x',
      createdAt: 2000,
      title:   makeField('RT', 1, { 'dev-A': 1, 'dev-B': 5 }, 200),
      content: makeField('RC', 1, { 'dev-A': 1, 'dev-B': 1 }, 100),
    };
    const m = mergeNote(l, r);
    expect(m.id).toBe('x');
    expect(m.title.value).toBe('RT');   // clock dominates B
    expect(m.content.value).toBe('LC'); // clock dominates A
    expect(m.createdAt).toBe(1000);
  });

  it('local 缺 remote 整筆回 remote', () => {
    const r = { id: 'x', title: makeField('T', 1, {}) };
    expect(mergeNote(null, r)).toBe(r);
  });
});

describe('diffNote', () => {
  it('相同視為無差異', () => {
    const f = makeField('x', 1, { 'dev-A': 1 });
    expect(diffNote({ id: '1', title: f }, { id: '1', title: f })).toBeNull();
  });

  it('rev 改變算差異', () => {
    const a = { id: '1', title: makeField('x', 1, { 'dev-A': 1 }) };
    const b = { id: '1', title: makeField('x', 2, { 'dev-A': 2 }) };
    const d = diffNote(a, b);
    expect(d).toHaveProperty('title');
    expect(d.title.rev).toBe(2);
  });

  it('value 不同算差異', () => {
    const a = { id: '1', title: makeField('A', 1, {}) };
    const b = { id: '1', title: makeField('B', 1, {}) };
    expect(diffNote(a, b).title.value).toBe('B');
  });

  it('local 缺回 remote 整筆', () => {
    expect(diffNote(null, { id: '1', title: makeField('x', 1, {}) })).toBeTruthy();
  });
});
