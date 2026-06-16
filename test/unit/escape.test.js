import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr, unescapeHtml } from '../../src/util/escape.js';

describe('escapeHtml', () => {
  it('處理 null 與 undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('把 number 與 boolean 轉成字串', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(false)).toBe('false');
  });

  it('跳脫五個危險字元', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('多次出現的字元都要跳脫', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
    expect(escapeHtml('"""')).toBe('&quot;&quot;&quot;');
  });

  it('字串裡的 <script> 變成純文字', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('不可變更普通字串', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('中文 123 !@#')).toBe('中文 123 !@#');
  });

  it('& 必須最先處理，避免雙重跳脫', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapeAttr 與 escapeHtml 行為一致', () => {
    const samples = ['a', 'a&b', `<a href="x">`, "it's"];
    for (const s of samples) {
      expect(escapeAttr(s)).toBe(escapeHtml(s));
    }
  });

  it('unescapeHtml 還原 escape 過的字串', () => {
    const original = `<a href="x">A&B 'C'</a>`;
    expect(unescapeHtml(escapeHtml(original))).toBe(original);
  });
});
