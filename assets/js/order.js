// Экран «Замовлення прийнято»: штамп ханко ありがとう, салют лепестков, QR-код ссылки WhatsApp на десктопе
import { attach, burst, paletteFrom } from './petals.js';
import { isReduced } from './data.js';

const $ = (s, r = document) => r.querySelector(s);

export default async function () {
  const root = $('[data-order]');
  if (!root) return;

  $('[data-done-seal]', root)?.classList.add('is-stamped');
  const cv = $('[data-petals]', root);
  if (cv) attach(cv, { count: w => (w < 700 ? 16 : 32), interactive: false });
  if (!isReduced) {
    // большой салют: 45 лепестков во всех 9 цветах целей (по 5 на цвет)
    const top = Math.max(0, $('.hdr')?.getBoundingClientRect().bottom || 0);
    const colors = ['#FFD60A', '#FF6A13', '#FF4A3D', '#B4F000', '#00BD00', '#00D1C1', '#19B5FE', '#4F6BFF', '#8B5CFF'];
    colors.forEach((hex, i) => setTimeout(() => burst(innerWidth * (.2 + (i % 3) * .3), top + 120 + (i % 2) * 30, { count: 5, spread: 1.4, palette: paletteFrom(hex) }), 380 + i * 70));
  }

  // QR-код wa.me на десктопе (локальная библиотека qrcode-generator, MIT)
  const qr = $('[data-qr]', root), href = $('[data-wa-link]', root)?.href;
  if (qr && href && matchMedia('(min-width: 900px) and (pointer: fine)').matches) {
    try {
      const { default: qrcode } = await import('./vendor/qrcode.mjs');
      const q = qrcode(0, 'M');
      q.addData(href, 'Byte');
      q.make();
      $('[data-qr-img]', qr).innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      qr.hidden = false;
    } catch (e) {
      console.error(e);
    }
  }
}
