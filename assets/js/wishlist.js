// Обране: id из localStorage → карточки рендерит сервер (/wishlist?partial=1&ids=…), те же, что в каталоге
import { config } from './data.js';
import { $, wish, initReveal, renderCartUI, renderWish } from './ui.js';

export default function () {
  const box = $('[data-wishlist]'), empty = $('[data-wishlist-empty]');
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
  document.addEventListener('oi:wish', e => {
    if (e.detail.on) return;
    box.querySelector(`.card[data-product="${e.detail.id}"]`)?.remove();
    empty.hidden = box.children.length > 0;
  });
}
