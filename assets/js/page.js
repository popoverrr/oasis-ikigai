// Жизненный цикл страницы при мягких переходах (brief/10_MUSIC_V7.md § 4): всё, что страница создала вне своего <main>
// (наблюдатели, слушатели window/document, подписки на корзину, canvas лепестков, подмена панели корзины),
// регистрируется через onLeave() и убирается на событии 'oi:leave', перед заменой <main>.
const cleanups = [];

/** Зарегистрировать уборку для текущей страницы; возвращает саму функцию */
export function onLeave(fn) {
  if (typeof fn === 'function') cleanups.push(fn);
  return fn;
}

/** Убрать за текущей страницей (вызывается один раз на 'oi:leave') */
export function leavePage() {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch (e) { console.error(e); }
  }
}
