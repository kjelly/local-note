// uuid v7：以時間排序的 UUID，IndexedDB key 友善
// 規格：https://datatracker.ietf.org/doc/html/rfc9562#name-uuid-version-7
// 48 bit unix ms + 4 bit ver + 12 bit rand + 2 bit variant + 62 bit rand

function hex(n, len) {
  return n.toString(16).padStart(len, '0');
}

function randBits(n) {
  // 使用 crypto.getRandomValues；無 crypto 時退回 Math.random（僅測試用）
  const buf = new Uint8Array(Math.ceil(n / 8));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of buf) out += b.toString(16).padStart(2, '0');
  return out.slice(0, Math.ceil(n / 4));
}

export function uuidv7() {
  const ts = Date.now();
  const tsHex = hex(ts, 12);                       // 48 bits
  const verAndRand = '7' + randBits(12);           // 4 bit ver + 12 bit rand
  const variantAndRand = (
    (0b10 << 14) | (parseInt(randBits(14), 16) & 0x3fff)
  ).toString(16).padStart(4, '0');
  const tail = randBits(48);
  return (
    tsHex.slice(0, 8) + '-' +
    tsHex.slice(8, 12) + '-' +
    verAndRand + '-' +
    variantAndRand + '-' +
    tail
  );
}

// 取或產生 deviceId（同一瀏覽器固定一台）
const DEVICE_ID_KEY = 'lb_device_id';
export function getDeviceId() {
  if (typeof localStorage === 'undefined') return uuidv7();
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv7();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
