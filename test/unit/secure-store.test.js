import { describe, it, expect } from 'vitest';
import { deriveKey, encryptString, decryptString, isSupported } from '../../src/services/secure-store.js';

describe('secure-store Web Crypto', () => {
  it('isSupported 在 Node 環境可用', () => {
    expect(isSupported()).toBe(true);
  });

  it('encrypt → decrypt 來回一致', async () => {
    const key = await deriveKey('my-passphrase');
    const ct = await encryptString('hello world', key);
    expect(ct.iv).toBeTypeOf('string');
    expect(ct.ct).toBeTypeOf('string');
    const pt = await decryptString(ct, key);
    expect(pt).toBe('hello world');
  });

  it('不同金鑰無法解密', async () => {
    const k1 = await deriveKey('pass-A');
    const k2 = await deriveKey('pass-B');
    const ct = await encryptString('secret', k1);
    await expect(decryptString(ct, k2)).rejects.toThrow();
  });

  it('每次 iv 隨機', async () => {
    const key = await deriveKey('p');
    const a = await encryptString('same', key);
    const b = await encryptString('same', key);
    expect(a.iv).not.toBe(b.iv);
  });

  it('可處理中文內容', async () => {
    const key = await deriveKey('中');
    const ct = await encryptString('你好世界', key);
    expect(await decryptString(ct, key)).toBe('你好世界');
  });
});
