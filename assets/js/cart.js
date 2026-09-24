// Корзина — единственный источник правды (docs/05 § 1). localStorage['oi_cart_v1'], только id и qty.
const KEY = 'oi_cart_v1';
export const MAX_QTY = 99;
export const MAX_ITEMS = 50;

let memory = null;          // если хранилище недоступно — корзина живёт в памяти вкладки
let storageOk = true;
const subs = new Set();

function empty() {
  return { v: 1, items: [], updated: 0 };
}

function clean(items) {
  const acc = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    const id = Number.parseInt(it?.id, 10), qty = Number.parseInt(it?.qty, 10);
    if (!(id > 0) || !(qty > 0)) continue;
    if (!acc.has(id) && acc.size >= MAX_ITEMS) continue;
    acc.set(id, Math.min(MAX_QTY, (acc.get(id) || 0) + qty));
  }
  return [...acc].map(([id, qty]) => ({ id, qty }));
}

function read() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : empty();
    return { v: 1, items: clean(s.items), updated: s.updated || 0 };
  } catch {
    storageOk = false;
    return (memory = memory || empty());
  }
}

function write(items) {
  const state = { v: 1, items: clean(items), updated: Date.now() };
  if (storageOk) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      storageOk = false;
    }
  }
  if (!storageOk) memory = state;
  emit();
}

function emit() {
  const items = read().items;
  for (const fn of subs) {
    try { fn(items); } catch (e) { console.error(e); }
  }
}

export const cart = {
  items: () => read().items,
  count: () => read().items.reduce((a, b) => a + b.qty, 0),
  qty: id => read().items.find(i => i.id === +id)?.qty || 0,
  add(id, n = 1) {
    id = +id;
    const items = read().items;
    const it = items.find(i => i.id === id);
    if (it) it.qty = Math.min(MAX_QTY, it.qty + n);
    else if (items.length < MAX_ITEMS) items.push({ id, qty: Math.min(MAX_QTY, n) });
    write(items);
  },
  set(id, qty) {
    id = +id;
    const items = read().items.filter(i => i.id !== id || qty > 0);
    const it = items.find(i => i.id === id);
    if (it) it.qty = Math.min(MAX_QTY, qty);
    else if (qty > 0) items.push({ id, qty: Math.min(MAX_QTY, qty) });
    write(items);
  },
  remove(id) {
    write(read().items.filter(i => i.id !== +id));
  },
  clear() {
    write([]);
  },
  replace(items) {
    write(items);
  },
  merge(items) {
    write([...read().items, ...items]);
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  toShareParam(items = read().items) {
    return [...items].sort((a, b) => a.id - b.id).map(i => `${i.id}:${i.qty}`).join(',');
  },
  fromShareParam(str) {
    const out = [];
    for (const pair of String(str || '').slice(0, 2000).split(',')) {
      const m = /^\s*(\d{1,9})\s*:\s*(\d{1,4})\s*$/.exec(pair);
      if (m) out.push({ id: +m[1], qty: +m[2] });
    }
    return clean(out).sort((a, b) => a.id - b.id);
  },
  storageOk: () => storageOk,
};

addEventListener('storage', e => {
  if (e.key === KEY) emit();
});
