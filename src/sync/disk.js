// sync/disk.js — 本機檔（File System Access API）
// Phase 1：僅存 handle 引用；Phase 5 接入實際 read/write

export async function pickAndLinkFile() {
  if (!window.showOpenFilePicker) {
    alert('請使用 Chrome/Edge');
    return null;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    return handle;
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
    return null;
  }
}

export async function writeJsonFile(handle, data) {
  if (!handle) return;
  try {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
  } catch (e) {
    console.error('writeJsonFile failed', e);
  }
}
