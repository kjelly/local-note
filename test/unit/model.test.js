import { describe, it, expect } from 'vitest';
import {
  createNote, normalizeNote, applyPatch, noteView,
  pushHistory, restoreFromHistory,
} from '../../src/model/note.js';
import { getDeviceId } from '../../src/util/id.js';

describe('createNote', () => {
  it('產生 LWW 結構空白筆記', () => {
    const n = createNote();
    expect(n.id).toBeTypeOf('string');
    expect(n.title).toMatchObject({ value: '', rev: 1 });
    expect(n.title.clock).toBeTypeOf('object');
    expect(n.content.value).toBe('');
    expect(n.links.value).toEqual([]);
    expect(n.pinned.value).toBe(false);
    expect(n.history).toEqual([]);
  });

  it('接受部分欄位', () => {
    const n = createNote({ title: 'hi', pinned: true });
    expect(noteView(n).title).toBe('hi');
    expect(noteView(n).pinned).toBe(true);
  });
});

describe('normalizeNote', () => {
  it('從 v23 物件升級到 LWW', () => {
    const raw = { id: '123', title: 'old', content: 'x', updatedAt: '2024-01-01 12:00:00', history: [] };
    const n = normalizeNote(raw);
    expect(n.id).toBe('123');
    expect(noteView(n).title).toBe('old');
    expect(n.title.rev).toBe(1);
    expect(n.links.value).toEqual([]);
  });

  it('已是 LWW 格式則原樣保留', () => {
    const lww = createNote({ title: 'a' });
    const out = normalizeNote(lww);
    expect(out.title.value).toBe('a');
    expect(out.title.rev).toBe(1);
  });

  it('回傳 null 對應非物件', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote('x')).toBeNull();
  });
});

describe('applyPatch', () => {
  it('無變動回原 reference', () => {
    const n = createNote({ title: 'a', content: 'b' });
    const next = applyPatch(n, { title: 'a', content: 'b' });
    expect(next).toBe(n);
  });

  it('title 變動 bump rev 與 clock', () => {
    const n = createNote({ title: 'a' });
    const before = n.title.rev;
    const next = applyPatch(n, { title: 'A' });
    expect(next.title.value).toBe('A');
    expect(next.title.rev).toBe(before + 1);
    expect(next.title.clock[getDeviceId()]).toBeGreaterThan(0);
  });

  it('content 變動 bump rev', () => {
    const n = createNote({ content: 'a' });
    const next = applyPatch(n, { content: 'A' });
    expect(next.content.value).toBe('A');
    expect(next.content.rev).toBe(2);
  });

  it('links 用 deep equal 判斷', () => {
    const n = createNote({ links: [1, 2] });
    const next = applyPatch(n, { links: [1, 2] });
    expect(next).toBe(n);
    const next2 = applyPatch(n, { links: [1, 2, 3] });
    expect(next2.links.value).toEqual([1, 2, 3]);
  });

  it('pinned toggle', () => {
    const n = createNote({ pinned: false });
    const next = applyPatch(n, { pinned: true });
    expect(next.pinned.value).toBe(true);
    expect(next.pinned.rev).toBe(2);
  });
});

describe('pushHistory / restoreFromHistory', () => {
  it('pushHistory 加到開頭，超過 20 截斷', () => {
    let n = createNote();
    for (let i = 0; i < 25; i++) {
      n = pushHistory(n, { time: 't' + i, timestamp: i, content: 'c' + i });
    }
    expect(n.history).toHaveLength(20);
    expect(n.history[0].content).toBe('c24');
  });

  it('restoreFromHistory 還原並把現有推入 history', () => {
    let n = createNote({ content: 'v1' });
    n = applyPatch(n, { content: 'v2' });
    n = pushHistory(n, { time: 't', timestamp: 1, content: 'v1' });
    // history 順序：[v1@t=1]，content 為 v2
    const restored = restoreFromHistory(n, 0);
    expect(restored.content.value).toBe('v1');
    expect(restored.history[0].content).toBe('v2');
  });
});

describe('noteView', () => {
  it('攤平 LWW 結構', () => {
    const n = createNote({ title: 't', content: 'c', pinned: true });
    const v = noteView(n);
    expect(v).toMatchObject({
      id: n.id,
      title: 't',
      content: 'c',
      pinned: true,
      history: [],
    });
  });

  it('空 note 回空 view', () => {
    expect(noteView(null)).toBeNull();
  });
});
