/*!
 * petals.js v2.1 — лепестки OASIS IKIGAI (Canvas 2D, без зависимостей, ES-модуль). Палитра v2.1: белые лепестки + цвета целей.
 *
 *   import { attach, burst } from '/assets/js/petals.js';
 *   const ctrl = attach(document.querySelector('.hero__petals'));   // фон hero поверх видео
 *   burst(x, y);                                                     // салют из точки (добавление в корзину)
 *   burst(innerWidth / 2, innerHeight * .4, { count: 36, spread: 1.6 }); // экран «Заказ принят»
 *
 * Лепесток — настоящая форма с выемкой на кончике, радиальный градиент от светлого основания
 * к более плотной кромке, прожилка, лицевая и оборотная стороны (оборот насыщеннее), 3D-переворот
 * через масштаб по осям + яркость, три слоя глубины (дальний мелкий и медленный, ближний крупный,
 * размытый и быстрый), ветер порывами, реакция на скорость скролла и на курсор (десктоп).
 * Спрайты рендерятся один раз → кадр = N × drawImage, держит 60 fps на слабых телефонах.
 *
 * Уважает prefers-reduced-motion (статичная композиция), ?freeze=1 (детерминированный статичный
 * кадр для скриншотов), ставит на паузу вне экрана и во фоновой вкладке.
 */

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = () => /[?&]freeze=1\b/.test(location.search);

// Палитра v2.1: розового нет. Основные лепестки — белые (как снег из лепестков поверх видео с сакурой).
const PALETTE = {
  front: [[255, 255, 255], [248, 248, 248], [226, 226, 226]],
  back:  [[242, 242, 242], [228, 228, 228], [204, 204, 204]],
  vein:  'rgba(160,160,160,.5)',
};
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** Палитра лепестков из цвета цели: burst(x, y, { palette: paletteFrom('#FFD60A') }) */
export function paletteFrom(color) {
  const c = hex(color), w = [255, 255, 255], k = [0, 0, 0];
  return { front: [mix(c, w, .55), mix(c, w, .2), c], back: [mix(c, w, .35), c, mix(c, k, .18)], vein: 'rgba(0,0,0,.25)' };
}
export const PALETTE_GREEN = paletteFrom('#00BD00');

function petalPath(L, w) {
  const p = new Path2D(), W = L * w;
  p.moveTo(0, L * .5);                                          // основание (узкое)
  p.bezierCurveTo(-W * .35, L * .38, -W * .62, L * .02, -W * .5, -L * .28);
  p.bezierCurveTo(-W * .42, -L * .46, -W * .18, -L * .52, -W * .07, -L * .5);
  p.lineTo(0, -L * .38);                                        // выемка на кончике
  p.lineTo(W * .07, -L * .5);
  p.bezierCurveTo(W * .18, -L * .52, W * .42, -L * .46, W * .5, -L * .28);
  p.bezierCurveTo(W * .62, L * .02, W * .35, L * .38, 0, L * .5);
  return p;
}

// Спрайт одной стороны лепестка. blur > 0 — для ближнего слоя (глубина резкости).
function sprite(L, w, side, blur, palette) {
  const pad = Math.ceil(blur * 3 + 2), dpr = DPR();
  const cw = Math.ceil((L * w + pad * 2) * dpr), ch = Math.ceil((L + pad * 2) * dpr);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.scale(dpr, dpr); x.translate(cw / dpr / 2, ch / dpr / 2);
  if (blur) x.filter = `blur(${blur}px)`;                       // Safari < 18 просто без блюра — это нормально
  const [a, b, e] = palette[side];
  const g = x.createRadialGradient(0, L * .46, 0, 0, L * .05, L * .78);
  g.addColorStop(0, `rgb(${a})`); g.addColorStop(.5, `rgb(${b})`); g.addColorStop(1, `rgb(${e})`);
  x.fillStyle = g; x.fill(petalPath(L, w));
  if (!blur) {                                                   // прожилка только на резких
    x.strokeStyle = palette.vein; x.lineWidth = .6; x.globalAlpha = .45;
    x.beginPath(); x.moveTo(0, L * .44); x.quadraticCurveTo(L * .03, L * .05, 0, -L * .3); x.stroke();
  }
  return { img: c, w: cw / dpr, h: ch / dpr };
}

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/**
 * Запускает лепестки на canvas (canvas растягивается CSS-ом на контейнер).
 * opts: count (число | (width) => число), palette, wind (множитель ветра, 1), speed (1),
 *       interactive (реакция на курсор, по умолчанию только pointer:fine), scroll (реакция на скролл, true)
 * Возвращает { start, stop, destroy, burst }.
 */
export function attach(canvas, opts = {}) {
  if (!canvas || !canvas.getContext) return { start() {}, stop() {}, destroy() {}, burst() {} };
  const ctx = canvas.getContext('2d');
  const palette = opts.palette || PALETTE;
  const still = reduced() || frozen();
  const rand = frozen() ? rng(7) : Math.random;
  const r = (a, b) => a + rand() * (b - a);
  const interactive = opts.interactive ?? matchMedia('(pointer:fine)').matches;
  const count = opts.count ?? (w => (w < 700 ? 22 : 44));
  const speed = opts.speed ?? 1, windK = opts.wind ?? 1;

  let W = 0, H = 0, P = [], raf = 0, running = false, visible = true, last = 0;
  let scrollV = 0, lastY = scrollY, px = -1e4, py = -1e4;

  function make(i, n) {
    const z = i < Math.max(2, n * .1) ? 2 : (i % 3 === 0 ? 1 : 0);   // ~10 % ближних, треть средних
    const L = [9, 15, 28][z] * r(.8, 1.25), w = r(.62, .8), blur = z === 2 ? 2.4 : 0;
    return {
      x: r(0, W), y: r(-H * .15, H), z, L,
      front: sprite(L, w, 'front', blur, palette), back: sprite(L, w, 'back', blur, palette),
      vy: [16, 28, 50][z] * r(.8, 1.2), vx0: r(-6, 6), sw: r(.4, 1.2), ph: r(0, 6.28),
      rx: r(0, 6.28), ry: r(0, 6.28), rz: r(0, 6.28),
      wx: r(.6, 1.6), wy: r(.8, 2.1), wz: r(-.9, .9),
      a: [.5, .78, .92][z], kx: 0, ky: 0,
    };
  }

  function resize() {
    const dpr = DPR();
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const n = typeof count === 'function' ? count(W) : count;
    if (P.length !== n) { P = Array.from({ length: n }, (_, i) => make(i, n)).sort((a, b) => a.z - b.z); }
    if (still) paint();
  }

  function draw(p) {
    const sx = Math.cos(p.ry), sy = Math.cos(p.rx);
    const s = (sx * sy) >= 0 ? p.front : p.back;                   // лицевая или оборотная сторона
    const light = .6 + .4 * Math.abs(sx * sy);                      // «ребром» — темнее
    const dpr = DPR(), c = Math.cos(p.rz), si = Math.sin(p.rz);
    const ax = Math.max(.14, Math.abs(sx)), ay = Math.max(.2, Math.abs(sy));
    ctx.setTransform(c * ax * dpr, si * ax * dpr, -si * ay * dpr, c * ay * dpr, p.x * dpr, p.y * dpr);
    ctx.globalAlpha = p.a * light;
    ctx.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h);
  }

  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of P) draw(p);
  }

  function step(t) {
    raf = requestAnimationFrame(step);
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    const y = scrollY; scrollV += ((y - lastY) / Math.max(dt, .016) - scrollV) * .12; lastY = y;
    const boost = Math.max(-40, Math.min(160, scrollV * .08));
    const wind = windK * (18 * Math.sin(t / 4200) + 10 * Math.sin(t / 1300) + 6 * Math.sin(t / 700));
    for (const p of P) {
      if (interactive) {                                           // лёгкое отталкивание от курсора
        const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { const k = (1 - d2 / 14400) * 900 * dt; p.kx += dx * k / 60; p.ky += dy * k / 60; }
        p.kx *= .94; p.ky *= .94;
      }
      p.y += ((p.vy + boost * (.4 + p.z * .3)) * speed + p.ky) * dt;
      p.x += (p.vx0 + wind * (.5 + p.z * .4) + Math.sin(t / 900 * p.sw + p.ph) * 14 + p.kx) * speed * dt;
      p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      if (p.y - p.L > H) { p.y = -p.L * 2; p.x = r(-40, W); }
      if (p.y + p.L * 3 < 0 && boost < 0) p.y = H + p.L;
      if (p.x > W + 40) p.x = -40; else if (p.x < -40) p.x = W + 40;
    }
    paint();
  }

  function start() { if (still || running || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(step); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
  io.observe(canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  const onMove = e => { const b = canvas.getBoundingClientRect(); px = e.clientX - b.left; py = e.clientY - b.top; };
  if (interactive) addEventListener('pointermove', onMove, { passive: true });

  resize(); start();
  return {
    start, stop,
    destroy() { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove); },
    burst: (x, y, o) => burst(x, y, o),
  };
}

let overlay = null, parts = [], oraf = 0;

/**
 * Салют лепестков из точки (координаты окна). opts: count (10), spread (1), palette.
 * Слой создаётся на время анимации и удаляется. При reduced-motion ничего не делает.
 */
export function burst(x, y, opts = {}) {
  if (reduced()) return;
  const palette = opts.palette || PALETTE, n = opts.count ?? 10, spread = opts.spread ?? 1;
  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    document.body.appendChild(overlay);
    const dpr = DPR(); overlay.width = innerWidth * dpr; overlay.height = innerHeight * dpr;
  }
  for (let i = 0; i < n; i++) {
    const L = (10 + Math.random() * 12) * (opts.scale ?? 1), w = .62 + Math.random() * .16;
    const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * .9 * spread;
    const v = (160 + Math.random() * 260) * spread;
    parts.push({ x, y, L, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0, ttl: 1.1 + Math.random() * .7,
      rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
      wx: 3 + Math.random() * 5, wy: 3 + Math.random() * 6, wz: (Math.random() - .5) * 6,
      front: sprite(L, w, 'front', 0, palette), back: sprite(L, w, 'back', 0, palette) });
  }
  if (!oraf) { let last = 0; oraf = requestAnimationFrame(function tick(t) {
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    const c = overlay.getContext('2d'), dpr = DPR();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, overlay.width, overlay.height);
    parts = parts.filter(p => (p.life += dt) < p.ttl);
    for (const p of parts) {
      p.vx *= 1 - 1.8 * dt; p.vy = p.vy * (1 - 1.8 * dt) + 420 * dt;  // сопротивление воздуха + гравитация
      p.x += p.vx * dt; p.y += p.vy * dt; p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      const sx = Math.cos(p.ry), sy = Math.cos(p.rx), s = sx * sy >= 0 ? p.front : p.back;
      const co = Math.cos(p.rz), si = Math.sin(p.rz), ax = Math.max(.14, Math.abs(sx)), ay = Math.max(.2, Math.abs(sy));
      c.setTransform(co * ax * dpr, si * ax * dpr, -si * ay * dpr, co * ay * dpr, p.x * dpr, p.y * dpr);
      c.globalAlpha = Math.min(1, (p.ttl - p.life) / .35) * (.6 + .4 * Math.abs(sx * sy));
      c.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h);
    }
    if (parts.length) oraf = requestAnimationFrame(tick);
    else { overlay.remove(); overlay = null; oraf = 0; }
  }); }
}
