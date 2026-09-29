// v11 (brief/14_EDITS_V11.md § 5): лента настоящих отзывов и форма «Залишити відгук» на странице товара.
// Текст отзыва свёрнут до 6 строк — «Читати повністю» / «Згорнути» появляется, только если текст не помещается.
// Форма — нижняя панель на телефоне и окно по центру на десктопе (как окно чата v10): Esc, крестик и тап мимо закрывают,
// фокус заперт внутри, страница под панелью не прокручивается. Отправка — fetch на /api/reviews (сервер проверяет всё ещё раз).
import { str, isReduced } from './data.js';
import { $, $$ } from './ui.js';
import { onLeave } from './page.js';

function clamp(root) {
  for (const card of $$('.reviews__rail .review', root)) {
    const p = $('.review__text', card), b = $('.review__more', card);
    if (!p || !b) continue;
    b.hidden = p.scrollHeight <= p.clientHeight + 2;
    if (b.dataset.bound) continue;
    b.dataset.bound = '1';
    b.addEventListener('click', () => {
      const open = card.classList.toggle('is-open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.textContent = open ? str.rvLess : str.rvMore;
    });
  }
}

function form(root) {
  const box = $('[data-review-form]', root), openBtn = $('[data-review-open]', root);
  if (!box || !openBtn) return;
  const f = $('form', box), html = document.documentElement;
  const err = $('[data-rvf-error]', box), ok = $('[data-rvf-ok]', box), submit = $('[type=submit]', f);
  const open = () => {
    box.hidden = false;
    html.classList.add('rvf-open');
    requestAnimationFrame(() => box.classList.add('is-open'));
    $('.rv__stars input', f)?.focus({ preventScroll: true });
  };
  const close = () => {
    if (box.hidden) return;
    box.classList.remove('is-open');
    html.classList.remove('rvf-open');
    setTimeout(() => { if (!box.classList.contains('is-open')) box.hidden = true; }, isReduced ? 0 : 220);
    openBtn.focus({ preventScroll: true });
  };
  openBtn.addEventListener('click', open);
  for (const x of $$('[data-rvf-close]', box)) x.addEventListener('click', close);
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const list = $$('input:not([type=hidden]):not([tabindex="-1"]), textarea, button', f).filter(el => el.getClientRects().length);
      const first = list[0], last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  const mark = errors => {
    for (const el of $$('[data-field]', f)) el.classList.toggle('is-invalid', Boolean(errors[el.dataset.field]));
    const firstBad = $('[data-field].is-invalid input, [data-field].is-invalid textarea', f);
    firstBad?.focus();
  };
  f.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    const fd = new FormData(f);
    const text = String(fd.get('text') || '').trim();
    const errors = {
      rating: !fd.get('rating'), name: !String(fd.get('name') || '').trim(), text: text.length < 10 || text.length > 1500, consent: !fd.get('consent'),
    };
    if (Object.values(errors).some(Boolean)) { mark(errors); return; }   // без галочки согласия форма не отправляется
    mark({});
    submit.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch(f.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        f.classList.add('is-sent');
        ok.hidden = false;
        for (const el of $$('[data-field], .field, .rvf__note, [type=submit]', f)) el.hidden = true;
        ok.focus?.();
      } else if (j.errors && !j.errors.form && !j.errors.rate) mark(j.errors);
      else err.hidden = false;
    } catch { err.hidden = false; }
    submit.removeAttribute('aria-busy');
  });
  onLeave(() => html.classList.remove('rvf-open'));
}

export default function (root = document) {
  clamp(root);
  form(root);
  const re = () => clamp(root);
  addEventListener('resize', re, { passive: true });
  onLeave(() => removeEventListener('resize', re));
}
