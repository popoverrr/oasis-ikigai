// Страница товара: галерея (свайп, точки/миниатюры, стрелки клавиатуры), липкая панель «До кошика · ціна» на мобайле, быстрый заказ
import { cart, MAX_QTY } from './cart.js';
import { str, product, money, fmt, isReduced } from './data.js';
import { $, $$, addWithFx, setCartbarOverride, toast, h, icon } from './ui.js';

function gallery() {
  const g = $('[data-gallery]'), track = g && $('[data-gallery-track]', g);
  if (!track) return;
  const slides = $$('[data-slide]', track), dots = $$('[data-gallery-dot]', g);
  if (slides.length < 2) return;
  let cur = 0;
  const go = i => {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: isReduced ? 'auto' : 'smooth' });
  };
  const mark = i => {
    cur = i;
    for (const d of dots) { if (+d.dataset.galleryDot === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); }
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio > .6) mark(slides.indexOf(e.target)); }), { root: track, threshold: [.6] });
  slides.forEach(s => io.observe(s));
  g.addEventListener('click', e => { const d = e.target.closest('[data-gallery-dot]'); if (d) go(+d.dataset.galleryDot); });
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
  });
}

function stickyBar(id, p) {
  const bar = $('[data-cartbar]'), buy = $('[data-pd-buy]');
  if (!bar || !buy || !$('[data-buy]', buy)) return;
  const cartHref = $('[data-cart-link]')?.href || '/cart';
  const render = (el, { n }) => {
    el.hidden = false;
    el.classList.remove('is-away');
    el.dataset.mode = 'product';
    const q = cart.qty(id);
    const info = h('a', { class: 'cartbar__info', href: cartHref },
      h('i', { 'data-cartbar-count': '', text: String(n), hidden: n === 0 ? '' : null }),
      h('span', { class: 'cartbar__text' }, h('span', { text: p.name + ' · ' }), h('span', { class: 'price', text: money(p.price) })));
    const right = q > 0
      ? h('div', { class: 'stepper', role: 'group', 'aria-label': fmt(str.qtyLabel, { name: p.name }) },
        h('button', { type: 'button', 'aria-label': str.decrease, 'data-bar-dec': '' }, icon('minus', 12, 12)),
        h('output', { 'aria-live': 'polite', text: String(q) }),
        h('button', { type: 'button', 'aria-label': str.increase, 'data-bar-inc': '' }, icon('plus', 12, 12)))
      : h('button', { class: 'btn btn--green', type: 'button', 'data-bar-add': '' }, h('span', { text: str.add }));
    el.replaceChildren(info, right);
  };
  bar.addEventListener('click', e => {
    if (bar.dataset.mode !== 'product') return;
    const add = e.target.closest('[data-bar-add]');
    if (add) addWithFx(add, id, 1);
    if (e.target.closest('[data-bar-inc]')) { if (cart.qty(id) >= MAX_QTY) toast(str.max); else cart.set(id, cart.qty(id) + 1); }
    if (e.target.closest('[data-bar-dec]')) cart.set(id, cart.qty(id) - 1);
  });
  const original = [...bar.cloneNode(true).childNodes];
  let overriding = false;
  new IntersectionObserver(([en]) => {
    const away = !en.isIntersecting && en.boundingClientRect.top < 0 && innerWidth < 900;
    if (away && !overriding) { overriding = true; setCartbarOverride(render); }
    if (!away && overriding) {
      overriding = false;
      bar.dataset.mode = 'cart';
      bar.replaceChildren(...original.map(n => n.cloneNode(true)));
      if (cart.count() === 0) bar.hidden = true;
      setCartbarOverride(null);
    }
  }).observe(buy);
}

export default async function () {
  gallery();
  const page = $('[data-product-page]');
  if (!page) return;
  const id = +page.dataset.productPage, p = product(id);
  if (!p) return;
  stickyBar(id, p);
  // быстрый заказ: форма подгружается из checkout.js только при раскрытии
  const quick = $('[data-quick]');
  quick?.addEventListener('toggle', () => {
    if (quick.open && !quick.dataset.ready) {
      quick.dataset.ready = '1';
      import('./checkout.js').then(m => m.quickOrder?.($('[data-quick-form]', quick), id)).catch(e => console.error(e));
    }
  });
}
