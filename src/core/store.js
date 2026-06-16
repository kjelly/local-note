// 自製 reactive store（30 行）— signal + subscribe，無外部依賴
// 用法：
//   const counter = signal(0);
//   const off = counter.subscribe(v => ...);
//   counter.set(1); counter.update(n => n + 1);

export function signal(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get() { return value; },
    set(next) {
      if (Object.is(value, next)) return;
      value = next;
      for (const fn of subs) fn(value);
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

// 合併多個 signal：先訂閱全部、收集當前值，呼叫一次 fn
// 之後任一 signal 變動 → 呼叫 fn；用來建立 derived state
export function combine(signals, fn) {
  const values = signals.map((s) => s.get());
  const subs = signals.map((s, i) =>
    s.subscribe((v) => {
      values[i] = v;
      fn(...values);
    })
  );
  fn(...values);
  return () => subs.forEach((off) => off());
}
