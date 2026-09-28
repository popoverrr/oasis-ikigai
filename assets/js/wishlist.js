// Обране: id из localStorage → карточки рендерит сервер (/wishlist?partial=1&ids=…), те же, что в каталоге
import { config } from './data.js';
import { $, wish, initReveal, renderCartUI, renderWish } from './ui.js';
import { onLeave } from './page.js';

export default function (root = document) {
  const box = $('[data-wishlist]', root), empty = $('[data-wishlist-empty]', root);
  if (!box) return;
  const load = async () => {
    const ids = wish.ids();
    if (!ids.length) { box.replaceChildren(); empty.hidden = false; return; }
    try {
      const r = await fetch(`${config.prefix}/wishlist?partial=1&ids=${ids.join(',')}`, { headers: { Accept: 'text/html' } });
      box.innerHTML = r.ok ? await r.text() : '';
    } catch { box.innerHTML = ''; }
    empty.hidden = box.children.length > 0;
    renderCartUI();
    renderWish();
    initReveal(box);
  };
  load();
  // сняли сердечко прямо на странице «Обране» — карточка уходит
  const off = e => {
    if (e.detail.on) return;
    box.querySelector(`.card[data-product="${e.detail.id}"]`)?.remove();
    empty.hidden = box.children.length > 0;
  };
  document.addEventListener('oi:wish', off);
  onLeave(() => document.removeEventListener('oi:wish', off));
}
