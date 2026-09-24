// Сообщение менеджеру для WhatsApp — зеркало PHP WhatsApp::buildMessage (офлайн-fallback).
// Проверяется той же фикстурой tests/fixtures/wa-message.json (tests/js/wa.test.mjs).
export const MAX_URL = 4000;   // как WhatsApp::MAX_URL (см. DECISIONS.md)
const CODES = { uk: 'UA', ru: 'RU', en: 'EN' };

export function money(n, lang) {
  n = Math.round(+n || 0);
  if (lang === 'en') return '₴' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
}

export function prettyPhone(e164) {
  const d = String(e164).replace(/\D+/g, '');
  if (d.length !== 12) return e164;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** Любой ввод → +380XXXXXXXXX или null (как Phone::normalize) */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (!d) return null;
  if (d.length === 12 && d.startsWith('380')) { /* ok */ }
  else if (d.length === 11 && d.startsWith('80')) d = '3' + d;
  else if (d.length === 10 && d.startsWith('0')) d = '38' + d;
  else if (d.length === 9 && d[0] !== '0') d = '380' + d;
  else return null;
  return /^380[1-9]\d{8}$/.test(d) ? '+' + d : null;
}

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/**
 * @param o {number, name, phone, contact, city, branch, comment, site_lang, subtotal, total, delivery_free}
 * @param items [{name, pack, qty, line_total, preorder}]
 * @param s строки на языке менеджера (wa.template, wa.item_line, wa.preorder, wa.collapsed, wa.not_saved, wa.no_number, cart.delivery.*, checkout.contact.*)
 */
export function buildWaText(o, items, s, lang, cartUrl, offline = false, collapse = false) {
  const m = v => money(v, lang);
  let list;
  if (collapse) list = fill(s['wa.collapsed'], { n: items.length });
  else {
    list = items.map((it, i) => {
      let line = fill(s['wa.item_line'], { i: i + 1, name: it.name, pack: it.pack, qty: it.qty, line_total: m(it.line_total) }).replace(' ()', '');
      if (it.preorder) line += ' — ' + s['wa.preorder'];
      return line;
    }).join('\n');
  }
  const vars = {
    number: o.number || s['wa.no_number'] || '—',
    items: list,
    subtotal: m(o.subtotal),
    delivery: o.delivery_free ? s['cart.delivery.free'] : s['cart.delivery.carrier'],
    total: m(o.total),
    name: String(o.name || '').trim(),
    phone: prettyPhone(o.phone || ''),
    contact: s['checkout.contact.' + o.contact] || o.contact,
    city: String(o.city || '').trim(),
    branch: String(o.branch || '').trim(),
    comment: String(o.comment || '').trim().replace(/\s*\n\s*/g, ' / '),   // как в PHP: без «служебных» строк из комментария
    lang: CODES[o.site_lang] || String(o.site_lang).toUpperCase(),
    cart_url: cartUrl,
  };
  const out = [];
  for (const line of s['wa.template'].split('\n')) {
    const mm = /\{(\w+)\}/.exec(line);
    if (mm && (vars[mm[1]] ?? '') === '' && line !== '{items}') continue;   // пустые поля не выводим
    out.push(fill(line, vars));
  }
  let text = out.join('\n');
  if (offline) text += '\n\n' + s['wa.not_saved'];
  return text;
}

export const waUrl = (number, text) => `https://wa.me/${String(number).replace(/\D+/g, '')}?text=${encodeURIComponent(text)}`;

/** Текст + ссылка; если URL длиннее MAX_URL — позиции сворачиваются в одну строку */
export function buildWa(o, items, s, lang, cartUrl, number, offline = false) {
  let text = buildWaText(o, items, s, lang, cartUrl, offline);
  let url = number ? waUrl(number, text) : '';
  if (url && url.length > MAX_URL) {
    text = buildWaText(o, items, s, lang, cartUrl, offline, true);
    url = waUrl(number, text);
  }
  return { text, url };
}
