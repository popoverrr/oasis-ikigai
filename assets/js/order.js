// Экран «Замовлення прийнято»: штамп ханко ありがとう, салют лепестков, QR-код ссылки WhatsApp на десктопе
import { attach, burst, paletteFrom } from './petals.js';
import { isReduced } from './data.js';
import { sfx } from './sound.js';
import { onLeave } from './page.js';

const $ = (s, r = document) => r.querySelector(s);

export default async function () {
  const root = $('[data-order]');
  if (!root) return;

  $('[data-done-seal]', root)?.classList.add('is-stamped');
  sfx('success');
  const cv = $('[data-petals]', root);
  if (cv) { const fx = attach(cv, { count: w => (w < 700 ? 16 : 32), interactive: false }); onLeave(() => fx.destroy()); }
  if (!isReduced) {
    // большой салют: 45 розовых лепестков сакуры из девяти точек (brief/08 § 1)
    const top = Math.max(0, $('.hdr')?.getBoundingClientRect().bottom || 0);
    const pink = paletteFrom('#F2418C'), light = paletteFrom('#F5649F');
    for (let i = 0; i < 9; i++) setTimeout(() => burst(innerWidth * (.2 + (i % 3) * .3), top + 120 + (i % 2) * 30, { count: 5, spread: 1.4, palette: i % 2 ? light : pink }), 380 + i * 70);
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
