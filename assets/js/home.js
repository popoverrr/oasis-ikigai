// Главная: хореография hero (постер → видео под размер экрана → заголовок по словам), страховка появления текста,
// панель корзины скрыта, пока виден первый экран, карусель журнала со стрелками и линией прогресса (brief/08 §§ 3, 8)
import { isReduced } from './data.js';
import { $, splitWords } from './ui.js';
import { onLeave } from './page.js';

function hero(root) {
  const hero = $('[data-hero]', root);
  if (!hero) return;
  const title = $('.hero__h1', hero);
  if (title && !isReduced) splitWords(title);
  hero.classList.add('is-in');
  // страховка: через 1,5 с после загрузки всё содержимое видно принудительно (в превью текст иногда оставался невидимым)
  let timer = 0;
  const done = () => { timer = setTimeout(() => hero.classList.add('is-done'), 1500); };
  if (document.readyState === 'complete') done(); else addEventListener('load', done, { once: true });

  // пока первый экран виден на 30 % и больше, панель корзины не закрывает кнопку
  const on = new IntersectionObserver(([e]) => document.body.classList.toggle('hero-on', e.intersectionRatio >= .3), { threshold: [0, .3, .6, 1] });
  on.observe(hero);

  onLeave(() => {
    clearTimeout(timer);
    removeEventListener('load', done);
    on.disconnect();
    document.body.classList.remove('hero-on');
  });

  // v9 (brief/12 § 1): бамбук в солнечном свете — файл под экран выбирается один раз: вертикальный для телефона,
  // 2560 для больших и ретина-экранов, 1920 для остальных. Лепестков над первым экраном больше нет.
  const video = $('[data-hero-video]', hero);
  const saveData = navigator.connection?.saveData;
  if (!video || isReduced || saveData) return;
  const portrait = matchMedia('(max-width: 1023px) and (orientation: portrait)').matches;
  const big = matchMedia('(min-width: 1600px), (min-width: 1200px) and (min-resolution: 2dppx)').matches;
  video.src = portrait ? video.dataset.srcPortrait : big ? video.dataset.srcQhd : video.dataset.srcHd;
  video.preload = 'auto';
  video.disablePictureInPicture = true; video.disableRemotePlayback = true;   // v10: фон не уходит в «картинку в картинке» iOS
  video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  const play = () => video.play().catch(() => {});
  if (document.readyState === 'complete') play(); else addEventListener('load', play, { once: true });
  // ушли со страницы — видео не должно продолжать грузиться
  onLeave(() => { video.pause(); video.removeAttribute('src'); video.load(); });
  // вне экрана — пауза (экономим батарею), вернулись — продолжаем
  const vis = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : video.pause()));
  vis.observe(hero);
  onLeave(() => { vis.disconnect(); removeEventListener('load', play); video.pause(); });
}

function carousels(root) {
  for (const box of root.querySelectorAll('[data-carousel]')) {
    const track = $('[data-carousel-track]', box), bar = $('[data-carousel-bar]', box);
    const prev = $('[data-carousel-prev]', box), next = $('[data-carousel-next]', box);
    if (!track) continue;
    const step = () => (track.firstElementChild?.getBoundingClientRect().width || track.clientWidth) + parseFloat(getComputedStyle(track).columnGap || 0);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (bar) {
        bar.style.setProperty('--w', `${Math.min(100, (track.clientWidth / track.scrollWidth) * 100)}%`);
        bar.style.setProperty('--x', `${(track.scrollLeft / Math.max(1, track.clientWidth)) * 100}%`);
      }
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };
    const go = dir => track.scrollBy({ left: dir * step(), behavior: isReduced ? 'auto' : 'smooth' });
    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    addEventListener('resize', update);
    onLeave(() => removeEventListener('resize', update));
    update();
  }
}

export default function (root = document) {
  hero(root);
  carousels(root);
}
