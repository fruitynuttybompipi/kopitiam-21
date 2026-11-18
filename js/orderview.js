/* Kopitiam 21 — Ingat Order view: customers at a marble table, timed speech bubbles, and the waiter's tablet. */
(function (root) {
  'use strict';
  const { ORDER, SPR, AU } = root;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const OV = {};
  let box, st = null, meId = null, handlers = {}, timers = [], playingId = null, tab = 'drink';
  let chit = {}, chitTurn = null;

  // ---------- pixel icons for every menu item (16x16, drawn in code) ----------
  const iconCache = {};
  function icon(key) {
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const [id, temp] = key.split(':');
    const d = ORDER.DRINKS.find(x => x.id === id);
    if (d) {
      if (temp === 'ais') {
        // tall glass with ice and a straw
        R(4, 2, 8, 13, '#2a1a12'); R(5, 3, 6, 11, '#e4f6ff');
        R(5, 5, 6, 9, d.col); R(5, 5, 6, 1, id === 'tehtarik' || id === 'kopi' || id === 'kopic' || id === 'teh' ? '#f2dfc0' : d.col);
        R(6, 6, 2, 2, '#ffffff'); R(8, 9, 2, 2, '#dff4ff'); R(6, 11, 2, 2, '#ffffff');
        R(10, 0, 1, 7, '#c0392b');
      } else {
        // kopitiam cup + saucer + steam
        R(3, 6, 9, 7, '#2a1a12'); R(4, 7, 7, 5, '#fbf8f0'); R(4, 9, 7, 1, '#3fae6a');
        R(4, 7, 7, 1, d.col); R(12, 8, 2, 3, '#2a1a12');
        R(1, 13, 14, 2, '#2a1a12'); R(2, 13, 12, 1, '#e8e4d8');
        R(5, 2, 1, 3, '#cfd6dc'); R(8, 1, 1, 4, '#cfd6dc');
      }
    } else {
      const plate = () => { R(1, 11, 14, 3, '#2a1a12'); R(2, 11, 12, 2, '#f6f2e6'); };
      switch (id) {
        case 'nasilemak': R(1, 9, 14, 5, '#2a6b2a'); R(4, 6, 7, 5, '#fbfbf4'); R(5, 5, 5, 1, '#fbfbf4'); R(10, 8, 3, 2, '#c0392b'); R(2, 10, 3, 2, '#fff8ea'); R(3, 10, 1, 1, '#f2b81e'); R(11, 11, 2, 1, '#8a5a2a'); R(12, 6, 2, 2, '#7ab83a'); break;
        case 'roticanai': plate(); R(2, 7, 9, 4, '#d9a85a'); R(3, 8, 7, 1, '#b8803a'); R(4, 10, 5, 1, '#e8c890'); R(11, 8, 4, 3, '#2a1a12'); R(12, 8, 2, 2, '#c97a2a'); break;
        case 'ckt': plate(); R(3, 7, 10, 4, '#8a5028'); R(4, 8, 8, 1, '#a8682e'); R(5, 6, 3, 2, '#f08a5a'); R(9, 7, 2, 1, '#3f9a3a'); R(7, 9, 2, 1, '#3a2a1a'); break;
        case 'wantanmee': R(2, 8, 12, 6, '#2a1a12'); R(3, 8, 10, 5, '#f6f2e6'); R(3, 12, 10, 1, '#2a5cb0'); R(4, 6, 8, 3, '#e8c35a'); R(5, 5, 3, 2, '#b8322a'); R(9, 5, 2, 2, '#3f9a3a'); break;
        case 'rojak': plate(); R(3, 7, 3, 3, '#9ad04a'); R(6, 6, 3, 3, '#f2c84a'); R(9, 7, 3, 3, '#f58ab0'); R(5, 9, 3, 2, '#e8e2d0'); R(4, 6, 8, 1, '#3a2010'); R(7, 8, 3, 1, '#3a2010'); break;
        case 'rotibakar': R(2, 5, 8, 8, '#8a5028'); R(3, 6, 6, 6, '#e8c890'); R(4, 8, 4, 2, '#7ab83a'); R(7, 7, 7, 7, '#8a5028'); R(8, 8, 5, 5, '#e8c890'); R(9, 10, 3, 1, '#f2d84a'); break;
        case 'telur': R(3, 6, 10, 7, '#2a1a12'); R(4, 7, 8, 5, '#fbf8f0'); R(4, 7, 8, 2, '#fff8ea'); R(5, 7, 2, 2, '#f2a81e'); R(9, 7, 2, 2, '#f2a81e'); R(6, 9, 4, 1, '#5a3418'); R(1, 13, 14, 2, '#2a1a12'); R(2, 13, 12, 1, '#e8e4d8'); break;
      }
    }
    return (iconCache[key] = c.toDataURL());
  }
  OV.icon = icon;

  // ---------- layout ----------
  OV.mount = function (el, h) {
    box = el; handlers = h || {};
    box.innerHTML = `
      <div class="oq"></div>
      <div class="o-head"><b class="o-level"></b><span class="o-who"></span></div>
      <div class="o-stage"><div class="o-custs"></div><div class="o-table"><i></i><i></i></div></div>
      <div class="o-tablet hidden">
        <div class="o-bezel">
          <div class="o-chit"></div>
          <div class="o-tabs"><button data-tab="drink" class="on">MINUMAN</button><button data-tab="food">MAKANAN</button></div>
          <div class="o-grid"></div>
          <div class="o-lock hidden"></div>
        </div>
      </div>
      <div class="o-reveal hidden"></div>`;
    box.addEventListener('click', onClick);
  };

  function onClick(e) {
    const t = e.target.closest('[data-tab],[data-add],[data-inc],[data-dec]');
    if (!t || !mine()) { if (t && t.dataset.tab) setTab(t.dataset.tab); return; }
    if (t.dataset.tab) { setTab(t.dataset.tab); return; }
    const key = t.dataset.add || t.dataset.inc || t.dataset.dec;
    if (t.dataset.dec) { chit[key] = (chit[key] || 0) - 1; if (chit[key] <= 0) delete chit[key]; AU.play('click'); }
    else { if (Object.keys(chit).length >= 20 && !chit[key]) return; chit[key] = Math.min(9, (chit[key] || 0) + 1); AU.play('chip'); }
    const tile = t.closest('.o-tile'); if (tile) tile.animate([{ transform: 'scale(.92)' }, { transform: 'none' }], { duration: 140, easing: 'steps(2)' });
    drawChit(chit, true);
    handlers.onChit && handlers.onChit(Object.assign({}, chit));
  }
  function setTab(t) {
    tab = t;
    $$('.o-tabs button', box).forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    drawGrid();
  }
  function mine() { return !!(st && st.phase === 'answer' && st.cur === meId); }

  function drawGrid() {
    const g = $('.o-grid', box);
    if (tab === 'drink') {
      g.innerHTML = ORDER.DRINKS.map(d => `<div class="o-tile drink">
        <img src="${icon(d.id + ':panas')}" alt=""><b>${esc(d.name)}</b>
        <div class="o-tt"><button data-add="${d.id}:panas"><img src="${icon(d.id + ':panas')}" alt="">PANAS</button><button data-add="${d.id}:ais"><img src="${icon(d.id + ':ais')}" alt="">AIS</button></div></div>`).join('');
    } else {
      g.innerHTML = ORDER.FOODS.map(f => `<button class="o-tile food" data-add="${f.id}"><img src="${icon(f.id)}" alt=""><b>${esc(f.name)}</b></button>`).join('');
    }
  }
  function drawChit(c, editable) {
    const keys = Object.keys(c).sort((a, b) => ORDER.KEYS.indexOf(a) - ORDER.KEYS.indexOf(b));
    const total = keys.reduce((a, k) => a + c[k], 0);
    $('.o-chit', box).innerHTML = `<div class="o-chit-h">ORDER CHIT <span>${total} item${total === 1 ? '' : 's'}</span></div>` + (keys.length ? keys.map(k => `<div class="o-row"><img src="${icon(k)}" alt=""><span>${esc(ORDER.itemName(k))}</span>${editable ? `<button data-dec="${k}">−</button>` : ''}<b>${c[k]}</b>${editable ? `<button data-inc="${k}">+</button>` : ''}</div>`).join('') : '<div class="o-empty">Tap the menu to add items...</div>');
  }

  function drawCustomers(s) {
    const wrap = $('.o-custs', box);
    const cs = s.script ? s.script.customers : [];
    const key = (s.script ? s.script.id : 'none');
    if (wrap._key === key) return;
    wrap._key = key;
    wrap.innerHTML = cs.map((c, i) => `<div class="o-cust" data-i="${i}"><div class="o-bub"></div><span class="av" style="background-image:url(${SPR.avatarSheet(c.avatar)});animation-delay:-${(i * 1.3).toFixed(1)}s"></span><small>${esc(c.name)}</small></div>`).join('') || '<div class="o-wait">Meja kosong...</div>';
  }

  function say(i, step) {
    $$('.o-cust', box).forEach(c => { c.classList.remove('talk'); $('.o-bub', c).classList.remove('show'); });
    const c = $(`.o-cust[data-i="${i}"]`, box); if (!c) return;
    const b = $('.o-bub', c);
    let icons = '';
    if (step.kind === 'tukar') icons = `<span class="x"><img src="${icon(step.from)}" alt=""></span> → <img src="${icon(step.items[0].key)}" alt="">`;
    else icons = step.items.map(it => `<img src="${icon(it.key)}" alt="">${it.qty > 1 ? '<em>x' + it.qty + '</em>' : ''}`).join(' ');
    b.innerHTML = `<p>${esc(step.text)}</p><div class="o-ic">${icons}</div>`;
    b.classList.toggle('extra', step.kind !== 'order');
    // keep the bubble on screen (measure the layout box, not the scaled-in animation)
    b.style.marginLeft = '0px';
    const cr = UIZ.rect(c), half = b.offsetWidth / 2, mid = cr.left + cr.width / 2, vw = window.innerWidth / UIZ.z;
    const shift = Math.max(6 - (mid - half), Math.min(0, vw - 6 - (mid + half)));
    b.style.marginLeft = shift + 'px';
    c.classList.add('talk');
    void b.offsetWidth; b.classList.add('show');
    AU.play(step.kind === 'order' ? 'pop' : 'turn');
  }
  function hush() { $$('.o-cust', box).forEach(c => { c.classList.remove('talk'); $('.o-bub', c).classList.remove('show'); }); }

  function play(script) {
    timers.forEach(clearTimeout); timers = [];
    playingId = script.id;
    let t = 1400; // after the GILIRAN banner
    script.steps.forEach(step => {
      timers.push(setTimeout(() => say(step.who, step), t));
      t += ORDER.stepMs(step);
      timers.push(setTimeout(hush, t));
      t += 450;
    });
  }

  function drawReveal(s) {
    const r = s.result, el = $('.o-reveal', box);
    if (!r) { el.classList.add('hidden'); return; }
    const who = s.players.find(p => p.id === r.pid);
    const rows = r.items.map(it => {
      const cls = it.exp && it.got === it.exp ? 'ok' : it.exp && it.got ? 'part' : it.exp ? 'miss' : 'wrong';
      const mark = cls === 'ok' ? 'BETUL' : cls === 'part' ? it.got + '/' + it.exp : cls === 'miss' ? 'TERLUPA' : 'SALAH';
      return `<div class="o-row ${cls}"><img src="${icon(it.key)}" alt=""><span>${esc(ORDER.itemName(it.key))}${it.exp > 1 ? ' x' + it.exp : ''}</span><b>${mark}</b></div>`;
    }).join('');
    el.innerHTML = `<div class="o-rv-h ${r.perfect ? 'perfect' : ''}">${r.perfect ? 'PERFECT!' : esc(who ? who.name : '') + ': ' + r.correct + '/' + r.total + ' betul'}<b>+${r.pts}</b></div>${r.auto ? '<p class="o-note">Masa habis! (time up)</p>' : ''}<div class="o-list">${rows}</div>`;
    el.classList.remove('hidden');
  }

  OV.render = function (s, me) {
    st = s; meId = me;
    if (!box) return;
    // scores
    const q = $('.oq', box);
    const ids = s.order && s.order.length && s.phase !== 'lobby' ? s.order : s.players.map(p => p.id);
    q.innerHTML = ids.map(id => { const p = s.players.find(x => x.id === id); if (!p) return ''; return `<div class="kp-card${s.cur === id ? ' turn' : ''}${id === me ? ' me' : ''}" data-pid="${esc(id)}"><div class="ph-box"><span class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></span><b class="nm">${esc(p.name)}</b><small>${s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : p.score + ' PTS'}</small></div><div class="bubble"></div></div>`; }).join('');
    // header
    const cur = s.players.find(p => p.id === s.cur);
    $('.o-level', box).textContent = s.phase === 'lobby' ? 'INGAT ORDER' : s.phase === 'over' ? 'TUTUP KEDAI' : 'MEJA ' + s.level + '/' + s.levels;
    $('.o-who', box).textContent = s.phase === 'lobby' ? 'Remember every order!' : s.phase === 'over' ? '' : cur ? (s.cur === me ? 'Your table!' : cur.name + "'s table") : '';
    drawCustomers(s);
    if (s.phase === 'show' && s.script && playingId !== s.script.id) play(s.script);
    if (s.phase !== 'show') { timers.forEach(clearTimeout); timers = []; if (s.phase !== 'reveal') hush(); }
    // tablet
    const tablet = $('.o-tablet', box);
    const showTab = s.phase === 'answer';
    tablet.classList.toggle('hidden', !showTab);
    box.classList.toggle('answering', showTab);
    if (showTab) {
      if (!$('.o-grid', box).children.length) drawGrid();
      const m = s.cur === me;
      if (m && chitTurn !== s.script.id) { chitTurn = s.script.id; chit = {}; setTab('drink'); }
      drawChit(m ? chit : (s.chit || {}), m);
      tablet.classList.toggle('readonly', !m);
      const lock = $('.o-lock', box);
      lock.classList.toggle('hidden', m);
      if (!m) lock.textContent = (cur ? cur.name : '...') + ' sedang key in order...';
    }
    drawReveal(s.phase === 'reveal' ? s : {});
    box.classList.toggle('revealing', s.phase === 'reveal');
  };
  OV.fx = function (f) {
    if (f.type === 'reveal') {
      AU.play(f.perfect ? 'bj' : f.pts > 0 ? 'win' : 'lose');
      if (st && st.script) {
        const cs = $$('.o-cust', box);
        cs.forEach(c => { const av = $('.av', c); av.classList.remove('happy', 'sad'); void av.offsetWidth; av.classList.add(f.perfect ? 'happy' : 'sad'); });
      }
    }
  };
  OV.custSay = function (text) {
    const cs = $$('.o-cust', box); if (!cs.length) return;
    const c = cs[Math.floor(Math.random() * cs.length)], b = $('.o-bub', c);
    b.innerHTML = `<p>${esc(text)}</p>`; b.classList.add('extra');
    hush(); c.classList.add('talk'); void b.offsetWidth; b.classList.add('show');
    timers.push(setTimeout(hush, 2600));
  };
  OV.chitNow = () => Object.assign({}, chit);
  OV.reset = function () { timers.forEach(clearTimeout); timers = []; playingId = null; chit = {}; chitTurn = null; st = null; if (box) { $('.o-custs', box)._key = null; } };
  root.OV = OV;
})(window);
