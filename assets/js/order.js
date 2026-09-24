// Экран «Замовлення прийнято»: штамп ханко ありがとう, салют лепестков, QR-код ссылки WhatsApp на десктопе
import { attach, burst } from './petals.js';
import { isReduced } from './data.js';

const $ = (s, r = document) => r.querySelector(s);

export default async function () {
  const root = $('[data-order]');
  if (!root) return;

  $('[data-done-seal]', root)?.classList.add('is-stamped');
  const cv = $('[data-petals]', root);
  if (cv) attach(cv, { count: w => (w < 700 ? 16 : 32), interactive: false });
  if (!isReduced) {
    const top = Math.max(0, $('.hdr')?.getBoundingClientRect().bottom || 0);
    for (let i = 0; i < 3; i++) setTimeout(() => burst(innerWidth * (.25 + i * .25), top + 120, { count: 14, spread: 1.4 }), 380 + i * 160);
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
