// Главная: хореография hero (постер → видео → лепестки → заголовок по словам), звук, квиз «Знайдіть своє IKIGAI»
import { cart } from './cart.js';
import { str, isReduced } from './data.js';
import { attach, burst } from './petals.js';
import { $, $$, toast, splitWords, center } from './ui.js';

function hero() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const title = $('.hero__h1', hero);
  if (title && !isReduced) splitWords(title);
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));

  const canvas = $('[data-petals]', hero);
  if (canvas) {
    const go = () => attach(canvas);
    if (isReduced) go(); else setTimeout(go, 350);
  }

  const video = $('[data-hero-video]', hero), sound = $('[data-sound]', hero);
  const saveData = navigator.connection?.saveData;
  if (!video || isReduced || saveData) return;
  video.preload = 'auto';
  video.addEventListener('playing', () => { video.classList.add('is-playing'); if (sound) sound.hidden = false; }, { once: true });
  const play = () => video.play().catch(() => {});
  if (document.readyState === 'complete') play(); else addEventListener('load', play, { once: true });
  // вне экрана — пауза (экономим батарею), вернулись — продолжаем
  new IntersectionObserver(([e]) => (e.isIntersecting ? play() : video.pause())).observe(hero);
  sound?.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted) { video.volume = .6; play(); }
    sound.setAttribute('aria-pressed', video.muted ? 'false' : 'true');
    sound.setAttribute('aria-label', video.muted ? str.soundOn : str.soundOff);
  });
}

function quiz() {
  const box = $('[data-quiz]');
  if (!box) return;
  const tiles = $('[data-quiz-tiles]', box);
  const show = slug => {
    let found = false;
    for (const r of $$('[data-quiz-res]', box)) {
      const on = r.dataset.quizRes === slug;
      r.hidden = !on;
      found ||= on;
    }
    if (!found) return false;
    tiles.hidden = true;
    const res = $(`[data-quiz-res="${CSS.escape(slug)}"]`, box);
    res.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'start' });
    return true;
  };
  box.addEventListener('click', e => {
    const tile = e.target.closest('[data-quiz-goal]');
    if (tile) {
      if (show(tile.dataset.quizGoal)) {
        e.preventDefault();
        const c = center(tile);
        burst(c.x, c.y, { count: 10, spread: .9 });
      }
      return;
    }
    if (e.target.closest('[data-quiz-again]')) {
      for (const r of $$('[data-quiz-res]', box)) r.hidden = true;
      tiles.hidden = false;
      tiles.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    const all = e.target.closest('[data-quiz-add]');
    if (all) {
      const ids = all.dataset.quizAdd.split(',').map(Number).filter(Boolean);
      for (const id of ids) if (!cart.qty(id)) cart.add(id, 1);
      const c = center(all);
      burst(c.x, c.y, { count: 18, spread: 1.2 });
      toast(str.added);
    }
  });
}

export default function () {
  hero();
  quiz();
}
