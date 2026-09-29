// Синхронно в <head>: включает анимации появления только при работающем JS; ?freeze=1 — статичная раскладка для скриншотов
(function (d) {
  d.classList.add('js');
  if (!window.scrollY) d.classList.add('is-top');   // таблетка языка под логотипом (дальше класс ведёт ui.js)
  if (/[?&]freeze=1/.test(location.search)) d.classList.add('freeze');
  setTimeout(function () { if (!window.__oiUI) d.classList.add('is-done'); }, 4000);   // v10: скрипты не запустились — всё содержимое видно
})(document.documentElement);
