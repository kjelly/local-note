import { describe, it, expect } from 'vitest';
import { createNote, normalizeNote, applyLocalEdit, mergeNoteByTimestamp } from '../../src/model/note.js';

describe('createNote', () => {
  it('產生預設空白筆記', () => {
    const n = createNote();
    expect(n.id).toBeTypeOf('string');
    expect(n.title).toBe('');
    expect(n.content).toBe('');
    expect(n.links).toEqual([]);
    expect(n.history).toEqual([]);
    expect(n.pinned).toBe(false);
    expect(n.updatedAtTs).toBeGreaterThan(0);
  });

  it('接受部分欄位', () => {
    const n = createNote({ title: 'hi', pinned: true });
    expect(n.title).toBe('hi');
    expect(n.pinned).toBe(true);
  });
});

describe('normalizeNote', () => {
  it('從 v23 物件補上 timestamp 與 links', () => {
    const raw = { id: 123, title: 'old', content: 'x', updatedAt: '2024-01-01 12:00:00', history: [] };
    const n = normalizeNote(raw);
    expect(n.id).toBe(123);
    expect(n.title).toBe('old');
    expect(n.updatedAtTs).toBeTypeOf('number');
    expect(n.links).toEqual([]);
  });

  it('缺 id 時補一個 uuid', () => {
    const n = normalizeNote({ title: 'x' });
    expect(n.id).toBeTypeOf('string');
    expect(n.id.length).toBeGreaterThan(10);
  });

  it('回傳 null 對應非物件', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote('x')).toBeNull();
  });
});

describe('applyLocalEdit', () => {
  it('無變動回原物件', () => {
    const n = createNote({ title: 'a', content: 'b' });
    const next = applyLocalEdit(n, { title: 'a', content: 'b' });
    expect(next).toBe(n); // 同 reference 表示無 dirty
  });

  it('title 變動更新時間戳', () => {
    const n = createNote({ title: 'a' });
    const next = applyLocalEdit(n, { title: 'A' });
    expect(next.title).toBe('A');
    expect(next.updatedAtTs).toBeGreaterThanOrEqual(n.updatedAtTs);
  });

  it('content 變動更新時間戳', () => {
    const n = createNote({ content: 'a' });
    const next = applyLocalEdit(n, { content: 'A' });
    expect(next.content).toBe('A');
    expect(next.updatedAtTs).toBeGreaterThanOrEqual(n.updatedAtTs);
  });
});

describe('mergeNoteByTimestamp', () => {
  it('local 較新時回 local', () => {
    const l = { id: 'a', updatedAtTs: 2000 };
    const r = { id: 'a', updatedAtTs: 1000 };
    expect(mergeNoteByTimestamp(l, r)).toBe(l);
  });

  it('remote 較新時回 remote', () => {
    const l = { id: 'a', updatedAtTs: 1000 };
    const r = { id: 'a', updatedAtTs: 2000 };
    expect(mergeNoteByTimestamp(l, r)).toBe(r);
  });

  it('local 缺時回 remote', () => {
    const r = { id: 'a', updatedAtTs: 1 };
    expect(mergeNoteByTimestamp(null, r)).toBe(r);
  });

  it('remote 缺時回 local', () => {
    const l = { id: 'a', updatedAtTs: 1 };
    expect(mergeNoteByTimestamp(l, null)).toBe(l);
  });
});
