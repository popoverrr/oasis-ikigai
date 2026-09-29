/*!
 * glass.js — стеклянный блик для плашки «Вы заказываете оригинал» (OASIS IKIGAI, ES-модуль, без зависимостей)
 *
 *   import { initGlass } from '/assets/js/glass.js';
 *   const off = initGlass(root);        // root — документ или новый <main> после мягкого перехода
 *   addEventListener('oi:leave', off, { once: true });
 *
 * Разметка: у плашки атрибут data-glass. Модуль сам добавит внутрь слой .glass (aria-hidden).
 * Как работает: по плашке проходит широкий мягкий блик и тонкий острый — их положение зависит
 * от того, где плашка на экране (прокрутка вниз → блик едет слева направо). Когда блик проходит
 * мимо, вспыхивают мелкие искры. На десктопе блик ещё чуть тянется за курсором.
 * Блик накладывается режимом overlay: зелёный светлеет, чёрный текст остаётся чёрным — контраст не падает.
 * prefers-reduced-motion: только статичный стеклянный отлив, без движения.
 */
const CSS = `
[data-glass]{position:relative;isolation:isolate;overflow:hidden;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 0 rgba(0,0,0,.14),inset 0 0 0 1px rgba(255,255,255,.12)}
.glass,.glass-sp{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;overflow:hidden}
.glass{mix-blend-mode:overlay}          /* весь слой бликов — одним режимом: зелёный светлеет, чёрный текст не меняется */
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;
  background:linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 46%),
             radial-gradient(120% 80% at 85% 110%,rgba(255,255,255,.22),rgba(255,255,255,0) 60%)}
.glass__band{position:absolute;top:-30%;bottom:-30%;left:0;width:55%;will-change:transform;
  background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.18) 30%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.18) 70%,rgba(255,255,255,0) 100%);
  transform:translate3d(calc(var(--gx,-1) * 100% + var(--mx,0px)),0,0) skewX(-18deg)}
.glass__band--thin{width:12%;opacity:.8;
  background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.9) 50%,rgba(255,255,255,0));
  transform:translate3d(calc(var(--gx2,-1) * 100% + var(--mx,0px) * 1.6),0,0) skewX(-18deg)}
/* острая кромка блика — обычным наложением, чтобы стекло «сверкало»; идёт по центру широкой полосы */
.glass__edge{position:absolute;top:-30%;bottom:-30%;left:0;width:4%;will-change:transform;
  background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.34) 50%,rgba(255,255,255,0));
  transform:translate3d(calc(var(--gx,-1) * 1375% + 637.5% + var(--mx,0px)),0,0) skewX(-18deg)}
.glass__sp{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;opacity:var(--o,0);transform:scale(calc(.4 + var(--o,0) * .8));
  filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 9px rgba(255,255,255,.75));transition:opacity .12s linear}
.glass__sp::before{content:"";position:absolute;inset:0;background:#fff;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)}
:where([data-glass] > :not(.glass, .glass-sp)){position:relative;z-index:2}   /* :where — нулевая специфичность: свои position у детей плашки не перебиваются */
@media (prefers-reduced-motion: reduce){.glass__band,.glass__sp,.glass__edge{display:none}}
`;
const SPARKS = [[.18, .28], [.34, .72], [.52, .2], [.66, .62], [.8, .34], [.9, .78]];

export function initGlass(root = document) {
  if (!document.getElementById('glass-css')) { const s = document.createElement('style'); s.id = 'glass-css'; s.textContent = CSS; document.head.appendChild(s); }
  const els = [...root.querySelectorAll('[data-glass]')];
  if (!els.length) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = els.map(el => {
    let g = el.querySelector(':scope > .glass'), k = el.querySelector(':scope > .glass-sp');
    if (!g) {
      g = document.createElement('span'); g.className = 'glass'; g.setAttribute('aria-hidden', 'true');
      g.innerHTML = '<i class="glass__band"></i><i class="glass__band glass__band--thin"></i>';
      k = document.createElement('span'); k.className = 'glass-sp'; k.setAttribute('aria-hidden', 'true');
      k.innerHTML = '<i class="glass__edge"></i>' + SPARKS.map(([x, y]) => `<i class="glass__sp" style="left:${x * 100}%;top:${y * 100}%"></i>`).join('');
      el.append(g, k);
    }
    return { el, g, k, sp: [...k.querySelectorAll('.glass__sp')], vis: false, mx: 0, tmx: 0 };
  });
  if (reduced) return () => items.forEach(i => { i.g.remove(); i.k.remove(); });

  let raf = 0;
  const update = () => {
    raf = 0; const vh = innerHeight; let again = false;
    for (const it of items) {
      if (!it.vis) continue;
      const r = it.el.getBoundingClientRect();
      // p: 0 — плашка входит снизу, 1 — уходит вверх
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      const gx = -1.1 + p * 3.2;                       // широкий блик: из-за левого края за правый (в ширинах полосы)
      const gx2 = -2 + p * 11;                         // тонкий — быстрее и чуть позже
      it.mx += (it.tmx - it.mx) * .15; if (Math.abs(it.tmx - it.mx) > .5) again = true;
      it.g.style.setProperty('--gx', gx.toFixed(3));
      it.g.style.setProperty('--gx2', gx2.toFixed(3));
      it.g.style.setProperty('--mx', it.mx.toFixed(1) + 'px');
      const bandCenter = (gx * .55 + .275);            // центр широкой полосы в долях ширины плашки
      it.sp.forEach((s, i) => {
        const d = Math.abs(bandCenter - SPARKS[i][0] - (SPARKS[i][1] - .5) * .25);
        s.style.setProperty('--o', Math.max(0, 1 - d / .1).toFixed(2));
      });
    }
    if (again) raf = requestAnimationFrame(update);
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(update); };
  const io = new IntersectionObserver(es => { es.forEach(e => { const it = items.find(i => i.el === e.target); if (it) it.vis = e.isIntersecting; }); req(); });
  items.forEach(it => io.observe(it.el));
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req, { passive: true });
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onMove = e => { for (const it of items) { if (!it.vis) continue; const r = it.el.getBoundingClientRect(); it.tmx = ((e.clientX - r.left) / r.width - .5) * 60; } req(); };
  if (fine) addEventListener('pointermove', onMove, { passive: true });
  req();
  return () => {
    io.disconnect(); cancelAnimationFrame(raf);
    removeEventListener('scroll', req); removeEventListener('resize', req); removeEventListener('pointermove', onMove);
  };
}
