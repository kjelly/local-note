import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderMarkdownUnsafe, getPurify } from '../../src/services/markdown.js';

describe('renderMarkdown', () => {
  it('空字串回空字串', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
  });

  it('標題與段落', () => {
    const html = renderMarkdown('# Hi\n\nworld');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<p>world</p>');
  });

  it('強調 / 清單 / code', () => {
    const html = renderMarkdown('**b**\n\n- a\n- b\n\n`c`');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<li>b</li>');
    expect(html).toContain('<code>c</code>');
  });

  it('連結', () => {
    const html = renderMarkdown('[x](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('圖片 src 保留', () => {
    const html = renderMarkdown('![alt](https://x.com/a.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://x.com/a.png"');
    expect(html).toContain('alt="alt"');
  });

  it('XSS：<script> 被過濾', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(');
  });

  it('XSS：onerror 屬性被過濾', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('onerror=');
  });

  it('GFM 表格', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renderMarkdownUnsafe 不過濾', () => {
    const raw = renderMarkdownUnsafe('<script>alert(1)</script>');
    expect(raw).toContain('<script>');
  });

  it('getPurify 取得實例', () => {
    expect(typeof getPurify().sanitize).toBe('function');
  });
});
