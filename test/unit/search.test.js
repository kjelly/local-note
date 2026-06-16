import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenize, buildIndex, indexAdd, indexRemove, indexUpdate,
  searchIndex, fuzzyFallback,
} from '../../src/core/search-index.js';
import { createNote, noteView } from '../../src/model/note.js';

function make(title, content) {
  return createNote({ title, content });
}

describe('tokenize', () => {
  it('切出英數 token', () => {
    expect(tokenize('Hello World 123')).toEqual(['hello', 'world', '123']);
  });
  it('跳過長度 1', () => {
    expect(tokenize('a bb c')).toEqual(['bb']);
  });
  it('中日韓視為多字元 token', () => {
    const t = tokenize('你好 世界');
    expect(t).toContain('你好');
    expect(t).toContain('世界');
  });
  it('空字串回空', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
  });
});

describe('buildIndex', () => {
  it('建立反向索引', () => {
    const notes = [make('Hello world', 'foo bar'), make('Goodbye', 'world again')];
    const idx = buildIndex(notes);
    expect(idx.get('hello').size).toBe(1);
    expect(idx.get('world').size).toBe(2);
    expect(idx.get('foo').size).toBe(1);
  });

  it('同 note 的同 token 不重複', () => {
    const notes = [make('foo foo foo', 'bar')];
    const idx = buildIndex(notes);
    expect(idx.get('foo').size).toBe(1);
  });
});

describe('indexAdd / indexRemove / indexUpdate', () => {
  it('加入新 note', () => {
    const idx = new Map();
    const n = make('apple', 'fruit');
    indexAdd(idx, n);
    expect(idx.get('apple').has(n.id)).toBe(true);
    expect(idx.get('fruit').has(n.id)).toBe(true);
  });

  it('移除 note', () => {
    const idx = new Map();
    const n = make('apple', 'fruit');
    indexAdd(idx, n);
    indexRemove(idx, n.id);
    expect(idx.get('apple')).toBeUndefined();
  });

  it('更新 note', () => {
    const idx = new Map();
    const n = make('apple', 'fruit');
    indexAdd(idx, n);
    const updated = { ...n, title: { ...n.title, value: 'banana' } };
    indexUpdate(idx, n.id, updated);
    expect(idx.get('apple')).toBeUndefined();
    expect(idx.get('banana').has(n.id)).toBe(true);
  });
});

describe('searchIndex', () => {
  let idx, notes;
  beforeEach(() => {
    notes = [
      make('JavaScript tutorial', 'learn js basics'),
      make('Python tutorial', 'learn python basics'),
      make('Cooking', 'how to cook rice'),
    ];
    idx = buildIndex(notes);
  });

  it('AND 模式取交集', () => {
    const r = searchIndex(idx, 'tutorial basics', 'AND');
    expect(r.sort()).toEqual([notes[0].id, notes[1].id].sort());
  });

  it('OR 模式取聯集', () => {
    const r = searchIndex(idx, 'python rice', 'OR');
    expect(r.sort()).toEqual([notes[1].id, notes[2].id].sort());
  });

  it('空 keyword 回 null', () => {
    expect(searchIndex(idx, '', 'AND')).toBeNull();
    expect(searchIndex(idx, '   ', 'AND')).toBeNull();
  });

  it('無命中回空陣列', () => {
    expect(searchIndex(idx, 'sdfghjkl', 'AND')).toEqual([]);
  });

  it('小寫 query 命中', () => {
    expect(searchIndex(idx, 'PYTHON', 'AND')).toEqual([notes[1].id]);
  });
});

describe('fuzzyFallback', () => {
  const notes = [
    make('Hello', 'world'),
    make('Foo', 'bar'),
  ];
  it('AND', () => {
    const r = fuzzyFallback(notes, 'hello world', 'AND');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe(notes[0].id);
  });
  it('OR', () => {
    const r = fuzzyFallback(notes, 'foo world', 'OR');
    expect(r).toHaveLength(2);
  });
  it('空 keyword 回全部', () => {
    expect(fuzzyFallback(notes, '', 'AND')).toHaveLength(2);
  });
});
