// softnav.js — мягкая навигация между страницами (ES-модуль, без зависимостей)
// Зачем: при обычном переходе браузер выгружает страницу, и музыка обрывается, а на iPhone без нового касания
// не может включиться снова. Мягкая навигация подгружает следующую страницу через fetch и заменяет только <main>,
// поэтому музыка, шапка, корзина и чат продолжают жить без перерыва.
//
//   import { initSoftNav } from './softnav.js';
//   initSoftNav({ main: 'main', exclude: [/^\/admin/, /^\/install/, /^\/api\//] });
//
// Перед подменой отправляется событие window 'oi:leave' { detail: { root: старый <main> } } — снять наблюдатели,
// остановить canvas лепестков и т. п. После подмены — 'oi:page' { detail: { root: новый <main> } }.
// Весь JS страниц (каталог, товар, корзина, плитки целей, галереи, анимации появления) должен
// инициализироваться функцией, которая вызывается и при первой загрузке, и по 'oi:page'.
// Встроенные <script> внутри <main> НЕ выполняются (кроме JSON-данных type="application/json") —
// так и задумано: вся логика живёт в модулях.
//
// Полная перезагрузка вместо мягкой: другой домен, target, download, ctrl/cmd/shift/alt-клик, ссылки на файлы,
// переключение языка (hreflang), ссылки с data-no-softnav, пути из exclude, ошибки загрузки.
export function initSoftNav({ main = 'main', exclude = [] } = {}) {
  if (!('fetch' in window) || !('DOMParser' in window) || !history.pushState) return;
  const same = u => u.origin === location.origin;
  const skip = (a, u) =>
    !same(u) || a.target && a.target !== '_self' || a.hasAttribute('download') || a.hasAttribute('hreflang') ||
    a.closest('[data-no-softnav]') || /\.(pdf|zip|jpe?g|png|webp|svg|mp3|mp4|xml|txt)$/i.test(u.pathname) ||
    exclude.some(re => re.test(u.pathname));

  let busy = null;
  async function go(url, push) {
    const u = new URL(url, location.href);
    if (push && u.pathname === location.pathname && u.search === location.search && u.hash) { location.hash = u.hash; return; }
    busy?.abort(); const ctrl = busy = new AbortController();
    document.documentElement.classList.add('is-loading');
    try {
      const r = await fetch(u, { signal: ctrl.signal, headers: { 'X-Softnav': '1' }, credentials: 'same-origin' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) throw new Error('bad');
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const next = doc.querySelector(main), cur = document.querySelector(main);
      if (!next || !cur || doc.documentElement.lang !== document.documentElement.lang) throw new Error('full');
      dispatchEvent(new CustomEvent('oi:leave', { detail: { root: cur } }));   // модули страницы убирают за собой (наблюдатели, canvas лепестков)
      const swap = () => {
        cur.replaceWith(next);
        document.title = doc.title;
        // SEO-метаданные и альтернативные языки текущей страницы
        ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'link[rel="alternate"][hreflang]'].forEach(sel => {
          document.head.querySelectorAll(sel).forEach(n => n.remove());
          doc.head.querySelectorAll(sel).forEach(n => document.head.appendChild(n.cloneNode(true)));
        });
        // ссылки переключателя языка ведут на эту же страницу на другом языке — синхронизируем
        doc.querySelectorAll('[data-lang-link]').forEach(n => {
          document.querySelectorAll(`[data-lang-link="${n.dataset.langLink}"]`).forEach(m => m.setAttribute('href', n.getAttribute('href')));
        });
        document.body.className = doc.body.className;
      };
      if (push) history.pushState({ softnav: 1 }, '', u);
      // startViewTransition вызывает swap асинхронно — ждём подмены, иначе 'oi:page' уйдёт со старым <main> (правка OASIS)
      if (document.startViewTransition) await document.startViewTransition(swap).updateCallbackDone; else swap();
      if (u.hash) document.getElementById(u.hash.slice(1))?.scrollIntoView(); else if (push) scrollTo(0, 0);
      const h1 = document.querySelector(`${main} h1`); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      dispatchEvent(new CustomEvent('oi:page', { detail: { root: document.querySelector(main) } }));
    } catch (e) {
      if (e.name !== 'AbortError') location.href = u.href;
    } finally {
      if (busy === ctrl) { busy = null; document.documentElement.classList.remove('is-loading'); }
    }
  }

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]'); if (!a) return;
    const u = new URL(a.href, location.href);
    if (skip(a, u)) return;
    e.preventDefault(); go(u.href, true);
  });
  addEventListener('popstate', () => go(location.href, false));
  history.replaceState({ softnav: 1 }, '');
  window.__oiSoftnav = { go: url => go(url, true) };   // для переходов из кода (мини-плитки целей в каталоге) — правка OASIS
}
