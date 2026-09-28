// Звуки интерфейса (brief/08 § 10): нажатие, «в корзину», «заказ оформлен» — 40 %, файлы грузятся только при первом звуке.
// Фоновую музыку с v7 ведёт bgm.js (brief/10_MUSIC_V7.md); звуки, как и раньше, звучат только когда музыка включена
// одной общей кнопкой [data-music-toggle].
import { config } from './data.js';

const M = config.media || {};
const cache = {};
const musicOn = () => Boolean(window.__oiBgm?.on);

/** Звук интерфейса: 'tap' | 'add' | 'success' */
export function sfx(name) {
  if (!musicOn() || !M[name] || name === 'ambient') return;
  const a = cache[name] ||= Object.assign(new Audio(), { preload: 'none', src: M[name] });
  a.volume = .4;
  try { a.currentTime = 0; } catch { /* ещё не загружен */ }
  a.play().catch(() => {});
}

export function initSound() {
  if (M.tap) {
    document.addEventListener('click', e => {
      if (e.target.closest('a[href], button') && !e.target.closest('[data-add], [data-music-toggle]')) sfx('tap');
    });
  }
  // подпись на кнопке музыки в меню (видимый текст) — вслед за состоянием, которое ставит bgm.js
  const sync = b => { const s = b.querySelector('[data-music-label]'); if (s) s.textContent = b.getAttribute('aria-label') || s.textContent; };
  const mo = new MutationObserver(list => list.forEach(m => sync(m.target)));
  for (const b of document.querySelectorAll('[data-music-toggle][data-music-text]')) { sync(b); mo.observe(b, { attributes: true, attributeFilter: ['aria-label'] }); }
}
