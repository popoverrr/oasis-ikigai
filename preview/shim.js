// Превью на GitHub Pages: без PHP-сервера. Подменяет ответы сервера в браузере:
// каталог (фильтры, сортировка, поиск, «Показати ще») и «Обране» — из preview/catalog-*.json, товары для корзины — из preview/products-*.json,
// заказ не отправляется (показывается пример экрана «Замовлення прийнято»), WhatsApp не открывается.
(() => {
  const BASE = "/oasis-ikigai";
  const ORDER = "OI-1001";
  const lang = document.documentElement.lang || 'uk';
  const prefix = lang === 'uk' ? '' : '/' + lang;
  const cache = {};
  const load = (kind, l) => (cache[kind + l] ||= fetch(BASE + '/preview/' + kind + '-' + l + '.json').then(r => r.json()));
  const reply = (body, type, status) => new Response(body, { status: status || 200, headers: { 'Content-Type': type } });
  const json = (body, status) => reply(JSON.stringify(body), 'application/json', status);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function plural(n, forms) {
    if (!Array.isArray(forms)) return String(forms);
    if (lang === 'en') return forms[n === 1 ? 0 : 1] ?? forms[0];
    const n10 = n % 10, n100 = n % 100;
    return forms[n10 === 1 && n100 !== 11 ? 0 : n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14) ? 1 : 2] ?? forms[forms.length - 1];
  }

  // как ProductRepo::search на сервере
  function search(all, goal, q) {
    const list = (q.get('brand') || '').split(',').filter(Boolean), cats = (q.get('category') || '').split(',').filter(Boolean);
    const min = +q.get('min') || 0, max = +q.get('max') || 0, stock = !!q.get('stock');
    const words = (q.get('q') || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    const items = all.filter(p => (!goal || p.goals.includes(goal)) && (!list.length || list.includes(p.brand)) && (!cats.length || cats.includes(p.category))
      && (!min || p.price >= min) && (!max || p.price <= max) && (!stock || p.stock !== 'out_of_stock') && words.every(w => p.search.includes(w)));
    const out = p => (p.stock === 'out_of_stock' ? 1 : 0);
    const by = {
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews || a.sort - b.sort,
      new: (a, b) => b.is_new - a.is_new || b.id - a.id,
      price_asc: (a, b) => a.price - b.price || a.sort - b.sort,
      price_desc: (a, b) => b.price - a.price || a.sort - b.sort,
    }[q.get('sort')] || ((a, b) => b.is_bestseller - a.is_bestseller || out(a) - out(b) || a.sort - b.sort || a.id - b.id);
    return items.sort(by);
  }

  async function shopPartial(u, goal) {
    const c = await load('catalog', lang);
    const found = search(c.products, goal, u.searchParams);
    const page = Math.max(1, +u.searchParams.get('page') || 1), shown = found.slice(0, 24 * page), total = found.length;
    const count = plural(total, c.strings.n).replace('{n}', total), apply = c.strings.apply.replace('{n}', total);
    let inner = c.empty;
    if (shown.length) {
      const next = new URLSearchParams(u.searchParams);
      next.delete('partial');
      next.set('page', page + 1);
      inner = '<div class="prods prods--grid">' + shown.map(p => c.cards[p.id] || '').join('') + '</div>'
        + (total > shown.length ? `<a class="btn btn--ghost more" href="${esc(u.pathname + '?' + next)}" data-more>${esc(c.strings.more)}</a>` : '');
    }
    return reply(`<div class="grid-wrap" data-grid data-total="${total}" data-count-text="${esc(count)}" data-apply-text="${esc(apply)}">${inner}</div>`, 'text/html', 200);
  }

  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    const p = u.pathname.startsWith(BASE) ? u.pathname.slice(BASE.length) : u.pathname;
    if (p === '/api/products') {
      const want = (u.searchParams.get('ids') || '').split(',').map(Number);
      const all = await load('products', u.searchParams.get('lang') || lang);
      return json({ products: all.products.filter(x => want.includes(x.id)) });
    }
    if (p === '/api/orders') {
      await new Promise(r => setTimeout(r, 400));
      return json({ number: ORDER, success_url: BASE + prefix + '/order/preview', wa_url: '' }, 201);
    }
    const shop = /^(?:\/(?:ru|en))?\/shop(?:\/([a-z0-9-]+))?\/?$/.exec(p);
    if (shop && u.searchParams.get('partial')) return shopPartial(u, shop[1] || '');
    if (/^(?:\/(?:ru|en))?\/wishlist\/?$/.test(p) && u.searchParams.get('partial')) {
      const c = await load('catalog', lang);
      return reply((u.searchParams.get('ids') || '').split(',').map(id => c.cards[id] || '').join(''), 'text/html');
    }
    return orig(input, init);
  };

  // каталог открыт со строкой поиска или фильтрами в адресе (поиск из шапки, «Показати ще» без JS) — применяем их в браузере
  addEventListener('load', async () => {
    const form = document.querySelector('[data-filters]');
    const q = new URLSearchParams(location.search);
    if (!form || ![...q.keys()].length) return;
    // модуль каталога подгружается отдельно — ждём, пока он повесит обработчики
    for (let i = 0; i < 100 && !form.dataset.ready; i++) await new Promise(r => setTimeout(r, 50));
    for (const [k, v] of q) {
      if (k === 'brand' || k === 'category') {
        for (const s of v.split(',')) { const box = form.querySelector(`input[name="${k}[]"][value="${CSS.escape(s)}"]`); if (box) box.checked = true; }
      } else if (form.elements[k]) {
        const el = form.elements[k];
        if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
      }
    }
    form.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const msg = {
    uk: 'Це превʼю сайту: перехід у WhatsApp вимкнено. На справжньому сайті тут відкриється чат із менеджером.',
    ru: 'Это превью сайта: переход в WhatsApp отключён. На настоящем сайте здесь откроется чат с менеджером.',
    en: 'This is a site preview: WhatsApp is disabled here. On the live site this opens a chat with the manager.',
  };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me"], a[href$="#whatsapp"], [data-wa-link]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    alert(msg[lang] || msg.uk);
  }, true);
})();
