// Музыка и звуки сайта (brief/08 § 10). По умолчанию выключено: браузеры запрещают автозапуск.
// Кнопка [data-music] (первый экран и меню) включает фоновую музыку (25 %, плавно 1,5 с) и звуки интерфейса (40 %).
// Файлы грузятся только после включения (preload="none"); пока файлов нет, кнопка не показывается. Выбор — в localStorage.
import { config, str } from './data.js';

const M = config.media || {};
const KEY = 'oi_sound';
const has = Boolean(M.ambient || M.tap || M.add || M.success);
const cache = {};
let on = false, ambient = null, raf = 0;

const saved = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const save = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* приватный режим */ } };

function fade(to, done) {
  cancelAnimationFrame(raf);
  const from = ambient.volume, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / 1500);
    ambient.volume = from + (to - from) * k;
    if (k < 1) raf = requestAnimationFrame(step); else done?.();
  };
  raf = requestAnimationFrame(step);
}
function start() {
  if (!M.ambient) return;
  if (!ambient) {
    ambient = new Audio();
    ambient.preload = 'none';
    ambient.loop = true;
    ambient.volume = 0;
    ambient.src = M.ambient;
  }
  ambient.play().then(() => fade(.25)).catch(() => {});
}
function stop() {
  if (ambient) fade(0, () => ambient.pause());
}

/** Звук интерфейса: 'tap' | 'add' | 'success' */
export function sfx(name) {
  if (!on || !M[name] || name === 'ambient') return;
  const a = cache[name] ||= Object.assign(new Audio(), { preload: 'none', src: M[name] });
  a.volume = .4;
  try { a.currentTime = 0; } catch { /* ещё не загружен */ }
  a.play().catch(() => {});
}

function render() {
  for (const b of document.querySelectorAll('[data-music]')) {
    b.hidden = false;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? str.musicOff : str.musicOn;
    if ('musicText' in b.dataset) { const s = b.querySelector('span'); if (s) s.textContent = label; } else b.setAttribute('aria-label', label);
  }
}
function set(v) {
  on = v;
  save(v);
  if (v) start(); else stop();
  render();
}

export function initSound() {
  if (!has) return;
  document.addEventListener('click', e => {
    if (e.target.closest('[data-music]')) { set(!on); return; }
    if (e.target.closest('a[href], button') && !e.target.closest('[data-add]')) sfx('tap');
  });
  if (saved()) {
    // включено в прошлый раз: музыка продолжится с первого касания страницы (раньше браузер не разрешит)
    on = true;
    const resume = e => {
      removeEventListener('pointerdown', resume, true);
      removeEventListener('keydown', resume, true);
      if (!e.target.closest?.('[data-music]')) start();
    };
    addEventListener('pointerdown', resume, true);
    addEventListener('keydown', resume, true);
  }
  render();
}
