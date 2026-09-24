// Точка входа: общий интерфейс + модуль страницы. Без библиотек: CSS, IntersectionObserver, WAAPI, petals.js
import { init as initUI } from './ui.js';
import { initGoals } from './goals-fx.js';

initUI();
initGoals();   // плитки целей: анимация только на экране, «всплеск» при появлении, наведении и нажатии

const pages = {
  home: () => import('./home.js'),
  shop: () => import('./catalog.js'),
  product: () => import('./product.js'),
  cart: () => import('./checkout.js'),
  order: () => import('./order.js'),
  quiz: () => import('./home.js'),
  wishlist: () => import('./wishlist.js'),
};
const page = document.body.dataset.page;
pages[page]?.().then(m => m.default?.()).catch(e => console.error(e));
