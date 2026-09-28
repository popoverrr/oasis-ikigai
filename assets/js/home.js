// Главная v5: хореография hero (постер → видео → розовые лепестки → заголовок по словам), страховка появления текста,
// панель корзины скрыта, пока виден первый экран, карусель журнала со стрелками и линией прогресса (brief/08 §§ 3, 8)
import { isReduced } from './data.js';
import { attach, paletteFrom } from './petals.js';
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

  const canvas = $('[data-petals]', hero);
  let petals = null, gone = false;
  if (canvas) {
    const go = () => { if (!gone) petals = attach(canvas, { palette: paletteFrom('#F2418C') }); };
    if (isReduced) go(); else setTimeout(go, 350);
  }
  onLeave(() => {
    gone = true;
    clearTimeout(timer);
    removeEventListener('load', done);
    on.disconnect();
    document.body.classList.remove('hero-on');
    petals?.destroy();
  });

  const video = $('[data-hero-video]', hero);
  const saveData = navigator.connection?.saveData;
  if (!video || isReduced || saveData) return;
  video.preload = 'auto';
  video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  const play = () => video.play().catch(() => {});
  if (document.readyState === 'complete') play(); else addEventListener('load', play, { once: true });
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
