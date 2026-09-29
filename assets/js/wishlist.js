// Обране: id из localStorage → карточки рендерит сервер (/wishlist?partial=1&ids=…), те же, что в каталоге
import { config, isReduced } from './data.js';
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
    const card = box.querySelector(`.card[data-product="${e.detail.id}"]`);
    const done = () => { card?.remove(); empty.hidden = box.children.length > 0; };
    // v11: карточка плавно исчезает (при «уменьшить движение» — сразу)
    if (card && !isReduced) card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished.then(done, done);
    else done();
  };
  document.addEventListener('oi:wish', off);
  onLeave(() => document.removeEventListener('oi:wish', off));
}
