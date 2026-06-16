// services/secure-store.js — 可選的敏感資料加密（Web Crypto AES-GCM）
// 用法：
//   const key = await deriveKey('my-passphrase');
//   const ct = await encryptString('secret', key);
//   const pt = await decryptString(ct, key);
//
// 為什麼「可選」：使用者設定檔有加密較安心，但失去金鑰就救不回；UI 預設走明文 config.js
// 此檔提供工具；實際接 config 的加密是 P8 之後再評估

const ITERATIONS = 100_000;

function getCrypto() {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.getRandomValues === 'function') {
    return crypto.subtle;
  }
  return null;
}

export function isSupported() {
  return !!getCrypto();
}

// 從 passphrase 衍生 AES-GCM 金鑰
export async function deriveKey(passphrase, saltBytes = new TextEncoder().encode('lb-secure-salt-v1')) {
  const c = getCrypto();
  if (!c) throw new Error('Web Crypto not available');
  const passKey = await c.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return c.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 回傳 { iv, ciphertext } 兩者都是 base64 字串
export async function encryptString(plaintext, key) {
  const c = getCrypto();
  if (!c) throw new Error('Web Crypto not available');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await c.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
}

export async function decryptString({ iv, ct }, key) {
  const c = getCrypto();
  if (!c) throw new Error('Web Crypto not available');
  const ivBytes = Uint8Array.from(atob(iv), (ch) => ch.charCodeAt(0));
  const ctBytes = Uint8Array.from(atob(ct), (ch) => ch.charCodeAt(0));
  const pt = await c.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ctBytes);
  return new TextDecoder().decode(pt);
}
