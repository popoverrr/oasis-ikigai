// Синхронно в <head>: включает анимации появления только при работающем JS; ?freeze=1 — статичная раскладка для скриншотов
(function (d) {
  d.classList.add('js');
  if (/[?&]freeze=1/.test(location.search)) d.classList.add('freeze');
})(document.documentElement);
