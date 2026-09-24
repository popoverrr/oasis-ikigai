// goals-fx.js — поведение плиток целей (ES-модуль, без зависимостей)
//   import { initGoals } from '/assets/js/goals-fx.js'; initGoals();
// • анимации идут только пока плитка на экране (класс is-live), вне экрана — пауза (экономит батарею);
// • «всплеск» (класс is-burst на 1 с): один раз при первом появлении каскадом, при наведении мыши и при нажатии;
// • при prefers-reduced-motion CSS сам показывает статичную композицию.
export function initGoals(root = document) {
  const tiles = [...root.querySelectorAll('.goal')];
  if (!tiles.length) return;
  const burst = t => {
    t.classList.remove('is-burst'); void t.offsetWidth; t.classList.add('is-burst');
    clearTimeout(t._b); t._b = setTimeout(() => t.classList.remove('is-burst'), 1000);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('is-live', e.isIntersecting);
    if (e.isIntersecting && !e.target.dataset.seen) {
      e.target.dataset.seen = '1';
      setTimeout(() => burst(e.target), 120 * tiles.indexOf(e.target) % 600);
    }
  }), { threshold: .3 });
  tiles.forEach(t => {
    io.observe(t);
    t.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') burst(t); });
    t.addEventListener('pointerdown', () => burst(t));
  });
}
