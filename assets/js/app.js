// Точка входа: общий интерфейс (один раз) + страница (при загрузке и после каждого мягкого перехода).
// Без библиотек: CSS, IntersectionObserver, WAAPI, petals.js.
// v7 (brief/10_MUSIC_V7.md): фоновая музыка bgm.js играет на всём сайте, softnav.js подменяет только <main>,
// поэтому шапка, чат, панель корзины и музыка живут без перерыва; JS страницы — в initPage(root), уборка — onLeave().
import { init as initUI, initReveal, initPetals, renderCartUI, renderWish, syncChrome } from './ui.js';
import { initGoals } from './goals-fx5.js';
import { initSound } from './sound.js';
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
