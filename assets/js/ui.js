// Общий интерфейс: шапка, меню-шторка, поиск, языки (плашка выбора при первом входе), чат, тосты, «+»/степперы, обране, аккордеоны, появление при скролле, панель корзины
import { cart, MAX_QTY } from './cart.js';
import { config, str, product, fmt, money, sum, center, fetchProducts, isReduced } from './data.js';
import { attach, burst, PALETTE_ACCENT } from './petals.js';
import { sfx } from './sound.js';
import { onLeave } from './page.js';

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
    document.documentElement.classList.toggle('is-top', y <= 40);   // таблетка языка под логотипом видна только наверху
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
const LANG_COOKIE = 'oi_lang';
const setLangCookie = l => { document.cookie = `${LANG_COOKIE}=${l};max-age=31536000;path=/;samesite=lax`; };
function initLang() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lang-link]');
    if (a) setLangCookie(a.dataset.langLink);
  });
  if (!new RegExp(`(^|; )${LANG_COOKIE}=`).test(document.cookie)) setTimeout(langPicker, 600);
}

// Плашка выбора языка при первом входе (brief/08 § 2): рисует только JS, страница под ней индексируется как обычно.
// Выбор → cookie на год и та же страница на выбранном языке; крестик, фон или Esc → cookie с текущим языком.
function langPicker() {
  const P = config.picker;
  if (!P || document.querySelector('.lp')) return;
  const guess = (navigator.language || '').slice(0, 2).toLowerCase();
  const likely = P.langs.some(l => l.code === guess) ? guess : config.lang;
  const prev = document.activeElement;
  const box = h('div', { class: 'lp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lp-t' },
    h('div', { class: 'lp__card' },
      h('button', { class: 'icon-btn lp__x', type: 'button', 'aria-label': P.close, 'data-lp-close': '' }, icon('close', 20, 20)),
      h('p', { class: 'lp__t', id: 'lp-t', text: P.titles.join(' · ') }),
      h('div', { class: 'lp__btns' }, ...P.langs.map(l => h('a', {
        class: 'lp__b' + (l.code === likely ? ' is-likely' : ''), href: l.href, hreflang: l.code, lang: l.code, 'data-lang-link': l.code,
        'aria-current': l.code === config.lang ? 'true' : null,
      }, h('span', { text: l.name }), l.code === config.lang ? icon('check', 18, 18) : null))),
      h('p', { class: 'lp__note', text: P.note })));
  const close = () => {
    setLangCookie(config.lang);
    box.classList.add('is-out');
    setTimeout(() => box.remove(), isReduced ? 0 : 240);
    document.documentElement.classList.remove('lp-open');
    prev?.focus?.({ preventScroll: true });
  };
  box.addEventListener('click', e => {
    if (e.target === box || e.target.closest('[data-lp-close]')) { close(); return; }
    const a = e.target.closest('[data-lang-link]');
    if (a && a.dataset.langLink === config.lang) { e.preventDefault(); close(); }
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = $$('a[href], button', box), first = f[0], last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.body.append(box);
  document.documentElement.classList.add('lp-open');
  $('.lp__b.is-likely', box)?.focus({ preventScroll: true });
}

// ── Чат: зелёная кнопка → окно с WhatsApp и Telegram (brief/08 § 10) ──
// v10 (brief/13 § 2): на телефоне (< 768) — нижняя панель с затемнением: не зависит от того, где стоит кнопка (на первом экране
// она поднята вверх, и прежнее окно уезжало за верх экрана). Закрывается крестиком, тапом мимо, Esc, свайпом вниз > 80 px,
// на мягком переходе и при переходе в WhatsApp/Telegram; страница под панелью не прокручивается, фокус заперт в окне.
// На десктопе — окно у кнопки: вверх, если над ней хватает места, иначе вниз; всегда внутри экрана с отступом 12 px.
function initChat() {
  const root = $('[data-chat]');
  if (!root) return;
  const btn = $('[data-chat-open]', root), card = $('[data-chat-card]', root), scrim = $('[data-chat-scrim]', root);
  const sheet = matchMedia('(max-width: 767px)');
  const html = document.documentElement;
  let y0 = 0, raf = 0;
  const place = () => {
    raf = 0;
    if (card.hidden || sheet.matches) { card.style.left = card.style.top = ''; return; }
    const b = btn.getBoundingClientRect(), w = card.offsetWidth, ht = card.offsetHeight, gap = 12, m = 12;
    let top = b.top - gap - ht >= m ? b.top - gap - ht : b.bottom + gap;
    top = Math.max(m, Math.min(top, innerHeight - ht - m));
    card.style.left = Math.max(m, Math.min(b.right - w, innerWidth - w - m)) + 'px';
    card.style.top = top + 'px';
  };
  const replace = () => { if (!raf) raf = requestAnimationFrame(place); };
  const open = () => {
    if (!card.hidden) return;
    y0 = scrollY;
    card.hidden = false;
    if (scrim) scrim.hidden = false;
    card.setAttribute('aria-modal', sheet.matches ? 'true' : 'false');
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => root.classList.add('is-open'));
    if (sheet.matches) html.classList.add('chat-open');
    place();
    addEventListener('resize', replace);
    addEventListener('scroll', replace, { passive: true });
    $('a[href]', card)?.focus({ preventScroll: true });
  };
  const close = ({ focus = true, animate = true } = {}) => {
    if (card.hidden) return;
    btn.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    html.classList.remove('chat-open');
    removeEventListener('resize', replace);
    removeEventListener('scroll', replace);
    const done = () => {
      card.hidden = true;
      card.style.transform = '';
      if (scrim) scrim.hidden = true;
      if (Math.abs(scrollY - y0) > 1 && sheet.matches) scrollTo({ top: y0, behavior: 'instant' });   // позиция прокрутки — как до открытия
    };
    if (animate && sheet.matches && !isReduced) {
      card.animate([{ transform: card.style.transform || 'none' }, { transform: 'translateY(100%)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' }).finished.then(done, done);
    } else done();
    if (focus) btn.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => (card.hidden ? open() : close()));
  $('[data-chat-close]', root)?.addEventListener('click', () => close());
  scrim?.addEventListener('click', () => close());
  card.addEventListener('click', e => { if (e.target.closest('a[href]')) close({ focus: false, animate: false }); });   // ушли в WhatsApp/Telegram
  document.addEventListener('keydown', e => {
    if (card.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {                                     // фокус не выходит из окна
      const f = $$('a[href], button:not([disabled])', card), first = f[0], last = f.at(-1);
      if (!card.contains(document.activeElement)) { e.preventDefault(); first?.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-chat-ask]')) { e.preventDefault(); open(); return; }
    if (!card.hidden && !root.contains(e.target)) close({ focus: false });
  });
  // страница под панелью не прокручивается (iOS не всегда слушает overflow:hidden у html)
  document.addEventListener('touchmove', e => { if (!card.hidden && sheet.matches && !card.contains(e.target)) e.preventDefault(); }, { passive: false });
  // свайп панели вниз больше чем на 80 px — закрыть
  let t0 = null, dy = 0;
  card.addEventListener('touchstart', e => { if (sheet.matches && card.scrollTop <= 0) { t0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  card.addEventListener('touchmove', e => {
    if (t0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - t0);
    if (dy > 0) { e.preventDefault(); card.style.transform = `translateY(${dy}px)`; }
  }, { passive: false });
  card.addEventListener('touchend', () => {
    if (t0 == null) return;
    t0 = null;
    if (dy > 80) close();
    else if (dy > 0) {
      const from = card.style.transform;
      card.style.transform = '';
      if (!isReduced) card.animate([{ transform: from }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.22,.61,.36,1)' });
    }
  });
  sheet.addEventListener('change', () => close({ focus: false, animate: false }));
  addEventListener('oi:leave', () => close({ focus: false, animate: false }));
}

// ── Кнопка «+» ↔ степпер ─────────────────────────────────
function addControl(el, name) {
  if (el.dataset.style === 'big') {
    const btn = h('button', { class: 'btn btn--accent btn--block', type: 'button', 'data-add': '' }, h('span', { text: str.add }));
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
  // v10: после «+» кнопка 1,2 с показывает «✓», потом становится степпером
  const hold = +(el.dataset.hold || 0) - Date.now();
  if (q > 0 && !isStep && hold > 0 && cur?.classList.contains('is-ok')) {
    clearTimeout(el._hold);
    el._hold = setTimeout(() => renderBuy(el), hold);
    return;
  }
  if (q === 0 && cur?.classList.contains('is-ok')) cur.classList.remove('is-ok');
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
  Object.assign(pic.style, { width: '100%', height: '100%', objectFit: 'cover', boxShadow: '0 0 0 2px #2DCD31' });
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
  const box = btn.closest('[data-buy]');
  if (btn.classList.contains('add') && box && !isReduced) {   // v10: «+» → «✓» на 1,2 с (кросс-фейд иконок)
    if (!$('.add__ok', btn)) { const ok = icon('check', 15, 15); ok.classList.add('add__ok'); btn.append(ok); }
    btn.classList.add('is-ok');
    box.dataset.hold = String(Date.now() + 1200);
  }
  cart.add(id, n);
  sfx('add');
  btn.classList.remove('is-stamp'); void btn.offsetWidth; btn.classList.add('is-stamp');
  // салют розовыми лепестками сакуры (brief/08 § 1)
  const c = center(btn);
  burst(c.x, c.y, { count: 12, spread: .8, scale: .8, palette: PALETTE_ACCENT });
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
    if (on) { const c = center(b); burst(c.x, c.y, { count: 6, spread: .6, scale: .7, palette: PALETTE_ACCENT }); }
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
// v10 (brief/13 § 4, по мотивам itis.cafe, без библиотек): элементы появляются группами. Группа — ближайший [data-reveal-group]
// или родитель; когда элемент группы входит в экран, все её ещё не показанные элементы, которые уже на экране, появляются по очереди
// в порядке разметки: текст ([data-reveal]) — шаг 120 мс (0/120/240/360), карточки ([data-reveal-item]) — шаг 60 мс, не больше 6 подряд.
export function initReveal(root = document) {
  const els = $$('[data-reveal], [data-reveal-item]', root).filter(el => !el.classList.contains('is-in'));
  if (isReduced || !('IntersectionObserver' in window)) { for (const el of els) el.classList.add('is-in'); return; }
  for (const el of els) if (el.matches('.h2[data-reveal]')) splitWords(el);
  const group = new Map(els.map(el => [el, el.parentElement.closest('[data-reveal-group]') || el.parentElement]));
  for (const g of new Set(group.values())) g.setAttribute('data-reveal-group', '');
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * .9 && r.bottom > 0 && r.left < innerWidth && r.right > 0 && r.width > 0; };
  const io = new IntersectionObserver(entries => {
    const hit = entries.filter(e => e.isIntersecting && (e.intersectionRatio >= .2 || e.intersectionRect.height > innerHeight * .4)).map(e => e.target);
    for (const g of new Set(hit.map(el => group.get(el)))) {
      const list = els.filter(el => group.get(el) === g && !el.classList.contains('is-in') && (hit.includes(el) || onScreen(el)));
      list.forEach((el, i) => {
        const card = el.hasAttribute('data-reveal-item'), k = Math.min(i, card ? 5 : 3);
        el.style.setProperty('--i', k);
        el.style.setProperty('--d', (k * (card ? 60 : 120)) / 1000 + 's');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: [0, .05, .1, .2] });
  for (const el of els) io.observe(el);
  onLeave(() => io.disconnect());
}

// ── Лепестки в секциях (кроме hero — там свой запуск) ──────
export function initPetals(root = document) {
  const list = $$('[data-petals]:not(.hero__petals)', root);
  if (!list.length) return;
  let gone = false;
  const fx = [];
  onLeave(() => { gone = true; fx.forEach(f => f.destroy()); });
  idle(() => { if (!gone) list.forEach(c => fx.push(attach(c, { count: w => (w < 700 ? 14 : 26), interactive: false }))); });
}

/** После мягкого перехода: прозрачная шапка над видео только на главной, активный пункт меню (данные — на новом <main>) */
export function syncChrome(root) {
  const hdr = $('[data-hdr]');
  if (hdr) {
    hdr.classList.toggle('hdr--over', root.dataset.headerOver === '1');
    hdr.classList.remove('is-hidden');
  }
  for (const a of $$('[data-nav-key]')) {
    if (a.dataset.navKey === root.dataset.nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
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
    document.body.classList.toggle('has-cartbar', !bar.hidden && !document.body.classList.contains('no-cartbar'));
  }
}

export function init() {
  window.__oiUI = true;   // boot.js: скрипты запустились, страховка html.is-done не нужна
  document.documentElement.classList.add('js');
  if (/[?&]freeze=1/.test(location.search)) document.documentElement.classList.add('freeze');
  initHeader();
  initMenu();
  initSearch();
  initLang();
  initChat();
  initBuy();
  initWish();
  initAcc();
  renderCartUI();
  cart.subscribe(renderCartUI);
  if (!cart.storageOk()) toast(str.storageOff, { timeout: 5000 });
}
