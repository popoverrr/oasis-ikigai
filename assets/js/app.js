// Точка входа: общий интерфейс + модуль страницы. Без библиотек: CSS, IntersectionObserver, WAAPI, petals.js
import { init as initUI } from './ui.js';
import { initGoals } from './goals-fx5.js';
import { initSound } from './sound.js';

initUI();
initSound();   // музыка и звуки: кнопка появляется, только если владелец загрузил файлы
initGoals();   // плитки целей v5: сцена «проявляется» при появлении и движется, только пока плитка на экране

const pages = {
  home: () => import('./home.js'),
  shop: () => import('./catalog.js'),
  product: () => import('./product.js'),
  cart: () => import('./checkout.js'),
  order: () => import('./order.js'),
  wishlist: () => import('./wishlist.js'),
};
const page = document.body.dataset.page;
pages[page]?.().then(m => m.default?.()).catch(e => console.error(e));
