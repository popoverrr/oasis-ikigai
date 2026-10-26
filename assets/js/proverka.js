// v24: проверка каталога Инной Викторовной (/proverka, вход по логину и паролю). Список — из базы сайта, «Сохранить» — на сервер,
// фото уменьшаются в браузере до 2000 px и уходят по одному. Правки попадают только в админку, сайт не меняют.
(() => {
  'use strict';
  const D = JSON.parse(document.getElementById('pv-data').textContent);
  const P = D.products, F = D.fields, NF = D.newFields;
  const ST = D.state; // {products: {id: item}, new: [item]}
  const app = document.getElementById('app'), nav = document.getElementById('nav');
  let q = '', view = null;

  function h(t, a, ...c) {
    const e = document.createElement(t);
    for (const k in a || {}) {
      if (k === 'on') for (const ev in a.on) e.addEventListener(ev, a.on[ev]);
      else if (k === 'text') e.textContent = a[k];
      else if (k in e) e[k] = a[k];
      else e.setAttribute(k, a[k]);
    }
    for (const x of c) if (x) e.append(x);
    return e;
  }
  const grow = t => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 4) + 'px'; };
  const item = p => ST.products[p.id] || null;
  // правка, которая ещё не на сайте: её «стало» показываем в полях
  const pending = p => { const it = item(p); return it && it.kind === 'edit' && it.status !== 'applied' ? it : null; };
  const status = p => {
    const it = item(p);
    if (!it) return ['', 'Не проверено'];
    if (it.status === 'applied') return ['done', 'Внесено'];
    return it.kind === 'ok' ? ['ok', 'Верно'] : ['wait', 'Ждёт внесения'];
  };
  const name = p => { const it = pending(p); return (it && it.fields.name && it.fields.name.now) || p.values.name; };

  async function post(path, body, isForm) {
    const r = await fetch(D.base + path, {
      method: 'POST', credentials: 'same-origin',
      headers: isForm ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
    let j = {};
    try { j = await r.json(); } catch (e) { /* пусто */ }
    if (!r.ok) throw new Error(j.error || 'Не сохранилось. Проверьте интернет и нажмите «Сохранить» ещё раз.');
    return j;
  }

  // фото с телефона: уменьшить до 2000 px по большей стороне (JPEG); не получилось (HEIC на компьютере) — отправить как есть
  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      if (s === 1 && file.type === 'image/jpeg' && file.size < 3e6) return file;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86));
      return b ? new File([b], (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }

  function setNav(...btns) { nav.hidden = !btns.length; nav.replaceChildren(...btns); }

  // ——— список ———
  function list() {
    view = null; setNav(); app.replaceChildren();
    const n = P.filter(p => item(p)).length;
    app.append(
      h('h1', { text: 'Проверка каталога' }),
      h('p', { text: 'Откройте товар, исправьте, что неверно, и нажмите «Сохранить». Правки уходят администратору, на сайте они появятся после проверки.' }),
      h('p', { className: 'mute', text: 'Проверено ' + n + ' из ' + P.length }),
      h('div', { className: 'bar' }, h('i', { style: 'width:' + (P.length ? n / P.length * 100 : 0) + '%' })));
    const first = P.findIndex(p => !item(p));
    if (first >= 0 && n > 0) app.append(h('button', { className: 'pri', text: 'Продолжить с товара № ' + P[first].n, on: { click: () => open(first) } }));
    const inp = h('input', { id: 'q', type: 'search', placeholder: 'Поиск по названию или номеру', value: q, autocomplete: 'off' });
    const box = h('div', { className: 'col' });
    const fill = () => {
      box.replaceChildren();
      const s = q.trim().toLowerCase();
      P.forEach((p, i) => {
        if (s && !(p.n + ' ' + name(p) + ' ' + p.values.brand).toLowerCase().includes(s)) return;
        const [cls, label] = status(p);
        box.append(h('button', { className: 'row', on: { click: () => open(i) } }, h('img', { src: p.img, alt: '', loading: 'lazy' }),
          h('span', {}, h('b', { text: p.n + '. ' + name(p) }), h('span', { className: 'mute', text: [p.values.brand, p.values.price ? p.values.price + ' ₴' : ''].filter(Boolean).join(' · ') })),
          h('span', { className: 'tag ' + cls, text: label })));
      });
      if (!box.children.length) box.append(h('p', { className: 'mute', text: 'Ничего не нашлось.' }));
    };
    inp.addEventListener('input', () => { q = inp.value; fill(); });
    app.append(inp, box);
    fill();
    app.append(h('h3', { text: 'Товар, которого нет на сайте' }));
    ST.new.forEach(it => {
      const [cls, label] = it.status === 'applied' ? ['done', 'Внесено'] : ['wait', 'Ждёт внесения'];
      app.append(h('button', { className: 'row', on: { click: () => openNew(it) } },
        h('span', {}, h('b', { text: it.title || 'Без названия' }), h('span', { className: 'mute', text: 'Сохранено ' + (it.when || '') })),
        h('span', { className: 'tag ' + cls, text: label })));
    });
    app.append(h('button', { text: '+ Добавить новый товар', on: { click: () => openNew(null) } }));
    const out = h('form', { method: 'post', action: D.base + '/logout' }, h('button', { className: 'small', type: 'submit', text: 'Выйти' }));
    app.append(h('h3', { text: 'Вход' }), h('div', { className: 'col' }, h('button', { className: 'small', type: 'button', text: 'Сменить пароль', on: { click: password } }), out));
    scrollTo(0, 0);
  }

  // ——— смена пароля ———
  function password() {
    setNav(); app.replaceChildren(); scrollTo(0, 0);
    const msg = h('p', { className: 'msg', hidden: true, role: 'status' });
    const inp = (id, lab, ac) => { const i = h('input', { id, type: 'password', autocomplete: ac }); return [i, h('div', { className: 'fld' }, h('label', { htmlFor: id, text: lab }), i)]; };
    const [o, of] = inp('pw-old', 'Текущий пароль', 'current-password');
    const [n1, nf1] = inp('pw-new', 'Новый пароль (не короче 8 знаков)', 'new-password');
    const [n2, nf2] = inp('pw-new2', 'Новый пароль ещё раз', 'new-password');
    const go = h('button', { className: 'pri', type: 'button', text: 'Сменить пароль', on: { click: async () => {
      if (n1.value !== n2.value) { msg.className = 'msg err'; msg.hidden = false; msg.textContent = 'Новые пароли не совпадают.'; return; }
      go.disabled = true;
      try {
        await post('/password', { old: o.value, new: n1.value });
        o.value = n1.value = n2.value = '';
        msg.className = 'msg'; msg.hidden = false; msg.textContent = 'Пароль изменён. На других устройствах войдите с новым паролем.';
      } catch (e) { msg.className = 'msg err'; msg.hidden = false; msg.textContent = e.message; } finally { go.disabled = false; }
    } } });
    app.append(h('button', { className: 'small', text: '← К списку товаров', on: { click: list } }), h('h2', { text: 'Сменить пароль' }), msg, of, nf1, nf2, go);
  }

  // ——— общий блок фото ———
  // get() — текущая запись, к которой ещё можно добавлять фото (status new), или null
  function photosBlock(get, past, queue) {
    const wrap = h('div', { className: 'fld' }, h('span', { className: 'lab', text: 'Фото' }));
    const grid = h('div', { className: 'photos' });
    const draw = () => {
      grid.replaceChildren();
      const it = get();
      (it ? it.photos : []).forEach(ph => grid.append(h('div', { className: 'ph' },
        h('img', { src: D.base + '/photo/' + ph.id, alt: ph.name || 'фото' }),
        h('button', { type: 'button', 'aria-label': 'Убрать фото', text: '×', on: { click: async () => {
          try { await post('/photo/' + ph.id + '/delete', {}); it.photos = it.photos.filter(x => x.id !== ph.id); draw(); } catch (e) { alert(e.message); }
        } } }))));
      queue.forEach((f, i) => grid.append(h('div', { className: 'ph wait' }, h('span', { text: 'Сохранится после «Сохранить»' }),
        h('button', { type: 'button', 'aria-label': 'Убрать фото', text: '×', on: { click: () => { queue.splice(i, 1); draw(); } } }))));
      grid.hidden = !grid.children.length;
    };
    const total = () => (get() ? get().photos.length : 0) + queue.length;
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, on: { change: () => {
      for (const f of input.files) if (total() < D.maxPhotos) queue.push(f);
      input.value = ''; draw();
    } } });
    wrap.append(grid);
    if (past && past.status !== 'new' && past.photos.length) wrap.append(h('p', { className: 'mute', text: 'Фото к прошлой правке уже переданы: ' + past.photos.length + '.' }));
    wrap.append(h('label', { className: 'btn' }, input, document.createTextNode('+ Добавить фото')));
    wrap.append(h('p', { className: 'mute', text: 'Можно снять камерой или выбрать из галереи, до ' + D.maxPhotos + ' фото.' }));
    draw();
    return { el: wrap, redraw: draw };
  }

  async function uploadQueue(itemObj, queue, msg) {
    let i = 0;
    while (queue.length) {
      i++;
      msg.className = 'msg info'; msg.hidden = false; msg.textContent = 'Отправляю фото ' + i + '…';
      const fd = new FormData();
      fd.append('item', itemObj.id);
      fd.append('photo', await shrink(queue[0]));
      const r = await post('/photo', fd, true);
      itemObj.photos.push(r.photo);
      queue.shift();
    }
  }

  // ——— карточка товара ———
  function open(i) {
    const p = P[i]; const it = pending(p); const queue = [];
    app.replaceChildren(); scrollTo(0, 0);
    const msg = h('p', { className: 'msg', hidden: true, role: 'status' });
    app.append(h('button', { className: 'small', text: '← К списку товаров', on: { click: () => leave(list) } }),
      h('div', { className: 'top' }, h('img', { src: p.img, alt: '' }), h('div', {}, h('p', { className: 'mute', text: 'Товар № ' + p.n + ' · ' + (i + 1) + ' из ' + P.length }), h('h2', { text: name(p) }))));
    const it0 = item(p);
    if (it0 && it0.status !== 'new') {
      const t = it0.status === 'applied' ? 'Ваша прошлая правка внесена на сайт.' : (it0.kind === 'ok' ? 'Вы отметили этот товар: всё верно.' : 'Ваша правка передана администратору и ждёт внесения на сайт. Можно дополнить её и снова нажать «Сохранить».');
      app.append(h('p', { className: 'msg info', text: t }));
    } else if (it0 && it0.kind === 'edit') {
      app.append(h('p', { className: 'msg info', text: 'Ваша правка сохранена ' + (it0.when || '') + '. Можно изменить её и снова нажать «Сохранить».' }));
    }
    app.append(msg);
    const tas = [], vals = {};
    for (const k in F) {
      const site = p.values[k];
      const v = it && it.fields[k] ? it.fields[k].now : site;
      const id = 'f_' + k;
      const ta = h('textarea', { id, rows: 1, value: v });
      const was = h('p', { className: 'was' }, h('b', { text: 'Сейчас на сайте: ' }), document.createTextNode(site ? (site.length > 400 ? site.slice(0, 400) + '…' : site) : '(пусто)'));
      const undo = h('button', { className: 'small', type: 'button', text: 'Вернуть как на сайте' });
      const f = h('div', { className: 'fld' }, h('label', { htmlFor: id, text: F[k] }), ta, was, undo);
      const mark = () => { const ch = ta.value.trim() !== site; f.classList.toggle('ch', ch); was.hidden = undo.hidden = !ch; };
      ta.addEventListener('input', () => { mark(); grow(ta); dirty = true; });
      undo.addEventListener('click', () => { ta.value = site; ta.dispatchEvent(new Event('input')); });
      mark(); app.append(f); tas.push(ta); vals[k] = ta;
    }
    const ph = photosBlock(() => { const x = ST.products[p.id]; return x && x.status === 'new' ? x : null; }, it0, queue);
    app.append(ph.el);
    const nt = h('textarea', { id: 'note', rows: 2, value: (it && it.note) || '', placeholder: 'Например: нет в продаже, поменять главное фото, другая цена' });
    nt.addEventListener('input', () => { grow(nt); dirty = true; });
    app.append(h('div', { className: 'fld' }, h('label', { htmlFor: 'note', text: 'Замечание своими словами' }), nt)); tas.push(nt);
    let dirty = false;
    const okBtn = h('button', { type: 'button', text: 'Всё верно, правок нет — следующий товар', on: { click: () => save(true).then(ok => ok && next()) } });
    app.append(okBtn);
    const saveBtn = h('button', { className: 'pri', type: 'button', text: 'Сохранить', on: { click: () => save(false) } });
    setNav(h('button', { type: 'button', text: 'Назад', disabled: i === 0, on: { click: () => leave(() => open(i - 1)) } }), saveBtn,
      h('button', { type: 'button', text: 'Дальше', on: { click: () => leave(next) } }));
    const next = () => (i + 1 < P.length ? open(i + 1) : list());

    async function save(ok) {
      const values = {};
      for (const k in vals) values[k] = vals[k].value;
      saveBtn.disabled = okBtn.disabled = true;
      try {
        const r = await post('/save', { product: p.id, values, note: nt.value, ok, photos: queue.length });
        if (r.item) {
          ST.products[p.id] = r.item;
          if (queue.length) await uploadQueue(r.item, queue, msg);
          r.item.when = 'только что';
        } else if (ST.products[p.id] && ST.products[p.id].status === 'new') {
          delete ST.products[p.id];
        }
        dirty = false;
        msg.className = 'msg'; msg.hidden = false;
        msg.textContent = r.item ? (r.item.kind === 'ok' ? 'Отмечено: всё верно.' : 'Сохранено. Правка передана администратору. На сайте она появится после проверки.') : 'Правок нет — всё как на сайте.';
        if (!ok) { ph.redraw(); msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return true;
      } catch (e) {
        msg.className = 'msg err'; msg.hidden = false; msg.textContent = e.message;
        msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return false;
      } finally { saveBtn.disabled = okBtn.disabled = false; }
    }
    // уходя с товара, несохранённые правки сохраняем сами — ничего не теряется
    async function leave(go) { if ((dirty || queue.length) && !(await save(false))) return; go(); }
    view = { leave };
    requestAnimationFrame(() => tas.forEach(grow));
  }

  // ——— новый товар ———
  function openNew(it) {
    const queue = []; let cur = it;
    app.replaceChildren(); scrollTo(0, 0);
    const msg = h('p', { className: 'msg', hidden: true, role: 'status' });
    app.append(h('button', { className: 'small', text: '← К списку товаров', on: { click: () => leave() } }),
      h('h2', { text: 'Новый товар, которого нет на сайте' }),
      h('p', { className: 'mute', text: 'Напишите название, всё, что знаете о товаре (цена, фасовка, для чего), и прикрепите фото упаковки.' }), msg);
    if (it && it.status !== 'new') app.append(h('p', { className: 'msg info', text: it.status === 'applied' ? 'Этот товар уже добавлен на сайт.' : 'Передано администратору. Можно дополнить и снова нажать «Сохранить».' }));
    const vals = {}, tas = [];
    for (const k in NF) {
      const ta = h('textarea', { id: 'n_' + k, rows: k === 'text' ? 4 : 1, value: it && it.fields[k] ? it.fields[k].now : '' });
      ta.addEventListener('input', () => grow(ta));
      app.append(h('div', { className: 'fld' }, h('label', { htmlFor: 'n_' + k, text: NF[k] }), ta)); vals[k] = ta; tas.push(ta);
    }
    const ph = photosBlock(() => (cur && cur.status === 'new' ? cur : null), it, queue);
    app.append(ph.el);
    const saveBtn = h('button', { className: 'pri', type: 'button', text: 'Сохранить', on: { click: () => save() } });
    setNav(h('button', { type: 'button', text: '← К списку', on: { click: () => leave() } }), saveBtn);
    async function save() {
      saveBtn.disabled = true;
      try {
        const r = await post('/save', { kind: 'new', item: cur && cur.status === 'new' ? cur.id : 0, values: { name: vals.name.value, text: vals.text.value }, note: '' });
        if (!cur || cur.id !== r.item.id) { ST.new = ST.new.filter(x => !cur || x.id !== cur.id); ST.new.push(r.item); }
        else Object.assign(cur, r.item);
        cur = ST.new.find(x => x.id === r.item.id);
        if (queue.length) await uploadQueue(cur, queue, msg);
        cur.when = 'только что';
        msg.className = 'msg'; msg.hidden = false; msg.textContent = 'Сохранено. Новый товар передан администратору.';
        ph.redraw(); msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return true;
      } catch (e) {
        msg.className = 'msg err'; msg.hidden = false; msg.textContent = e.message; return false;
      } finally { saveBtn.disabled = false; }
    }
    function leave() { list(); }
    requestAnimationFrame(() => tas.forEach(grow));
  }

  list();
})();
