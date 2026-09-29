/*!
 * butterfly.js — «Бабочка Икигай» для OASIS IKIGAI (ES-модуль, без зависимостей, Canvas 2D)
 *
 *   import { initButterfly } from '/assets/js/butterfly.js';
 *   initButterfly({ catalogUrl: '/ru/shop', strings: STR.ru });
 *
 * Зелёная бабочка изредка и в случайный момент медленно пролетает по экрану со шлейфом лепестков сакуры,
 * искрами и мягкой аурой. Тап или клик по ней — «поимка»: вспышка, кольца, разлёт лепестков, бабочка
 * растворяется в свет, и появляется окошко «Вы поймали бабочку Икигай» с переходом в каталог.
 *
 * Интерфейсу не мешает:
 *   – холст поверх страницы с pointer-events: none; нажимается только сама бабочка (круг 56px);
 *   – не летает, когда открыто меню, чат, фильтры, модальное окно или в фокусе поле ввода;
 *   – пауза в фоновой вкладке; при prefers-reduced-motion — выключена полностью.
 * Первый вылет — гарантированно через firstAt (30 с) после захода на сайт; дальше — случайно:
 *   – при каждом просмотре страницы (и мягком переходе oi:page) шанс CHANCE, задержка — случайная в DELAY;
 *   – не чаще раза в COOLDOWN и не больше MAX_PER_SESSION за сессию.
 * Для проверки: ?butterfly=1 — вылет сразу, без лимитов; window.oiButterfly.fly() — вылет вручную.
 * Смена языка без перезагрузки: window.oiButterfly.set({ lang: 'en', catalogUrl: '/en/shop' }).
 * События: 'oi:butterfly' на window, detail = { type: 'show' | 'catch' | 'gone', count } — для звуков и аналитики.
 */

const TAU = Math.PI * 2;
const GREEN = '#2DCD31';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const LS_KEY = 'oi_ikb_v1', SS_KEY = 'oi_ikb_s';

export const STRINGS = {
  uk: { aria: 'Спіймати метелика Ікігаї', close: 'Закрити', cta: 'Зібрати своє ікігаї', counter: 'Спіймано метеликів: {n}',
        t1: 'Ви спіймали метелика Ікігаї!', p1: 'Кажуть, він прилітає до тих, хто готовий подбати про себе. Зберіть своє ікігаї в каталозі.',
        t2: 'Ще один метелик Ікігаї!', p2: 'Ви явно на правильному шляху. Зазирніть у каталог — там усе для вашого ритуалу.',
        t3: 'Справжній мисливець за ікігаї!', p3: 'Ваше ікігаї вже десь поруч — у каталозі.' },
  ru: { aria: 'Поймать бабочку Икигай', close: 'Закрыть', cta: 'Собрать своё икигай', counter: 'Поймано бабочек: {n}',
        t1: 'Вы поймали бабочку Икигай!', p1: 'Говорят, она прилетает к тем, кто готов позаботиться о себе. Соберите своё икигай в каталоге.',
        t2: 'Ещё одна бабочка Икигай!', p2: 'Вы явно на верном пути. Загляните в каталог — там всё для вашего ритуала.',
        t3: 'Настоящий ловец икигай!', p3: 'Ваше икигай уже где-то рядом — в каталоге.' },
  en: { aria: 'Catch the Ikigai butterfly', close: 'Close', cta: 'Find your ikigai', counter: 'Butterflies caught: {n}',
        t1: 'You caught the Ikigai butterfly!', p1: 'They say it visits those ready to take care of themselves. Find your ikigai in the catalogue.',
        t2: 'Another Ikigai butterfly!', p2: 'You are clearly on the right path. Take a look at the catalogue — everything for your ritual is there.',
        t3: 'A true ikigai hunter!', p3: 'Your ikigai is somewhere close — in the catalogue.' },
};

/* ---------- спрайты лепестков сакуры (рисуются один раз) ---------- */
function petalSprite(size, hueShift) {
  const c = document.createElement('canvas'), d = Math.ceil(size * 2.4);
  c.width = c.height = d;
  const g = c.getContext('2d'); g.translate(d / 2, d / 2);
  const L = size, W = size * .62;
  const p = new Path2D();
  p.moveTo(0, L * .55);
  p.bezierCurveTo(W, L * .25, W * .95, -L * .45, W * .22, -L * .55);   // правый край к выемке
  p.lineTo(0, -L * .38);                                                // выемка на кончике
  p.lineTo(-W * .22, -L * .55);
  p.bezierCurveTo(-W * .95, -L * .45, -W, L * .25, 0, L * .55);
  const gr = g.createRadialGradient(0, L * .45, 1, 0, 0, L * .9);
  gr.addColorStop(0, `hsl(${345 + hueShift} 70% 97%)`);
  gr.addColorStop(.55, `hsl(${342 + hueShift} 78% 88%)`);
  gr.addColorStop(1, `hsl(${338 + hueShift} 74% 70%)`);
  g.fillStyle = gr; g.fill(p);
  g.strokeStyle = 'rgba(214,110,150,.45)'; g.lineWidth = .6; g.stroke(p);
  g.strokeStyle = 'rgba(210,90,130,.25)'; g.beginPath(); g.moveTo(0, L * .5); g.quadraticCurveTo(W * .08, 0, 0, -L * .32); g.stroke();
  return c;
}

/* ---------- геометрия крыльев (правая половина, S = 1) ---------- */
const FORE = new Path2D('M0.02,-0.1 C0.2,-0.62 0.58,-1.02 0.96,-0.96 C1.12,-0.72 1.06,-0.34 0.86,-0.12 C0.62,0.02 0.3,0.05 0.03,0.05 Z');
const HIND = new Path2D('M0.03,0.03 C0.4,-0.02 0.86,0.08 0.9,0.36 C0.93,0.6 0.7,0.74 0.52,0.78 C0.46,0.9 0.38,1 0.31,1.05 C0.26,0.92 0.21,0.78 0.15,0.66 C0.08,0.5 0.04,0.32 0.02,0.16 Z');
const FORE_VEINS = [[0.03, -0.05, 0.6, -0.9], [0.03, -0.03, 0.95, -0.72], [0.03, -0.01, 1.02, -0.42], [0.03, 0.01, 0.9, -0.18], [0.03, 0.02, 0.6, -0.03]];
const HIND_VEINS = [[0.03, 0.05, 0.84, 0.26], [0.03, 0.08, 0.82, 0.56], [0.03, 0.1, 0.52, 0.75], [0.03, 0.12, 0.3, 0.98]];
const FORE_SPOTS = [[0.9, -0.86, .036], [1.0, -0.68, .032], [1.0, -0.5, .028], [0.93, -0.32, .024], [0.74, -0.93, .026], [0.8, -0.18, .02]];
const HIND_SPOTS = [[0.84, 0.44, .032], [0.72, 0.62, .028], [0.56, 0.72, .024], [0.33, 0.96, .02]];

function drawWing(g, S, path, veins, spots, t, under) {
  g.save(); g.scale(S, S);
  // основной цвет: от глубокого изумруда у тела к фирменному зелёному и мятному краю
  const gr = g.createRadialGradient(0.05, 0, 0.02, 0.1, 0, 1.05);
  if (under) { gr.addColorStop(0, '#032010'); gr.addColorStop(.6, '#0B4F1D'); gr.addColorStop(1, '#3E8F4C'); }
  else { gr.addColorStop(0, '#021d0b'); gr.addColorStop(.28, '#07501a'); gr.addColorStop(.55, '#169A2E'); gr.addColorStop(.78, GREEN); gr.addColorStop(.93, '#B7F7BE'); gr.addColorStop(1, '#F4FFF4'); }
  g.fillStyle = gr; g.fill(path);
  g.shadowBlur = 0;                                   // свечение — только у заливки, не у прожилок и точек
  // переливы: полупрозрачная бегущая полоса
  if (!under) {
    const k = (Math.sin(t * 1.3) + 1) / 2;
    const ir = g.createLinearGradient(0, -1, 1, 1);
    ir.addColorStop(0, 'rgba(120,255,220,0)'); ir.addColorStop(clamp(k * .8, 0, .8), 'rgba(150,255,230,.32)'); ir.addColorStop(1, 'rgba(210,255,140,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = ir; g.fill(path); g.globalCompositeOperation = 'source-over';
  }
  // прожилки
  g.lineWidth = 0.012; g.strokeStyle = under ? 'rgba(160,230,170,.25)' : 'rgba(0,40,12,.45)';
  for (const [x1, y1, x2, y2] of veins) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2 + .05, (y1 + y2) / 2 - .03, x2, y2); g.stroke(); }
  // тёмная кайма и светлые точки по краю
  g.save(); g.clip(path); g.lineWidth = 0.09; g.strokeStyle = under ? 'rgba(0,20,8,.35)' : 'rgba(2,34,12,.55)'; g.stroke(path); g.restore();
  g.fillStyle = under ? 'rgba(220,255,225,.5)' : 'rgba(236,255,238,.95)';
  for (const [x, y, r] of spots) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  // мерцающая пыльца
  if (!under) {
    g.fillStyle = 'rgba(235,255,238,.85)';
    for (let i = 0; i < 6; i++) { const a = t * 2 + i * 1.7, x = .35 + .45 * ((i * .37) % 1), y = (path === FORE ? -.55 : .38) + .25 * Math.sin(i * 2.1);
      g.globalAlpha = .35 + .35 * Math.sin(a); g.beginPath(); g.arc(x, y, .012, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  // тонкий светящийся контур
  g.lineWidth = 0.018; g.strokeStyle = under ? 'rgba(170,255,190,.35)' : 'rgba(215,255,220,.9)'; g.stroke(path);
  g.restore();
}

function drawButterfly(g, x, y, S, rot, open, t, alpha, glow) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
  // аура
  const ar = S * (2.6 + Math.sin(t * 2.1) * .25) * (1 + glow * .8);
  const au = g.createRadialGradient(0, 0, 0, 0, 0, ar);
  au.addColorStop(0, `rgba(120,255,140,${.28 + glow * .35})`); au.addColorStop(.45, `rgba(45,205,49,${.12 + glow * .2})`); au.addColorStop(1, 'rgba(45,205,49,0)');
  g.fillStyle = au; g.beginPath(); g.arc(0, 0, ar, 0, TAU); g.fill();
  // крылья: открытость open 0..1 — это поворот крыла вокруг тела (сжатие по горизонтали)
  const under = open < .22;
  g.shadowColor = 'rgba(90,255,120,.85)'; g.shadowBlur = S * (.35 + glow * .6);
  for (const side of [-1, 1]) {
    g.save(); g.scale(side * Math.max(open, .06), 1);
    const lag = clamp(open + .06, .06, 1) / Math.max(open, .06);   // задние крылья чуть отстают
    g.save(); g.scale(lag, .98); drawWing(g, S * .9, HIND, HIND_VEINS, HIND_SPOTS, t + .4, under); g.restore();
    drawWing(g, S, FORE, FORE_VEINS, FORE_SPOTS, t, under);
    g.restore();
  }
  g.shadowBlur = 0;
  // тело: брюшко, грудь, голова
  g.fillStyle = '#021a09';
  g.beginPath(); g.ellipse(0, S * .32, S * .05, S * .34, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, -S * .02, S * .07, S * .14, 0, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, -S * .2, S * .055, 0, TAU); g.fill();
  const bs = g.createLinearGradient(-S * .06, 0, S * .06, 0);
  bs.addColorStop(0, 'rgba(120,255,150,0)'); bs.addColorStop(.5, 'rgba(160,255,180,.55)'); bs.addColorStop(1, 'rgba(120,255,150,0)');
  g.fillStyle = bs; g.beginPath(); g.ellipse(0, S * .1, S * .03, S * .5, 0, 0, TAU); g.fill();
  // усики с булавами
  g.strokeStyle = 'rgba(10,40,16,.95)'; g.lineWidth = Math.max(1, S * .018);
  for (const s of [-1, 1]) {
    const sway = Math.sin(t * 3 + s) * S * .03;
    g.beginPath(); g.moveTo(s * S * .02, -S * .24); g.quadraticCurveTo(s * S * .1, -S * .5, s * S * .22 + sway, -S * .62); g.stroke();
    g.fillStyle = '#C9FFD0'; g.shadowColor = 'rgba(140,255,160,.9)'; g.shadowBlur = S * .2;
    g.beginPath(); g.arc(s * S * .22 + sway, -S * .62, S * .03, 0, TAU); g.fill(); g.shadowBlur = 0;
  }
  g.restore();
}

function drawSparkle(g, x, y, r, a, green) {
  g.save(); g.translate(x, y); g.globalAlpha = a;
  g.fillStyle = green ? '#27C22C' : '#EFFFF0'; g.shadowColor = green ? 'rgba(20,120,30,.9)' : 'rgba(80,255,110,1)'; g.shadowBlur = r * (green ? 1.5 : 3);
  g.beginPath();
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr = i % 2 ? r * .28 : r; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
  g.closePath(); g.fill(); g.restore();
}

/* ---------- путь: сглаженная кривая через случайные точки ---------- */
function makePath(w, h) {
  const m = 40, top = 90, bottom = h - 150;
  const fromLeft = Math.random() < .5;
  const pts = [{ x: fromLeft ? -80 : w + 80, y: rnd(top + 40, bottom) }];
  const n = w < 700 ? 3 : 4;
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    pts.push({ x: fromLeft ? m + k * (w - 2 * m) + rnd(-60, 60) : w - m - k * (w - 2 * m) + rnd(-60, 60), y: rnd(top, bottom) });
  }
  pts.push({ x: fromLeft ? w + 90 : -90, y: rnd(top, bottom * .8) });
  // Catmull-Rom → плотная выборка с длиной дуги
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    for (let s = 0; s < 40; s++) {
      const t = s / 40, t2 = t * t, t3 = t2 * t, [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      out.push({
        x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  let L = 0; out[0].d = 0;
  for (let i = 1; i < out.length; i++) { L += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y); out[i].d = L; }
  return { pts: out, len: L };
}
function pointAt(path, d) {
  const a = path.pts; let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid].d < d) lo = mid; else hi = mid; }
  const A = a[lo], B = a[hi], k = (d - A.d) / ((B.d - A.d) || 1);
  return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, dx: B.x - A.x, dy: B.y - A.y };
}

/* ---------- стили окошка и кнопки (внедряются один раз) ---------- */
const CSS = `
.ikb-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:var(--ikb-z,39)}
.ikb-hit{position:fixed;left:0;top:0;width:60px;height:60px;margin:-30px 0 0 -30px;border:0;padding:0;border-radius:50%;background:transparent;
  cursor:pointer;z-index:var(--ikb-z,39);touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.ikb-hit:focus-visible{outline:2px solid ${GREEN};outline-offset:2px}
.ikb-card{position:fixed;z-index:var(--ikb-card-z,47);width:min(340px,calc(100vw - 32px));padding:20px 20px 18px;border-radius:20px;color:#fff;
  background:rgba(8,14,10,.88);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);
  box-shadow:inset 0 0 0 1px rgba(45,205,49,.55),0 24px 60px -18px rgba(45,205,49,.55),0 8px 30px rgba(0,0,0,.45);
  opacity:0;transform:translateY(14px) scale(.94);transition:opacity .32s ease,transform .42s cubic-bezier(.22,1.2,.36,1)}
.ikb-card.is-in{opacity:1;transform:none}
.ikb-card__k{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${GREEN}}
.ikb-card__t{margin:0 36px 6px 0;font-size:20px;line-height:1.2;font-weight:700}
.ikb-card__p{margin:0 0 16px;font-size:14px;line-height:1.45;color:rgba(255,255,255,.82)}
.ikb-card__cta{display:flex;align-items:center;justify-content:center;gap:10px;height:48px;border-radius:999px;background:${GREEN};color:#000;
  font-weight:500;font-size:15px;text-decoration:none;transition:transform .12s ease}
.ikb-card__cta:active{transform:scale(.97)}
.ikb-card__x{position:absolute;right:10px;top:10px;width:44px;height:44px;border-radius:50%;border:0;background:transparent;color:#fff;font-size:24px;line-height:1;cursor:pointer}
.ikb-card__x:focus-visible,.ikb-card__cta:focus-visible{outline:2px solid ${GREEN};outline-offset:3px}
.ikb-card__ico{position:absolute;right:41px;top:-3px;width:68px;height:68px;pointer-events:none}   /* холст с запасом: аура затухает до края, без «квадрата» */
@media (max-width:600px){.ikb-card{left:50%!important;top:auto!important;bottom:calc(96px + env(safe-area-inset-bottom));margin-left:calc(min(340px,calc(100vw - 32px)) / -2)}}
`;

export function initButterfly(opts = {}) {
  if (typeof window === 'undefined') return null;
  if (window.__oiButterfly) return window.__oiButterfly;
  const o = {
    chance: .22, delay: [6000, 45000], maxPerSession: 3, cooldown: 90000, speed: null, zIndex: 39, cardZIndex: 47, firstAt: 30000,
    catalogUrl: '/shop', lang: (document.documentElement.lang || 'uk').slice(0, 2), strings: null,
    exclude: [/^\/admin/, /^\/install/], ...opts,
  };
  const pick = () => o.strings || STRINGS[o.lang === 'ua' ? 'uk' : o.lang] || STRINGS.uk;
  let S_ = pick();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const force = /[?&]butterfly=1\b/.test(location.search);
  if (!document.getElementById('ikb-css')) { const st = document.createElement('style'); st.id = 'ikb-css'; st.textContent = CSS; document.head.appendChild(st); }
  document.documentElement.style.setProperty('--ikb-z', o.zIndex);
  document.documentElement.style.setProperty('--ikb-card-z', o.cardZIndex);

  let cv, g, hit, card, raf = 0, timer = 0, last = 0, dpr = 1, W = 0, H = 0;
  let state = 'idle';          // idle | fly | catch | fade
  let B = null;                // бабочка
  const parts = [];            // частицы: лепестки, искры, кольца
  const petals = [0, 1, 2].map(i => petalSprite(9, i * 6 - 6));

  const sess = () => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{"n":0,"last":0}'); } catch { return { n: 0, last: 0 }; } };
  // начало визита: запоминаем один раз за сессию вкладки — переживает и мягкие переходы, и обычную перезагрузку
  { const s0 = sess(); if (!s0.start) { s0.start = Math.round(Math.min(Date.now(), performance.timeOrigin || Date.now())); try { sessionStorage.setItem(SS_KEY, JSON.stringify(s0)); } catch {} } }
  const setSess = v => { try { sessionStorage.setItem(SS_KEY, JSON.stringify(v)); } catch {} };
  const caught = () => { try { return (JSON.parse(localStorage.getItem(LS_KEY) || '{}').caught) || 0; } catch { return 0; } };
  const setCaught = n => { try { localStorage.setItem(LS_KEY, JSON.stringify({ caught: n })); } catch {} };
  const emit = (type, extra) => window.dispatchEvent(new CustomEvent('oi:butterfly', { detail: { type, count: caught(), ...extra } }));

  function busy() {
    if (document.hidden) return true;
    const a = document.activeElement;
    if (a && (a.matches('input, textarea, select') || a.isContentEditable)) return true;
    for (const m of document.querySelectorAll('[aria-modal="true"], .menu.is-open, .filters.is-open, .chat.is-open, .lp'))
      if (m.getClientRects().length && getComputedStyle(m).visibility !== 'hidden' && getComputedStyle(m).display !== 'none') return true;
    return false;
  }
  const excluded = () => o.exclude.some(r => r.test(location.pathname));

  function schedule() {
    clearTimeout(timer);
    if (state !== 'idle' || reduced.matches || excluded()) return;
    if (force) { timer = setTimeout(() => fly(true), 800); return; }
    const s = sess();
    // Гарантированный первый вылет: через firstAt мс после захода на сайт, если за визит бабочки ещё не было.
    // Если в этот момент открыто меню/чат/поле ввода или человек в корзине — ждём и пробуем каждые 3 с.
    if (o.firstAt != null && !s.n) {
      const guaranteed = () => { if (state !== 'idle') return; if (busy()) { timer = setTimeout(guaranteed, 3000); return; } fly(); };
      timer = setTimeout(guaranteed, Math.max(1500, (s.start || Date.now()) + o.firstAt - Date.now()));
      return;
    }
    if (s.n >= o.maxPerSession || Date.now() - s.last < o.cooldown) return;
    if (Math.random() > o.chance) return;
    let tries = 0;
    const attempt = () => {
      if (state !== 'idle') return;
      if (busy()) { if (++tries < 8) timer = setTimeout(attempt, 5000); return; }
      fly();
    };
    timer = setTimeout(attempt, rnd(o.delay[0], o.delay[1]));
  }

  function mount() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'ikb-canvas'; cv.setAttribute('aria-hidden', 'true');
    g = cv.getContext('2d');
    hit = document.createElement('button'); hit.type = 'button'; hit.className = 'ikb-hit'; hit.tabIndex = -1; hit.setAttribute('aria-label', S_.aria);
    hit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doCatch(); });
    hit.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    document.body.append(cv, hit);
    resize(); addEventListener('resize', resize, { passive: true });
  }
  function unmount() {
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener('resize', resize);
    cv?.remove(); hit?.remove(); cv = g = hit = null; parts.length = 0; B = null; state = 'idle';
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    if (!cv) return; cv.width = W * dpr; cv.height = H * dpr;
  }

  function fly(bypass) {
    if (state !== 'idle' || reduced.matches) return;
    if (!bypass) { const s = sess(); setSess({ ...s, n: s.n + 1, last: Date.now() }); }
    mount();
    const small = W < 700;
    const path = makePath(W, H);
    B = { path, d: 0, speed: o.speed || (small ? 46 : 62), S: small ? 26 : 32, t: 0, phase: rnd(0, TAU), glide: 0, x: -999, y: -999, rot: 0, alpha: 1, scale: 1, glow: 0, emitP: 0, emitS: 0 };
    state = 'fly'; last = performance.now(); emit('show');
    raf = requestAnimationFrame(tick);
  }

  function spawnPetal(x, y, burst) {
    const a = burst ? rnd(0, TAU) : rnd(Math.PI * .35, Math.PI * .65), v = burst ? rnd(70, 230) : rnd(8, 26);
    parts.push({ k: 'p', x, y, vx: Math.cos(a) * v + (burst ? 0 : rnd(-10, 10)), vy: Math.sin(a) * v, r: rnd(0, TAU), vr: rnd(-2.2, 2.2),
      f: rnd(0, TAU), vf: rnd(2, 4), s: rnd(.55, 1.05) * (burst ? 1.15 : 1), life: burst ? rnd(1.6, 2.6) : rnd(2.4, 3.4), age: 0, img: petals[(Math.random() * 3) | 0] });
  }
  function spawnSpark(x, y, burst) {
    const a = rnd(0, TAU), v = burst ? rnd(60, 260) : rnd(4, 18);
    parts.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (burst ? 0 : 10), r: rnd(1.6, burst ? 4.2 : 3.2), tw: rnd(0, TAU), green: Math.random() < .45, life: burst ? rnd(.8, 1.5) : rnd(.9, 1.6), age: 0 });
  }

  function doCatch() {
    if (state !== 'fly' || !B) return;
    state = 'catch'; B.ct = 0;
    // «Призрачный» клик: на телефоне после тапа браузер шлёт click в точку тапа. Если кнопка-мишень
    // уже пропустила его сквозь себя, он попадёт в карточку товара или ссылку под бабочкой и уведёт
    // со страницы. Поэтому мишень остаётся на месте ещё 500 мс и гасит click, а на документе стоит
    // страховка: 800 мс любой click в радиусе 64px от места поимки поглощается.
    const h = hit, cx = B.x, cy = B.y;
    setTimeout(() => { if (h) h.style.pointerEvents = 'none'; }, 500);
    const swallow = e => { if (Math.hypot(e.clientX - cx, e.clientY - cy) < 64) { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('click', swallow, true);
    setTimeout(() => document.removeEventListener('click', swallow, true), 800);
    const n = caught() + 1; setCaught(n);
    for (let i = 0; i < 34; i++) spawnPetal(B.x, B.y, true);
    for (let i = 0; i < 46; i++) spawnSpark(B.x, B.y, true);
    parts.push({ k: 'ring', x: B.x, y: B.y, age: 0, life: 1.1, R: Math.min(W, H) * .32 });
    parts.push({ k: 'ring', x: B.x, y: B.y, age: -.18, life: 1.2, R: Math.min(W, H) * .22 });
    parts.push({ k: 'rays', x: B.x, y: B.y, age: 0, life: 1.0 });
    try { navigator.vibrate?.(18); } catch {}
    emit('catch', { count: n });
    setTimeout(() => showCard(B ? B.x : W / 2, B ? B.y : H / 2, n), 650);
  }

  function showCard(x, y, n) {
    card?.remove();
    const v = n >= 3 ? 3 : n;
    card = document.createElement('div'); card.className = 'ikb-card'; card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite');
    card.innerHTML = `<button class="ikb-card__x" type="button" aria-label="${S_.close}">×</button>
      <canvas class="ikb-card__ico" width="136" height="136" aria-hidden="true"></canvas>
      <p class="ikb-card__k">${S_.counter.replace('{n}', n)}</p>
      <h3 class="ikb-card__t" id="ikb-t">${S_['t' + v]}</h3>
      <p class="ikb-card__p">${S_['p' + v]}</p>
      <a class="ikb-card__cta" href="${o.catalogUrl}">${S_.cta}<span aria-hidden="true">→</span></a>`;
    document.body.appendChild(card);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    card.style.left = clamp(x - cw / 2, 16, W - cw - 16) + 'px';
    card.style.top = clamp(y - ch - 40 < 80 ? y + 50 : y - ch - 40, 80, H - ch - 110) + 'px';
    requestAnimationFrame(() => card.classList.add('is-in'));
    // мини-бабочка в углу окошка
    const ic = card.querySelector('.ikb-card__ico'), ig = ic.getContext('2d'); let it = 0, iraf;
    const iconLoop = () => { it += 1 / 60; ig.clearRect(0, 0, 136, 136); drawButterfly(ig, 68, 70, 20, 0, .55 + .45 * Math.cos(it * 5), it, 1, 0); iraf = requestAnimationFrame(iconLoop); };
    iconLoop();
    const close = () => { cancelAnimationFrame(iraf); card?.classList.remove('is-in'); const c = card; card = null; setTimeout(() => c?.remove(), 350); removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    card.querySelector('.ikb-card__x').addEventListener('click', close);
    card.querySelector('.ikb-card__cta').addEventListener('click', () => setTimeout(close, 50));
    let auto = setTimeout(close, 9000);
    card.addEventListener('pointerenter', () => clearTimeout(auto));
    card.addEventListener('focusin', () => clearTimeout(auto));
    addEventListener('oi:leave', close, { once: true });
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    if (document.hidden) { raf = requestAnimationFrame(tick); return; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);

    if (B && state === 'fly') {
      B.t += dt;
      // взмахи: ~1,4 Гц, иногда планирование с раскрытыми крыльями
      if (B.glide > 0) B.glide -= dt; else if (Math.random() < dt * .22) B.glide = rnd(.6, 1.2);
      B.phase += dt * TAU * (B.glide > 0 ? .35 : 1.4);
      const flap = .5 + .5 * Math.cos(B.phase);
      const open = B.glide > 0 ? .86 + .06 * Math.sin(B.t * 9) : .1 + .9 * flap;
      B.d += dt * B.speed * (B.glide > 0 ? 1.1 : .85 + .35 * (1 - flap));
      const p = pointAt(B.path, B.d);
      B.x = p.x; B.y = p.y + Math.sin(B.phase) * 5;
      B.rot += (clamp(p.dx * .05, -.42, .42) + Math.sin(B.t * .9) * .08 - B.rot) * Math.min(1, dt * 3);
      B.open = open;
      // шлейф
      B.emitP += dt; B.emitS += dt;
      if (B.emitP > .13) { B.emitP = 0; spawnPetal(B.x - p.dx * .3, B.y + 4, false); }
      if (B.emitS > .06) { B.emitS = 0; spawnSpark(B.x + rnd(-B.S, B.S) * .8, B.y + rnd(-B.S, B.S) * .6, false); }
      if (hit) hit.style.transform = `translate(${B.x}px,${B.y}px)`;
      if (B.d >= B.path.len) { state = 'fade'; hit?.remove(); hit = null; emit('gone'); }
    }
    if (B && state === 'catch') {
      B.t += dt; B.ct += dt;
      const k = clamp(B.ct / 1.15, 0, 1);
      B.phase += dt * TAU * 4.5; B.open = .5 + .5 * Math.cos(B.phase);
      B.glow = Math.min(1, B.ct * 3);
      B.scale = k < .35 ? 1 + ease(k / .35) * .6 : 1.6 - ease((k - .35) / .65) * 1.45;
      B.alpha = k < .45 ? 1 : 1 - ease((k - .45) / .55);
      B.rot += dt * (4 + 10 * k); B.y -= dt * 40;
      if (Math.random() < .7) spawnSpark(B.x + rnd(-14, 14), B.y + rnd(-14, 14), false);
      if (k >= 1) { B = null; state = 'fade'; }
    }

    // частицы
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.age += dt;
      if (q.age < 0) continue;
      const a = 1 - q.age / q.life;
      if (a <= 0) { parts.splice(i, 1); continue; }
      if (q.k === 'p') {
        q.vx *= 1 - dt * .9; q.vy = q.vy * (1 - dt * .9) + dt * 14; q.x += q.vx * dt + Math.sin(q.age * 1.7 + q.f) * .3; q.y += q.vy * dt;
        q.r += q.vr * dt; q.f += q.vf * dt;
        g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.scale(q.s * Math.cos(q.f), q.s);
        g.globalAlpha = Math.min(1, a * 1.4) * .95; g.drawImage(q.img, -q.img.width / 2, -q.img.height / 2); g.restore();
      } else if (q.k === 's') {
        q.vx *= 1 - dt * 1.8; q.vy *= 1 - dt * 1.8; q.x += q.vx * dt; q.y += q.vy * dt; q.tw += dt * 9;
        drawSparkle(g, q.x, q.y, q.r * (.65 + .35 * Math.sin(q.tw)), Math.min(1, a * 1.6), q.green);
      } else if (q.k === 'ring') {
        const k = ease(q.age / q.life);
        g.save(); g.globalAlpha = a * .9; g.strokeStyle = 'rgba(150,255,170,1)'; g.lineWidth = 3 * a + .5;
        g.shadowColor = 'rgba(45,205,49,1)'; g.shadowBlur = 16; g.beginPath(); g.arc(q.x, q.y, 10 + k * q.R, 0, TAU); g.stroke(); g.restore();
      } else if (q.k === 'rays') {
        g.save(); g.translate(q.x, q.y); g.rotate(q.age * .8); g.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 10; r++) {
          g.rotate(TAU / 10); const len = 60 + 120 * ease(Math.min(1, q.age * 2));
          const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, `rgba(170,255,185,${.55 * a})`); gr.addColorStop(1, 'rgba(45,205,49,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(len, 0); g.lineTo(0, 3); g.fill();
        }
        g.restore();
      }
    }
    if (B) drawButterfly(g, B.x, B.y, B.S * (B.scale || 1), B.rot, B.open ?? 1, B.t, B.alpha, B.glow || 0);

    if (!B && !parts.length) { unmount(); schedule(); return; }
    raf = requestAnimationFrame(tick);
  }

  const onVis = () => { if (!document.hidden) last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('oi:page', () => { if (state === 'idle') schedule(); });
  reduced.addEventListener?.('change', () => { if (reduced.matches) unmount(); });

  // set({ lang, strings, catalogUrl, chance, ... }) — если язык сменился мягким переходом, без перезагрузки
  const set = (next = {}) => { Object.assign(o, next); S_ = pick(); if (hit) hit.setAttribute('aria-label', S_.aria); };
  const api = { fly: () => fly(true), stop: unmount, set, get state() { return state; } };
  window.__oiButterfly = api; window.oiButterfly = api;
  schedule();
  return api;
}
