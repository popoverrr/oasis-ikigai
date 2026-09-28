// goals-fx5.js — плитки целей v5 (ES-модуль без зависимостей)
//   import { initGoals } from './goals-fx5.js'; initGoals();
// • .is-in — при первом появлении плитки на экране сцена спокойно «проявляется» (≈2,5 с), каскад по 0,2 с.
// • .is-live — пока плитка видна, сцена движется; вне экрана анимации на паузе (батарея, плавность).
// • Мини-плитки фильтра (.goal--mini) статичны.
export function initGoals(root = document) {
  const tiles = [...root.querySelectorAll('.goal:not(.goal--mini)')];
  root.querySelectorAll('.goal--mini').forEach(t => t.classList.add('is-in'));
  if (!tiles.length) return;
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    const t = e.target;
    t.classList.toggle('is-live', e.isIntersecting);
    if (e.isIntersecting && !t.classList.contains('is-in')) {
      setTimeout(() => t.classList.add('is-in'), (tiles.indexOf(t) % 3) * 200);
    }
  }), { threshold: .35 });
  tiles.forEach(t => io.observe(t));
}
