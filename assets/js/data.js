// Данные страницы: конфиг, строки, товары (из <script type="application/json">) + догрузка /api/products
const read = id => {
  try { return JSON.parse(document.getElementById(id)?.textContent || 'null'); } catch { return null; }
};

export const config = read('oi-config') || { lang: 'uk', prefix: '', str: {}, freeFrom: 1500 };
export const str = config.str || {};
const products = new Map();
for (const p of read('oi-products') || []) products.set(p.id, p);

const SS = `oi_products_${config.lang}`;
try {
  for (const p of JSON.parse(sessionStorage.getItem(SS) || '[]')) if (!products.has(p.id)) products.set(p.id, p);
} catch { /* приватный режим */ }

export const product = id => products.get(+id);
export const allProducts = () => [...products.values()];
export const isReduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]freeze=1/.test(location.search);

/** Подставить {n}, {name}… в строку */
export const fmt = (s, vars = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** Деньги как в PHP Money::format: «1 290 ₴» / «₴1,290» */
export function money(n, lang = config.lang) {
  n = Math.round(+n || 0);
  if (lang === 'en') return '₴' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
}

/** Плюрализация uk/ru [1, 2–4, 5+], en [1, other] */
export function plural(n, forms, lang = config.lang) {
  n = Math.abs(n);
  if (lang === 'en') return forms[n === 1 ? 0 : 1] ?? forms[0];
  const n10 = n % 10, n100 = n % 100;
  return forms[n10 === 1 && n100 !== 11 ? 0 : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? 1 : 2] ?? forms.at(-1);
}

/**
 * Свежие данные с сервера (цены, наличие, активность). opts.fresh — всегда запрашивать.
 * Возвращает Map id → товар; отсутствующие в ответе id — недоступны.
 */
export async function fetchProducts(ids, { fresh = false } = {}) {
  ids = [...new Set(ids.map(Number).filter(Boolean))];
  const missing = fresh ? ids : ids.filter(id => !products.has(id));
  if (missing.length) {
    const res = await fetch(`/api/products?ids=${missing.join(',')}&lang=${config.lang}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('api ' + res.status);
    const data = await res.json();
    const got = new Set();
    for (const p of data.products || []) {
      products.set(p.id, p);
      got.add(p.id);
    }
    if (fresh) for (const id of missing) if (!got.has(id)) products.delete(id);
    try { sessionStorage.setItem(SS, JSON.stringify([...products.values()])); } catch { /* нет места */ }
  }
  return new Map(ids.filter(id => products.has(id)).map(id => [id, products.get(id)]));
}

export function sum(items) {
  return items.reduce((a, it) => a + (product(it.id)?.price || 0) * it.qty, 0);
}

/** Центр элемента в координатах окна */
export const center = el => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
};
