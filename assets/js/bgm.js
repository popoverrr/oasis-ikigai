// bgm.js — фоновая музыка OASIS IKIGAI (ES-модуль, без зависимостей)
//
//   import { initMusic } from './bgm.js';
//   initMusic({ src: '/assets/audio/ambient.mp3', volume: .15, resumeOnNavigate: true });
//
// Поведение:
// • Музыка включена по умолчанию. При загрузке страницы пробуем включить сразу. Если браузер запретил автозапуск
//   (Safari/iOS всегда, Chrome — пока человек ещё не взаимодействовал с сайтом), музыка стартует от первого
//   касания, клика или клавиши в любом месте страницы. Плавное появление за 1,5 с.
// • Кнопки [data-music-toggle] выключают и включают музыку (плавно, 0,6 с). На кнопке aria-pressed и класс is-playing.
// • resumeOnNavigate: true — после выключения музыка снова включается при переходе на другую страницу (так просил
//   владелец). false — выключенная музыка остаётся выключенной до закрытия вкладки. Значение — из настроек сайта.
// • Переходы: при мягкой навигации (softnav.js) аудио не прерывается. При обычной перезагрузке страницы музыка
//   продолжает с того же места (позиция хранится в sessionStorage).
// • Вкладка скрыта — пауза; вернулись — продолжаем (если музыка включена).
// v12 (brief/17 § 2): выключили кнопкой → localStorage oi_bgm_off = "1": музыка больше НЕ стартует сама — ни от первого касания,
//   ни после мягкого перехода, ни после перезагрузки, в новой вкладке или на следующий день. Включить можно только кнопкой.
//   resumeOnNavigate в этом случае не срабатывает.
const KEY = 'oi_bgm_v1', OFF = 'oi_bgm_off';
export const userMuted = () => { try { return localStorage.getItem(OFF) === '1'; } catch { return false; } };
const setMuted = on => { try { on ? localStorage.setItem(OFF, '1') : localStorage.removeItem(OFF); } catch {} };
const store = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } },
  set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
};

export function initMusic({ src, volume = .15, resumeOnNavigate = true } = {}) {
  if (!src) return null;
  if (window.__oiBgm) { window.__oiBgm.onPage(); return window.__oiBgm; }   // уже создан (мягкая навигация)

  const a = new Audio();
  a.src = src; a.loop = true; a.preload = 'auto'; a.volume = 0;
  const saved = store.get();
  let wantOn = userMuted() ? false : resumeOnNavigate ? true : !saved.muted;
  let raf = 0, armed = false;

  if (saved.t != null && saved.at) {
    a.addEventListener('loadedmetadata', () => {
      const d = a.duration || saved.d || 0;
      if (d) a.currentTime = (saved.t + (Date.now() - saved.at) / 1000) % d;
    }, { once: true });
  }

  const fade = (to, ms, done) => {
    cancelAnimationFrame(raf);
    const from = a.volume, t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) raf = requestAnimationFrame(step); else done && done();
    };
    raf = requestAnimationFrame(step);
  };
  const ui = () => document.querySelectorAll('[data-music-toggle]').forEach(b => {
    b.setAttribute('aria-pressed', String(wantOn));
    b.classList.toggle('is-playing', wantOn && !a.paused);
    const label = wantOn ? b.dataset.labelOff : b.dataset.labelOn;          // подпись действия: «Вимкнути музику» / «Увімкнути музику»
    if (label) b.setAttribute('aria-label', label);
  });
  const unlock = () => { disarm(); if (wantOn && !userMuted()) play(); };
  const arm = () => {
    if (armed) return; armed = true;
    ['pointerdown', 'keydown', 'touchend'].forEach(e => document.addEventListener(e, unlock, { capture: true, passive: true }));
  };
  const disarm = () => {
    armed = false;
    ['pointerdown', 'keydown', 'touchend'].forEach(e => document.removeEventListener(e, unlock, { capture: true }));
  };
  const play = () => {
    const p = a.play();
    (p && p.then ? p : Promise.resolve()).then(() => { disarm(); fade(volume, 1500); ui(); }).catch(() => { arm(); ui(); });
  };
  const pause = () => fade(0, 600, () => { a.pause(); ui(); });
  // v15: пока звучит звук поимки бабочки/колибри — музыка на 2,5 с тише (40% своего уровня), потом плавно возвращается
  let duckT = 0, catchDuck = false;
  addEventListener('oi:butterfly', e => {
    const type = e.detail?.type;
    if (!wantOn || a.paused) return;
    if (type === 'show') { clearTimeout(duckT); fade(volume * .6, 500); }          // v17: пока пасхалка летит — 60%
    else if (type === 'gone') { if (!catchDuck) fade(volume, 900); }                 // после поимки вернёт таймер поимки
    else if (type === 'catch') {
      clearTimeout(duckT); catchDuck = true;
      fade(volume * .4, 250);
      duckT = setTimeout(() => { catchDuck = false; if (wantOn && !a.paused) fade(volume, 600); }, 2500);
    }
  });
  const save = () => store.set({ t: a.currentTime, at: Date.now(), d: a.duration || 0, muted: !wantOn });

  const api = {
    audio: a,
    get on() { return wantOn; },
    toggle() { wantOn = !wantOn; setMuted(!wantOn); save(); wantOn ? play() : pause(); ui(); },
    onPage() {                                   // вызывается после мягкой навигации (событие oi:page)
      bind();
      if (resumeOnNavigate && !wantOn && !userMuted()) { wantOn = true; save(); play(); }
      ui();
    },
  };
  const bind = () => document.querySelectorAll('[data-music-toggle]').forEach(b => {
    if (b.__oiBgm) return; b.__oiBgm = true;
    b.addEventListener('click', e => { e.preventDefault(); api.toggle(); });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); a.pause(); save(); ui(); }
    else if (wantOn) play();
  });
  addEventListener('pagehide', save);
  addEventListener('oi:page', () => api.onPage());

  window.__oiBgm = api;
  bind(); ui();
  if (wantOn) play();
  return api;
}
