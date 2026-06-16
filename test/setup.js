// 測試共用 setup

// jsdom 沒實作 URL.createObjectURL / revokeObjectURL；測試環境用 polyfill
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = (blob) => {
    const id = `blob:mock-${++counter}`;
    URL._mockBlobs = URL._mockBlobs || new Map();
    URL._mockBlobs.set(id, blob);
    return id;
  };
  URL.revokeObjectURL = (url) => {
    if (URL._mockBlobs) URL._mockBlobs.delete(url);
  };
}

export {};
