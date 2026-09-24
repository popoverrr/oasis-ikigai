// Корзина и оформление (docs/05): свежие цены с сервера, ссылка на корзину, форма, POST /api/orders, офлайн-fallback
import { cart } from './cart.js';
import { config, str, product, fmt, money, plural, fetchProducts, sum } from './data.js';
import { toast, h, icon } from './ui.js';
import { burst, paletteFrom, PALETTE_GREEN } from './petals.js';
import { buildWa, normalizePhone } from './wa.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const FORM_KEY = 'oi_checkout_v1';
// телефон/планшет: сразу открываем WhatsApp (на десктопе — кнопка и QR)
const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 900);
let C;                 // строки и настройки страницы (#oi-checkout)
let freeWasReached = null;

// ── Ссылка на корзину ───────────────────────────────────
const shareUrl = () => `${location.origin}${config.prefix}/cart?items=${cart.toShareParam()}`;

async function copyLink() {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    return toast(str.linkCopied);
  } catch { /* дальше — запасные варианты */ }
  const ta = h('textarea', { style: 'position:fixed;opacity:0;left:-9999px', readonly: '' });
  ta.value = url;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  if (ok) return toast(str.linkCopied);
  const box = $('[data-link-box]');
  box.hidden = false;
  box.value = url;
  box.focus();
  box.select();
  toast(str.copyManual);
}

// ── Корзина по ссылке ?items= ───────────────────────────
async function sharedFromUrl() {
  const u = new URL(location.href);
  const raw = u.searchParams.get('items');
  if (raw === null) return;
  const incoming = cart.fromShareParam(raw);
  const clearParam = () => { u.searchParams.delete('items'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); };
  if (!incoming.length) return clearParam();
  const mine = cart.items();
  const same = mine.length && cart.toShareParam(mine) === cart.toShareParam(incoming);
  if (!mine.length || same) {
    cart.replace(incoming);
    clearParam();
    toast(C.loaded);
    return;
  }
  try { await fetchProducts(incoming.map(i => i.id)); } catch { /* сумма может быть неполной */ }
  const sheet = $('[data-shared-sheet]');
  const n = incoming.reduce((a, b) => a + b.qty, 0);
  $('[data-shared-text]', sheet).textContent = fmt(plural(n, C.sharedForms), { n, amount: money(sum(incoming)) });
  sheet.hidden = false;
  const prevFocus = document.activeElement;
  $('[data-shared-merge]', sheet).focus();
  await new Promise(resolve => {
    const done = action => {
      if (action === 'replace') cart.replace(incoming);
      if (action === 'merge') cart.merge(incoming);
      sheet.hidden = true;
      clearParam();
      if (action) toast(C.loaded);
      prevFocus?.focus?.();
      resolve();
    };
    $('[data-shared-replace]', sheet).onclick = () => done('replace');
    $('[data-shared-merge]', sheet).onclick = () => done('merge');
    $('[data-sheet-close]', sheet).onclick = () => done(null);
    sheet.onkeydown = e => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Tab') {
        const f = $$('button', sheet), first = f[0], last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
  });
}

// ── Список позиций ──────────────────────────────────────
let undoItem = null;
function lineEl(it, p) {
  const img = p.img
    ? h('img', { src: p.img, alt: '', width: 72, height: 90, loading: 'lazy' })
    : h('span', { class: 'line__ph', 'aria-hidden': 'true', text: '生' });
  const stepper = h('div', { class: 'stepper', role: 'group', 'aria-label': fmt(str.qtyLabel, { name: p.name }) },
    h('button', { type: 'button', 'data-dec': '', 'aria-label': `${str.decrease}: ${p.name}` }, icon('minus', 14, 14)),
    h('output', { 'aria-live': 'polite', text: String(it.qty) }),
    h('button', { type: 'button', 'data-inc': '', 'aria-label': `${str.increase}: ${p.name}` }, icon('plus', 14, 14)));
  const li = h('li', { class: 'line', 'data-line': it.id },
    h('a', { class: 'line__img', href: p.url, tabindex: '-1', 'aria-hidden': 'true' }, img),
    h('div', { class: 'line__body' },
      h('a', { class: 'line__name', href: p.url, text: p.name }),
      h('p', { class: 'line__pack', text: p.pack + (p.stock === 'preorder' ? ' · ' + C.preorder : '') }),
      h('div', { class: 'line__row' }, stepper, h('span', { class: 'line__sum price', text: money(p.price * it.qty) }))),
    h('button', { class: 'line__rm', type: 'button', 'data-rm': '', 'aria-label': fmt(C.remove, { name: p.name }) }, icon('close', 18, 18)));
  if (p._changed) li.classList.add('is-changed');
  return li;
}

function render() {
  const items = cart.items().filter(i => product(i.id));
  const list = $('[data-lines]');
  $('[data-cart-skeleton]').hidden = true;
  const empty = items.length === 0;
  $('[data-cart-empty]').hidden = !empty;
  $('[data-cart-featured]').hidden = !empty;
  for (const sel of ['[data-checkout]', '[data-summary]', '[data-free]', '[data-share]']) $(sel).hidden = empty;
  const n = items.reduce((a, b) => a + b.qty, 0);
  $('[data-cart-count-text]').textContent = empty ? '' : fmt(plural(n, C.itemsForms), { n });
  // перерисовать строки, сохраняя фокус
  const focused = document.activeElement?.closest('[data-line]');
  const fKey = focused && [focused.dataset.line, [...focused.querySelectorAll('button,a')].indexOf(document.activeElement)];
  list.replaceChildren(...items.map(it => lineEl(it, product(it.id))));
  if (fKey) list.querySelector(`[data-line="${fKey[0]}"]`)?.querySelectorAll('button,a')[fKey[1]]?.focus();

  const subtotal = sum(items), free = subtotal >= config.freeFrom;
  $('[data-sum-subtotal]').textContent = money(subtotal);
  // итог показан дважды: в панели итога и (на телефоне) прямо над кнопкой «Оформити»
  for (const el of document.querySelectorAll('[data-sum-delivery]')) el.textContent = free ? C.deliveryFree : C.deliveryCarrier;
  for (const el of document.querySelectorAll('[data-sum-total]')) el.textContent = money(subtotal);
  const left = Math.max(0, config.freeFrom - subtotal);
  $('[data-free-text]').textContent = free ? C.freeReached : fmt(C.freeLeft, { amount: money(left) });
  $('[data-free-fill]').style.transform = `scaleX(${config.freeFrom ? Math.min(1, subtotal / config.freeFrom) : 1})`;
  $('[data-free]').classList.toggle('is-free', free);
  $('[data-free-sticker]').hidden = !free;
  if (free && freeWasReached === false) {
    const r = $('[data-free-fill]').getBoundingClientRect();
    // бесплатная доставка достигнута — один раз зелёно-жёлтый салют
    burst(r.right - 10, r.top, { count: 8, spread: .9, palette: PALETTE_GREEN });
    burst(r.right - 10, r.top, { count: 7, spread: .9, palette: paletteFrom('#FFD60A') });
  }
  freeWasReached = free;
}

function initLines() {
  $('[data-lines]').addEventListener('click', e => {
    const li = e.target.closest('[data-line]');
    if (!li) return;
    const id = +li.dataset.line, q = cart.qty(id);
    if (e.target.closest('[data-inc]')) cart.set(id, q + 1);
    else if (e.target.closest('[data-dec]')) { if (q > 1) cart.set(id, q - 1); else remove(id); }
    else if (e.target.closest('[data-rm]')) remove(id);
  });
  function remove(id) {
    undoItem = { id, qty: cart.qty(id) };
    cart.remove(id);
    toast(str.removed, { action: str.undo, timeout: 5000, onAction: () => { if (undoItem) cart.set(undoItem.id, undoItem.qty); undoItem = null; } });
  }
}

// ── Свежие цены и наличие ────────────────────────────────
async function refresh() {
  const items = cart.items();
  if (!items.length) return render();
  const before = new Map(items.map(i => [i.id, product(i.id)?.price]));
  try {
    const fresh = await fetchProducts(items.map(i => i.id), { fresh: true });
    const gone = items.filter(i => !fresh.has(i.id) || fresh.get(i.id).stock === 'out_of_stock');
    if (gone.length) {
      cart.replace(items.filter(i => !gone.includes(i)));
      toast(str.unavailable, { timeout: 4000 });
    }
    let changed = false;
    for (const [id, p] of fresh) if (before.get(id) != null && before.get(id) !== p.price) { p._changed = true; changed = true; }
    if (changed) toast(str.priceChanged);
  } catch { /* сервер недоступен — показываем то, что знаем */ }
  render();
}

// ── Форма ───────────────────────────────────────────────
/** Маска +380 (XX) XXX-XX-XX. Принимает ввод после подставленного «+380 (» и вставку в любом формате */
export function formatPhone(raw) {
  raw = String(raw);
  let d;
  if (/^\s*\+\s*3\s*8\s*0/.test(raw)) {
    // наш префикс: берём цифры после него (там мог оказаться и целый вставленный номер)
    d = raw.replace(/^\s*\+\s*3\s*8\s*0/, '').replace(/\D+/g, '');
    if (d.length > 9 && d.startsWith('380')) d = d.slice(3);
    else if (d.length > 9 && d.startsWith('80')) d = d.slice(2);
  } else {
    d = raw.replace(/\D+/g, '');
    if (d.startsWith('380')) d = d.slice(3);
    else if (d.startsWith('80')) d = d.slice(2);
  }
  if (d.startsWith('0')) d = d.slice(1);          // «067…» → 67…: после +380 ноль не пишется
  d = d.slice(0, 9);
  // стирают префикс целиком — поле пустеет, а не возвращает «+380 (» снова
  if (!d) return (/\d/.test(raw) || raw.trim().startsWith('+')) && raw.replace(/\s+/g, '').length >= 5 ? '+380 (' : '';
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)];
  // разделитель ставим только перед следующей цифрой: иначе ⌫ «застревает» на «) » и «-» (маска дописывала их обратно)
  let out = '+380 (' + p[0];
  if (d.length > 2) out += ') ' + p[1];
  if (d.length > 5) out += '-' + p[2];
  if (d.length > 7) out += '-' + p[3];
  return out;
}

function validate(form, only) {
  const v = name => String(form.elements[name]?.value || '').trim();
  const errs = {};
  const check = (name, fn) => { if (!only || only === name) { const e = fn(v(name)); if (e) errs[name] = e; } };
  check('name', x => (!x ? 'error.required' : x.length < 2 || x.length > 80 ? 'error.name' : ''));
  check('phone', x => (!x ? 'error.required' : normalizePhone(x) ? '' : 'error.phone'));
  check('city', x => (!x ? 'error.required' : x.length < 2 || x.length > 80 ? 'error.city' : ''));
  check('branch', x => (!x ? 'error.required' : x.length > 120 ? 'error.branch' : ''));
  check('comment', x => (x.length > 500 ? 'error.comment' : ''));
  return errs;
}

function showErrors(form, errs, only) {
  for (const f of $$('[data-field]', form)) {
    const name = f.dataset.field;
    if (only && only !== name) continue;
    const input = form.elements[name], err = $('.field__error', f), key = errs[name];
    f.classList.toggle('is-invalid', !!key);
    if (input && input.setAttribute) key ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute?.('aria-invalid');
    if (err) {
      err.hidden = !key;
      err.replaceChildren(...(key ? [icon('x', 14, 14), document.createTextNode(C.errors[key] || C.errors['error.generic'])] : []));
    }
  }
}

function saveForm(form) {
  const data = {};
  for (const k of ['name', 'phone', 'city', 'branch', 'contact']) data[k] = form.elements[k]?.value || '';
  try { localStorage.setItem(FORM_KEY, JSON.stringify(data)); } catch { /* нет хранилища */ }
}
function restoreForm(form) {
  try {
    const d = JSON.parse(localStorage.getItem(FORM_KEY) || '{}');
    for (const k of ['name', 'phone', 'city', 'branch']) if (d[k] && form.elements[k]) form.elements[k].value = k === 'phone' ? formatPhone(d[k]) : d[k];
    if (d.contact) for (const r of form.querySelectorAll('input[name="contact"]')) r.checked = r.value === d.contact;
  } catch { /* пусто */ }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));

function setBusy(busy, buttons = $$('[data-submit]').filter(b => !b.closest('[data-quick-form]'))) {
  for (const b of buttons) {
    b.toggleAttribute('aria-busy', busy);
    if (busy) b.setAttribute('aria-busy', 'true');
    b.disabled = busy;
    const l = $('[data-submit-label]', b);
    if (l) { if (!l.dataset.idle) l.dataset.idle = l.textContent; l.textContent = busy ? C.sending : l.dataset.idle; }
  }
}

function offlineFallback(form, customer, items = cart.items().filter(i => product(i.id)), box = $('[data-offline]')) {
  const s = C.manager.strings;
  const lines = items.map(i => {
    const p = product(i.id), mn = C.manager.names[i.id] || [p.name, p.pack];
    return { name: mn[0], pack: mn[1], qty: i.qty, line_total: p.price * i.qty, preorder: p.stock === 'preorder' };
  });
  const subtotal = sum(items);
  const o = { number: '', ...customer, phone: normalizePhone(customer.phone) || customer.phone, site_lang: C.siteLang, subtotal, total: subtotal, delivery_free: subtotal >= config.freeFrom };
  const cartUrl = `${C.base}${C.manager.prefix}/cart?items=${cart.toShareParam(items)}`;
  const wa = buildWa(o, lines, s, C.manager.lang, cartUrl, C.wa, true);
  const link = $('[data-offline-wa]', box);
  if (wa.url) link.href = wa.url; else link.hidden = true;
  box.hidden = false;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function toSuccess(res, clearIds = null) {
  if (clearIds) for (const id of clearIds) cart.remove(id); else cart.clear();
  try { sessionStorage.setItem('oi_wa_' + res.number, res.wa_url); } catch { /* приватный режим */ }
  history.replaceState({}, '', res.success_url);
  // Сначала экран успеха (тот же HTML, что и SSR /order/…), потом WhatsApp:
  // на iPhone приложение открывается поверх страницы, и по возвращении покупатель видит «Замовлення прийнято».
  let swapped = false;
  try {
    const html = await (await fetch(res.success_url, { headers: { Accept: 'text/html' } })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = doc.querySelector('main');
    if (!main) throw new Error('no main');
    document.querySelector('main').replaceWith(document.importNode(main, true));
    // ссылки языков в шапке — тоже с экрана заказа (с ?t=), а не с корзины
    for (const a of doc.querySelectorAll('[data-lang-link]')) {
      for (const cur of document.querySelectorAll(`[data-lang-link="${a.dataset.langLink}"]`)) cur.setAttribute('href', a.getAttribute('href'));
    }
    document.title = doc.title;
    document.body.className = doc.body.className;
    document.body.dataset.page = 'order';
    scrollTo(0, 0);
    swapped = true;
    (await import('./order.js')).default();
  } catch { /* покажем SSR-версию ниже */ }
  if (coarse && res.wa_url) {
    // мобильные: сразу в WhatsApp (переход по https-ссылке не блокируется попап-блокером)
    setTimeout(() => { location.href = res.wa_url; }, swapped ? 350 : 0);
  } else if (!swapped) {
    location.reload();
  }
}

/**
 * Отправка заказа (корзина или быстрый заказ): валидация → POST /api/orders → успех / ошибки полей / офлайн-fallback.
 * opts: items() — позиции, source — cart|quick, buttons — кнопки «Надсилаємо…», scope — где искать ошибку и офлайн-блок
 */
function bindSubmit(form, opts) {
  let pending = false, attemptUid = uid();
  const errBox = () => $('[data-form-error]', opts.scope);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (pending) return;
    errBox().hidden = true;
    const errs = validate(form);
    showErrors(form, errs);
    const first = Object.keys(errs)[0];
    if (first) { form.elements[first]?.focus?.(); return; }
    const customer = {
      name: form.elements.name.value.trim(), phone: form.elements.phone.value, city: form.elements.city.value.trim(),
      branch: form.elements.branch.value.trim(), contact: form.elements.contact.value || 'whatsapp', comment: (form.elements.comment?.value || '').trim(),
    };
    const items = opts.items();
    pending = true;
    setBusy(true, opts.buttons());
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const resp = await fetch('/api/orders', {
        method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ lang: config.lang, source: opts.source, items, customer, website: form.elements.website.value, ts: form.elements.ts.value, client_uid: attemptUid }),
      });
      clearTimeout(timer);
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 201) return await toSuccess(data, opts.source === 'quick' ? items.map(i => i.id) : null);
      if (resp.status === 422) {
        const err = data.errors || {};
        showErrors(form, err);
        if (err.items && opts.source === 'cart') await refresh();
        const f = Object.keys(err).find(k => form.elements[k]);
        if (f) form.elements[f].focus();
        if (err.form || err.items) { const box = errBox(); box.textContent = C.errors[err.items || err.form] || C.errors['error.generic']; box.hidden = false; }
        attemptUid = uid();
      } else if (resp.status === 429) {
        const box = errBox(); box.textContent = C.errors['error.rate']; box.hidden = false;
      } else {
        throw new Error('http ' + resp.status);
      }
    } catch {
      clearTimeout(timer);
      offlineFallback(form, customer, items, $('[data-offline]', opts.scope));
    } finally {
      pending = false;
      setBusy(false, opts.buttons());
    }
  });
}

function bindFields(form) {
  restoreForm(form);
  const phone = $('[data-phone]', form);
  const toEnd = () => { const n = phone.value.length; try { phone.setSelectionRange(n, n); } catch { /* type=tel */ } };
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); toEnd(); });
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+380 ('; requestAnimationFrame(toEnd); });
  phone.addEventListener('blur', () => { if (/^\+380 \(?$/.test(phone.value.trim())) phone.value = ''; });
  form.addEventListener('input', e => {
    saveForm(form);
    // ошибка исчезает, как только значение стало верным — во время ввода, а не в момент тапа по следующему полю
    // (иначе форма «прыгает» на высоту строки ошибки и тап по «Дзвінок» или «Оформити» промахивается)
    const name = e.target.name;
    if (name && e.target.getAttribute?.('aria-invalid') === 'true') {
      const errs = validate(form, name);
      if (!errs[name]) showErrors(form, errs, name);
    }
  });
  form.addEventListener('focusout', e => {
    const name = e.target.name;
    if (!name || !e.target.value) return;
    showErrors(form, validate(form, name), name);
  });
}

export default async function () {
  C = JSON.parse($('#oi-checkout')?.textContent || 'null');
  if (!C) return;
  initLines();
  const form = $('[data-checkout]');
  bindFields(form);
  bindSubmit(form, {
    source: 'cart', scope: $('[data-cart-page]'),
    items: () => cart.items(),
    buttons: () => $$('[data-submit]').filter(b => !b.closest('[data-quick-form]')),
  });
  $('[data-copy-link]').addEventListener('click', copyLink);
  if (navigator.share) {
    const b = $('[data-share-link]');
    b.hidden = false;
    b.addEventListener('click', () => navigator.share({ title: C.shareTitle, url: shareUrl() }).catch(() => {}));
  }
  cart.subscribe(render);
  await sharedFromUrl();
  await refresh();
}

/** Быстрый заказ со страницы товара: одна позиция (количество — как в корзине, иначе 1), корзина не трогается, кроме этого товара */
export function quickOrder(form, id) {
  C = C || JSON.parse($('#oi-checkout')?.textContent || 'null');
  if (!form || !C) return;
  bindFields(form);
  bindSubmit(form, {
    source: 'quick', scope: form,
    items: () => [{ id, qty: Math.max(1, cart.qty(id)) }],
    buttons: () => $$('[data-submit]', form),
  });
  form.elements.name?.focus({ preventScroll: true });
}
