import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  _resetForTest, getDB, STORES,
  putAttachment, getAttachment, getAttachmentsByNote,
  deleteAttachment, deleteAttachmentsByNote,
} from '../../src/core/idb.js';
import {
  insertAttachment, loadAttachmentSrc, release, releaseAll,
  removeAttachment, getAttachmentsForNote, fileToMarkdownImage,
} from '../../src/ui/attachments.js';

async function reset() {
  releaseAll();
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.attachments);
  await db.clear(STORES.notes);
  await db.clear(STORES.meta);
}

function fakeFile(name = 'a.png', type = 'image/png', content = 'PNG-DATA') {
  return new File([content], name, { type });
}

describe('attachments IndexedDB', () => {
  beforeEach(reset);

  it('put / get / delete', async () => {
    // jsdom 的 Blob 沒有 size/text()，用一個 duck-typed 物件（idb 接受任何可 cloneable）
    const fakeBlob = { __fake: true, content: 'x', size: 1, type: 'text/plain' };
    const att = { id: 'a1', noteId: 'n1', blob: fakeBlob, mime: 'text/plain', createdAt: 1 };
    await putAttachment(att);
    const r = await getAttachment('a1');
    expect(r.mime).toBe('text/plain');
    expect(r.blob.size).toBe(1);
    await deleteAttachment('a1');
    expect(await getAttachment('a1')).toBeUndefined();
  });

  it('getAttachmentsByNote 用 index 查', async () => {
    await putAttachment({ id: 'a', noteId: 'n1', blob: new Blob(['x']), mime: 'a/b', createdAt: 1 });
    await putAttachment({ id: 'b', noteId: 'n1', blob: new Blob(['y']), mime: 'a/b', createdAt: 2 });
    await putAttachment({ id: 'c', noteId: 'n2', blob: new Blob(['z']), mime: 'a/b', createdAt: 3 });
    const r = await getAttachmentsByNote('n1');
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('deleteAttachmentsByNote 一次清掉', async () => {
    await putAttachment({ id: 'a', noteId: 'n1', blob: new Blob(['x']), mime: 'a/b', createdAt: 1 });
    await putAttachment({ id: 'b', noteId: 'n2', blob: new Blob(['y']), mime: 'a/b', createdAt: 2 });
    await deleteAttachmentsByNote('n1');
    expect(await getAttachment('a')).toBeUndefined();
    expect(await getAttachment('b')).toBeTruthy();
  });
});

describe('attachments 對外 API', () => {
  beforeEach(reset);

  it('insertAttachment 回傳 id 與 src（object URL）', async () => {
    const f = fakeFile();
    const r = await insertAttachment(f, 'n1');
    expect(r.id).toBeTypeOf('string');
    expect(r.src).toMatch(/^blob:/);
    expect(r.mime).toBe('image/png');
    const att = await getAttachment(r.id);
    expect(att.noteId).toBe('n1');
  });

  it('loadAttachmentSrc 重用 cache', async () => {
    const f = fakeFile('x.png');
    const ins = await insertAttachment(f);
    const url2 = await loadAttachmentSrc(ins.id);
    expect(url2).toBe(ins.src);
  });

  it('loadAttachmentSrc 對未知 id 回 null', async () => {
    expect(await loadAttachmentSrc('nope')).toBeNull();
  });

  it('release 與 releaseAll 清掉 cache', async () => {
    const f = fakeFile();
    const ins = await insertAttachment(f);
    release(ins.id);
    releaseAll();
  });

  it('removeAttachment 同步清掉 IDB', async () => {
    const f = fakeFile();
    const ins = await insertAttachment(f);
    await removeAttachment(ins.id);
    expect(await getAttachment(ins.id)).toBeUndefined();
  });

  it('getAttachmentsForNote 等同 getAttachmentsByNote', async () => {
    await putAttachment({ id: 'a', noteId: 'n1', blob: new Blob(['x']), mime: 'a/b', createdAt: 1 });
    const r = await getAttachmentsForNote('n1');
    expect(r).toHaveLength(1);
  });

  it('fileToMarkdownImage 圖片回 ![](url)', async () => {
    const f = fakeFile('cat.png', 'image/png');
    const md = await fileToMarkdownImage(f);
    expect(md).toMatch(/^!\[cat\.png\]\(blob:/);
  });

  it('fileToMarkdownImage 非圖片回 [name](url)', async () => {
    const f = fakeFile('note.txt', 'text/plain');
    const md = await fileToMarkdownImage(f);
    expect(md).toMatch(/^\[note\.txt\]\(blob:/);
  });
});
