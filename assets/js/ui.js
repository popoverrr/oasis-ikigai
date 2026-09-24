// Общий интерфейс: шапка, меню-шторка, поиск, языки, тосты, «+»/степперы, обране, аккордеоны, появление при скролле, панель корзины
import { cart, MAX_QTY } from './cart.js';
import { config, str, product, fmt, money, sum, center, fetchProducts, isReduced } from './data.js';
import { attach, burst } from './petals.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const fine = matchMedia('(pointer: fine)').matches;
const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 300));

export function icon(name, w = 16, h = 16) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'icon'); svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.filter(k => k != null));
  return el;
}

// ── Тосты ───────────────────────────────────────────────
export function toast(text, { action, onAction, timeout = 2400 } = {}) {
  const box = $('[data-toasts]');
  if (!box) return;
  while (box.children.length > 2) box.firstElementChild.remove();
  const el = h('div', { class: 'toast' }, h('span', { text }));
  let timer;
  const close = () => { clearTimeout(timer); el.remove(); };
  if (action) {
    const btn = h('button', { type: 'button', text: action });
    btn.addEventListener('click', () => { onAction?.(); close(); });
    el.append(btn);
  }
  box.append(el);
  timer = setTimeout(close, timeout);
  return close;
}

// ── Шапка: прозрачная над hero, плотная после скролла, прячется при скролле вниз ──
function initHeader() {
  const hdr = $('[data-hdr]');
  if (!hdr) return;
  let lastY = scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = scrollY;
    hdr.classList.toggle('is-solid', y > 24);
    const busy = document.documentElement.classList.contains('menu-open') || !$('[data-search]').hidden;
    if (!busy && y > 320 && y > lastY + 4) hdr.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 320) hdr.classList.remove('is-hidden');
    lastY = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
}

// ── Меню-шторка (раскрывается кругом от бургера; ловушка фокуса, Esc) ──
function initMenu() {
  const menu = $('[data-menu]'), openBtn = $('[data-menu-open]');
  if (!menu || !openBtn) return;
  const focusables = () => $$('a[href], button:not([disabled])', menu);
  const open = () => {
    menu.hidden = false;
    document.documentElement.classList.add('menu-open');
    openBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    setTimeout(() => focusables()[1]?.focus({ preventScroll: true }), 80);
  };
  const close = () => {
    menu.classList.remove('is-open');
    document.documentElement.classList.remove('menu-open');
    openBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 600);
    openBtn.focus({ preventScroll: true });
  };
  openBtn.addEventListener('click', open);
  $('[data-menu-close]', menu)?.addEventListener('click', close);
  menu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = focusables(), first = f[0], last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  menu.addEventListener('click', e => { if (e.target.closest('a[href]')) close(); });
  matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches && menu.classList.contains('is-open')) close(); });
}

// ── Поиск в шапке ─────────────────────────────────────────
function initSearch() {
  const form = $('[data-search]'), openBtn = $('[data-search-open]');
  if (!form || !openBtn) return;
  const input = $('input', form);
  const close = () => { form.hidden = true; openBtn.focus(); };
  openBtn.addEventListener('click', () => { form.hidden = false; input.focus(); });
  $('[data-search-close]', form)?.addEventListener('click', close);
  form.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', e => { if (!input.value.trim()) { e.preventDefault(); input.focus(); } });
}

// ── Языки: cookie запоминает выбор ────────────────────────
function initLang() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lang-link]');
    if (a) document.cookie = `lang=${a.dataset.langLink};max-age=31536000;path=/;samesite=lax`;
  });
}

// ── Кнопка «+» ↔ степпер ─────────────────────────────────
function addControl(el, name) {
  if (el.dataset.style === 'big') {
    const btn = h('button', { class: 'btn btn--gold btn--block', type: 'button', 'data-add': '' }, h('span', { text: str.add }));
    return btn;
  }
  return h('button', { class: 'add', type: 'button', 'data-add': '', 'aria-label': fmt(str.addLabel, { name }) }, icon('plus', 14, 14));
}
function stepperControl(q, name, big) {
  return h('div', { class: 'stepper' + (big ? ' stepper--lg' : ''), role: 'group', 'aria-label': fmt(str.qtyLabel, { name }) },
    h('button', { type: 'button', 'data-dec': '', 'aria-label': `${str.decrease}: ${name}` }, icon('minus', 12, 12)),
    h('output', { 'aria-live': 'polite', 'aria-label': fmt(str.qtyNow, { n: q }), text: String(q) }),
    h('button', { type: 'button', 'data-inc': '', 'aria-label': `${str.increase}: ${name}` }, icon('plus', 12, 12)));
}
export function renderBuy(el) {
  const id = +el.dataset.buy, q = cart.qty(id);
  const name = el.dataset.name || product(id)?.name || el.closest('.card')?.querySelector('.card__t')?.textContent.trim() || '';
  const cur = el.firstElementChild, isStep = cur?.classList.contains('stepper');
  const had = document.activeElement && el.contains(document.activeElement);
  if (q > 0) {
    if (isStep) {
      const out = cur.querySelector('output');
      out.textContent = q;
      out.setAttribute('aria-label', fmt(str.qtyNow, { n: q }));
      return;
    }
    el.replaceChildren(stepperControl(q, name, el.dataset.style === 'big'));
    if (had) el.querySelector('[data-inc]')?.focus();
  } else if (isStep || !cur) {
    el.replaceChildren(addControl(el, name));
    if (had) el.querySelector('[data-add]')?.focus();
  }
}

// ── Полёт миниатюры в корзину (дуга, WAAPI) ──────────────
function cartTarget() {
  const bar = $('[data-cartbar]');
  if (bar && !bar.hidden && getComputedStyle(bar).display !== 'none' && !bar.classList.contains('is-away')) return $('[data-cartbar-count]', bar);
  $('[data-hdr]')?.classList.remove('is-hidden');
  return $('[data-cart-link]');
}
export function flyToCart(from) {
  if (isReduced) return;
  const root = from.closest('[data-fly-root], .card, .spot');
  const img = root?.querySelector('img');
  const target = cartTarget();
  if (!img || !target) return;
  const a = center(img), b = center(target);
  const size = Math.min(a.w, a.h, 120);
  const outer = h('div', { 'aria-hidden': 'true' });
  const pic = h('img', { src: img.currentSrc || img.src, alt: '' });
  outer.append(pic);
  Object.assign(outer.style, { position: 'fixed', left: a.x - size / 2 + 'px', top: a.y - size / 2 + 'px', width: size + 'px', height: size + 'px', zIndex: 95, pointerEvents: 'none' });
  Object.assign(pic.style, { width: '100%', height: '100%', objectFit: 'cover', boxShadow: '0 0 0 1px #B39765' });
  document.body.append(outer);
  const dx = b.x - a.x, dy = b.y - a.y, dur = 700;
  outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
  const lift = Math.min(160, Math.abs(dy) * .45 + 60);
  pic.animate([
    { transform: 'translateY(0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translateY(${Math.min(0, dy) - lift}px) scale(.6) rotate(-8deg)`, opacity: 1, offset: .42 },
    { transform: `translateY(${dy}px) scale(.14) rotate(-3deg)`, opacity: .6 },
  ], { duration: dur, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }).finished.then(() => { outer.remove(); bumpCounts(); });
}

function bumpCounts() {
  for (const s of $$('[data-cart-count]')) { s.classList.remove('is-bump'); void s.offsetWidth; s.classList.add('is-bump'); }
}

/** Добавление с микроанимацией: штамп кнопки, лепестки, полёт, счётчик, панель */
export function addWithFx(btn, id, n = 1) {
  if (cart.qty(id) >= MAX_QTY) { toast(str.max); return false; }
  const before = cart.count();
  cart.add(id, n);
  btn.classList.remove('is-stamp'); void btn.offsetWidth; btn.classList.add('is-stamp');
  const c = center(btn);
  burst(c.x, c.y, { count: fine ? 10 : 8, spread: .8, scale: .8 });
  flyToCart(btn);
  if (isReduced) bumpCounts();
  const bar = $('[data-cartbar]');
  if (bar && before > 0) { bar.classList.remove('is-bump'); void bar.offsetWidth; bar.classList.add('is-bump'); }
  return true;
}

function initBuy() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-buy] [data-add], [data-buy] [data-inc], [data-buy] [data-dec]');
    if (!b) return;
    e.preventDefault();
    const box = b.closest('[data-buy]'), id = +box.dataset.buy, q = cart.qty(id);
    if (b.hasAttribute('data-add')) addWithFx(b, id, 1);
    else if (b.hasAttribute('data-inc')) { if (q >= MAX_QTY) toast(str.max); else cart.set(id, q + 1); }
    else cart.set(id, q - 1);
  });
}

// ── Обране (localStorage, только id) ─────────────────────
const WKEY = 'oi_wish_v1';
export const wish = {
  ids() { try { return (JSON.parse(localStorage.getItem(WKEY) || '[]') || []).map(Number).filter(Boolean); } catch { return []; } },
  has(id) { return this.ids().includes(+id); },
  toggle(id) {
    id = +id;
    const list = this.ids(), on = !list.includes(id);
    const next = on ? [id, ...list].slice(0, 100) : list.filter(x => x !== id);
    try { localStorage.setItem(WKEY, JSON.stringify(next)); } catch { /* приватный режим */ }
    renderWish();
    document.dispatchEvent(new CustomEvent('oi:wish', { detail: { id, on } }));
    return on;
  },
};
export function renderWish() {
  const ids = wish.ids();
  for (const b of $$('[data-wish]')) b.setAttribute('aria-pressed', ids.includes(+b.dataset.wish) ? 'true' : 'false');
  for (const s of $$('[data-wish-count]')) { s.textContent = ids.length; s.hidden = ids.length === 0; }
}
function initWish() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wish]');
    if (!b) return;
    e.preventDefault();
    const on = wish.toggle(b.dataset.wish);
    if (on) { const c = center(b); burst(c.x, c.y, { count: 6, spread: .6, scale: .7 }); }
    toast(on ? str.wishAdded : str.wishRemoved);
  });
  addEventListener('storage', e => { if (e.key === WKEY) renderWish(); });
  renderWish();
}

// ── Аккордеоны: в группе [data-acc] открыт один ─────────────
function initAcc() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-acc-btn]');
    if (!btn) return;
    const item = btn.closest('.acc__item'), group = btn.closest('[data-acc]');
    const open = !item.classList.contains('is-open');
    if (group) for (const it of $$('.acc__item.is-open', group)) if (it !== item) { it.classList.remove('is-open'); $('[data-acc-btn]', it).setAttribute('aria-expanded', 'false'); }
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// ── Появление при скролле: секции, заголовки по словам, группы карточек лесенкой ──
export { center };
export function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  let n = 0;
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(' '); continue; }
          const w = h('span', { class: 'w' }, h('span', { text: part }));
          w.firstChild.style.setProperty('--n', n++);
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    }
  };
  walk(el);
}
export function initReveal(root = document) {
  const els = $$('[data-reveal], [data-reveal-item]', root).filter(el => !el.classList.contains('is-in'));
  if (isReduced || !('IntersectionObserver' in window)) { for (const el of els) el.classList.add('is-in'); return; }
  for (const el of els) if (el.matches('.h2[data-reveal]')) splitWords(el);
  const io = new IntersectionObserver(entries => {
    const batch = entries.filter(e => e.isIntersecting).map(e => e.target);
    batch.forEach((el, i) => {
      if (el.hasAttribute('data-reveal-item')) el.style.setProperty('--d', Math.min(i, 6) * 0.07 + 's');
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const el of els) io.observe(el);
}

// ── Лепестки в секциях (кроме hero — там свой запуск) ──────
function initPetals() {
  const list = $$('[data-petals]:not(.hero__petals)');
  if (list.length) idle(() => list.forEach(c => attach(c, { count: w => (w < 700 ? 14 : 26), interactive: false })));
}

// ── Счётчик в шапке и плавающая панель ────────────────────
let barOverride = null;
const asked = new Set();   // id, за которыми уже ходили на сервер (не спрашиваем по кругу)
/** product.js подменяет содержимое панели («До кошика · 1 290 ₴») */
export function setCartbarOverride(fn) {
  barOverride = fn;
  renderCartUI();
}

export function renderCartUI() {
  const items = cart.items(), n = items.reduce((a, b) => a + b.qty, 0);
  const missing = items.filter(i => !product(i.id) && !asked.has(i.id)).map(i => i.id);
  if (missing.length) {
    missing.forEach(id => asked.add(id));
    fetchProducts(missing).then(renderCartUI).catch(() => {});
  }
  const known = items.every(i => product(i.id));
  const total = known ? sum(items) : null;
  for (const s of $$('[data-cart-count]')) { s.textContent = n; s.hidden = n === 0; }
  for (const a of $$('[data-cart-link]')) a.setAttribute('aria-label', fmt(str.a11yCart, { n }));
  for (const el of $$('[data-buy]')) renderBuy(el);

  const bar = $('[data-cartbar]');
  if (bar) {
    if (barOverride) {
      barOverride(bar, { n, total });
    } else {
      const show = n > 0;
      if (show && bar.hidden) {
        bar.hidden = false;
        bar.classList.add('is-away');
        requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('is-away')));
      }
      if (!show && !bar.hidden) { bar.classList.add('is-away'); setTimeout(() => { if (cart.count() === 0) bar.hidden = true; }, 380); }
      $('[data-cartbar-count]', bar).textContent = n;
      $('[data-cartbar-label]', bar).textContent = fmt(str.cartBar, { n }).replace(/\s*·\s*\d+$/, '');
      $('[data-cartbar-sum]', bar).textContent = total != null ? money(total) : '';
    }
    document.body.classList.toggle('has-cartbar', !bar.hidden);
  }
}

export function init() {
  document.documentElement.classList.add('js');
  if (/[?&]freeze=1/.test(location.search)) document.documentElement.classList.add('freeze');
  initHeader();
  initMenu();
  initSearch();
  initLang();
  initBuy();
  initWish();
  initAcc();
  initReveal();
  initPetals();
  renderCartUI();
  cart.subscribe(renderCartUI);
  if (!cart.storageOk()) toast(str.storageOff, { timeout: 5000 });
}
