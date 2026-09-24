// Каталог: шторка фильтров (мобайл), мгновенное применение фильтров/сортировки/поиска без перезагрузки (?partial=1), «Показати ще»
import { $, $$, initReveal, renderCartUI, renderWish } from './ui.js';

export default function () {
  const form = $('[data-filters]'), res = $('[data-results]'), panel = $('[data-filters-panel]');
  if (!form || !res) return;
  const openBtn = $('[data-filters-open]'), count = $('[data-count]'), apply = $('[data-filters-apply]');
  const desktop = matchMedia('(min-width: 1024px)');

  // шторка фильтров
  const open = () => { panel.classList.add('is-open'); document.documentElement.classList.add('filters-open'); openBtn.setAttribute('aria-expanded', 'true'); $('button, input', panel)?.focus({ preventScroll: true }); };
  const close = () => { panel.classList.remove('is-open'); document.documentElement.classList.remove('filters-open'); openBtn.setAttribute('aria-expanded', 'false'); };
  openBtn?.addEventListener('click', open);
  $('[data-filters-close]', panel)?.addEventListener('click', () => { close(); openBtn.focus(); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('is-open')) { close(); openBtn.focus(); } });

  // поиск бренда внутри фильтра
  const bs = $('[data-brand-search]');
  bs?.addEventListener('input', () => {
    const q = bs.value.trim().toLowerCase();
    for (const l of $$('[data-brand-list] .check')) l.hidden = q !== '' && !l.textContent.toLowerCase().includes(q);
  });

  const query = (extra = {}) => {
    const fd = new FormData(form), p = new URLSearchParams();
    const brand = fd.getAll('brand[]'), cat = fd.getAll('category[]');
    if (fd.get('q')?.trim()) p.set('q', fd.get('q').trim());
    if (brand.length) p.set('brand', brand.join(','));
    if (cat.length) p.set('category', cat.join(','));
    for (const k of ['min', 'max']) if (+fd.get(k) > 0) p.set(k, fd.get(k));
    if (fd.get('stock')) p.set('stock', '1');
    if (fd.get('sort') && fd.get('sort') !== 'recommended') p.set('sort', fd.get('sort'));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  };

  let ctrl = null;
  async function load(params, { push = false, append = false } = {}) {
    ctrl?.abort();
    ctrl = new AbortController();
    res.classList.add('is-loading');
    const p = new URLSearchParams(params);
    p.set('partial', '1');
    try {
      const r = await fetch(form.action + '?' + p, { signal: ctrl.signal, headers: { Accept: 'text/html' } });
      if (!r.ok) throw new Error(r.status);
      const html = await r.text();
      const total = +(r.headers.get('X-Total') || 0);
      const y = scrollY;
      res.innerHTML = html;
      if (append) scrollTo({ top: y });
      p.delete('partial');
      const url = form.action + (p.toString() ? '?' + p : '');
      history[push ? 'pushState' : 'replaceState']({ shop: true }, '', url);
      const grid = $('[data-grid]', res);
      if (count && grid) count.textContent = grid.dataset.countText || total;
      if (apply && grid) apply.textContent = grid.dataset.applyText || apply.textContent;
      renderCartUI();
      renderWish();
      initReveal(res);
    } catch (e) {
      if (e.name !== 'AbortError') form.submit();
    } finally {
      res.classList.remove('is-loading');
    }
  }

  // изменение фильтров: на десктопе сразу, на мобайле — тоже сразу (кнопка «Показати N» только закрывает шторку)
  let t;
  form.addEventListener('change', e => {
    if (e.target.matches('[data-brand-search]')) return;
    clearTimeout(t);
    t = setTimeout(() => load(query()), 60);
  });
  form.addEventListener('input', e => {
    if (!e.target.matches('input[name=q], input[name=min], input[name=max]')) return;
    clearTimeout(t);
    t = setTimeout(() => load(query()), 350);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    load(query(), { push: true });
    if (!desktop.matches) close();
    document.activeElement?.blur?.();
  });
  $('[data-filters-reset]', form)?.addEventListener('click', e => {
    e.preventDefault();
    form.reset();
    for (const i of $$('input[type=checkbox]', form)) i.checked = false;
    for (const i of $$('input[type=number], input[type=search]', form)) i.value = '';
    load(new URLSearchParams(), { push: true });
  });
  res.addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (!more) return;
    e.preventDefault();
    const page = +(new URL(more.href).searchParams.get('page') || 2);
    load(query({ page }), { append: true });
  });
  addEventListener('popstate', () => location.reload());
  form.dataset.ready = '1';   // каталог готов принимать изменения фильтров (нужно статичному превью)
}
