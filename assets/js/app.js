// Точка входа: общий интерфейс (один раз) + страница (при загрузке и после каждого мягкого перехода).
// Без библиотек: CSS, IntersectionObserver, WAAPI, petals.js.
// v7 (brief/10_MUSIC_V7.md): фоновая музыка bgm.js играет на всём сайте, softnav.js подменяет только <main>,
// поэтому шапка, чат, панель корзины и музыка живут без перерыва; JS страницы — в initPage(root), уборка — onLeave().
import { init as initUI, initReveal, initPetals, initCarousels, renderCartUI, renderWish, syncChrome } from './ui.js';
import { initGoals } from './goals-fx5.js';
import { initSound, sfx } from './sound.js';
import { initMusic } from './bgm.js';
import { initSoftNav } from './softnav.js';
import { config, addProducts } from './data.js';
import { leavePage } from './page.js';

const pages = {
  home: () => import('./home.js'),
  shop: () => import('./catalog.js'),
  product: () => import('./product.js'),
  cart: () => import('./checkout.js'),
  order: () => import('./order.js'),
  wishlist: () => import('./wishlist.js'),
};

function initPage(root) {
  if (!root) return;
  addProducts(root);
  initGoals(root);     // плитки целей v5: сцена «проявляется» при появлении и движется, только пока плитка на экране
  initReveal(root);
  initPetals(root);
  initCarousels(root);  // журнал на главной и ленты отзывов (v11)
  // v11 (brief/14 § 5): лента отзывов («Читати повністю») и форма «Залишити відгук» — модуль грузится, только если они есть на странице
  if (root.querySelector('.reviews__rail, [data-review-form]')) import('./reviews.js').then(m => m.default(root)).catch(e => console.error(e));
  // v11 (brief/14 § 2): стеклянный блик на плашке «оригинал» — модуль грузится, только если плашка есть на странице
  if (root.querySelector('[data-glass]')) import(`./glass.js?v=${config.v?.glass || 0}`).then(({ initGlass }) => {
    const off = initGlass(root);
    addEventListener('oi:leave', off, { once: true });
  }).catch(e => console.error(e));
  pages[root.dataset.page]?.().then(m => m.default?.(root)).catch(e => console.error(e));
}

initUI();
initSound();         // звуки интерфейса — только когда включена музыка
const media = config.media || {};
if (media.ambient) initMusic({ src: media.ambient, volume: .25, resumeOnNavigate: media.resume !== false });
if (config.softnav !== false) {
  initSoftNav({ main: 'main', exclude: [new RegExp('^/' + (config.adminPath || 'admin') + '(/|$)'), /^\/install/, /^\/api\//, /^(\/(ru|en))?\/order\//, /^(\/(ru|en))?\/review\//] });
}

initPage(document.querySelector('main'));

// v11 (brief/14 § 3): бабочка Икигай — один раз на весь сайт (на мягких переходах модуль перезапускается сам), после загрузки, в свободное время.
// Не летает в корзине, на экране заказа и странице отзыва — чтобы не отвлекать от покупки; вкл/выкл и частота — в админке
const bf = config.butterfly || {};
if (bf.on) addEventListener('load', () => (window.requestIdleCallback || setTimeout)(() =>
  import(`./butterfly.js?v=${config.v?.butterfly || 0}`).then(({ initButterfly }) => initButterfly({
    lang: config.lang, strings: bf.str, catalogUrl: config.shopUrl, chance: bf.chance,
    exclude: [/^\/(ru\/|en\/)?(cart|order|checkout|review)(\/|$)/, new RegExp('^/' + (config.adminPath || 'admin') + '(/|$)'), /^\/install/],
  })).catch(e => console.error(e)), { timeout: 3000 }), { once: true });
// поимка: короткий звук «в корзину» (только если звуки включены) и событие аналитики, если она подключена владельцем
addEventListener('oi:butterfly', e => {
  if (e.detail?.type !== 'catch') return;
  sfx('add');
  if (typeof window.gtag === 'function') window.gtag('event', 'butterfly_catch', { count: e.detail.count });
  else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'butterfly_catch', count: e.detail.count });
});

addEventListener('oi:leave', () => leavePage());
addEventListener('oi:page', e => {
  const root = e.detail.root;
  syncChrome(root);
  initPage(root);
  renderCartUI();
  renderWish();
  // аналитика владельца (если подключена в настройках): просмотр страницы при мягком переходе
  const view = { page_location: location.href, page_title: document.title };
  if (typeof window.gtag === 'function') window.gtag('event', 'page_view', view);
  else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'page_view', ...view });
  if (typeof window.fbq === 'function') window.fbq('track', 'PageView');
});
