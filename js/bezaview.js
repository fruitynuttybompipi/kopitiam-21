/* Kopitiam 21 — Cari Beza view: two pixel kopitiam pictures side by side (stacked on tall phones).
   Tap a difference on either picture. */
(function (root) {
  'use strict';
  const { BEZA, AU } = root;
  const $ = (s, r) => (r || document).querySelector(s);
  const BZ = {};
  let box, ca, cb, st = null, meId = null, handlers = {}, k = 2, cool = 0;
  const misses = [], pending = [];
  const SW = BEZA.SW, SH = BEZA.SH;

  // ---------- drawing ----------
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
  function disc(c, x, y, r, col) { c.fillStyle = col; for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) { const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))); c.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2 + 1, 1); } }
  const P = (c, t, x, y, col) => root.Scene.ptext(c, t, Math.round(x), Math.round(y), col);
  const COLS = { red: '#d4382c', green: '#3f9a3a', blue: '#3d6fd1', yellow: '#f2c84a', orange: '#e8902a', grey: '#8a8f99', black: '#2a2a2a', pink: '#f58ab0', white: '#f6f2e6' };
  const DRINK = { kopi: '#6a4028', teh: '#c98a4a', milo: '#8a5a34', sirap: '#e8446a' };
  const DRAW = {
    window(c, o) {
      R(c, o.x, o.y, 34, 26, '#6b4226'); R(c, o.x + 2, o.y + 2, 30, 22, '#9fd0f0');
      R(c, o.x + 5, o.y + 12, 6, 12, '#b8a888'); R(c, o.x + 13, o.y + 8, 7, 16, '#a89878'); R(c, o.x + 22, o.y + 14, 8, 10, '#c8b898');
      R(c, o.x + 16, o.y + 2, 2, 22, '#6b4226');
      if (o.v !== 'none') { const cc = COLS[o.v]; R(c, o.x + 2, o.y + 2, 5, 22, cc); R(c, o.x + 27, o.y + 2, 5, 22, cc); R(c, o.x + 2, o.y + 2, 30, 2, cc); }
    },
    clock(c, o) {
      const cx = o.x + 6, cy = o.y + 6;
      disc(c, cx, cy, 6, '#2a1a12'); disc(c, cx, cy, 5, '#fbf8f0');
      R(c, cx, cy - 4, 1, 4, '#2a1a12');
      const a = (o.h % 12) / 12 * Math.PI * 2;
      for (let i = 0; i <= 3; i++) R(c, cx + Math.sin(a) * i, cy - Math.cos(a) * i, 1, 1, '#c0392b');
    },
    calendar(c, o) { R(c, o.x, o.y, 12, 14, '#2a1a12'); R(c, o.x + 1, o.y + 1, 10, 12, '#fbf8f0'); R(c, o.x + 1, o.y + 1, 10, 4, '#c0392b'); const t = String(o.n); P(c, t, o.x + 6 - root.Scene.tw(t) / 2, o.y + 6, '#2a1a12'); },
    menu(c, o) {
      R(c, o.x, o.y, 30, 24, '#6b4226'); R(c, o.x + 2, o.y + 2, 26, 20, '#1f3a2a');
      o.prices.forEach((p, i) => { R(c, o.x + 4, o.y + 5 + i * 6, 3, 3, ['#c98a4a', '#f2c84a', '#e8e2d0'][i]); P(c, (p / 100).toFixed(2), o.x + 10, o.y + 4 + i * 6, '#fbf3dc'); });
    },
    fan(c, o) { R(c, o.x + 12, o.y, 2, 3, '#4a4a4a'); R(c, o.x, o.y + 3, 26, 2, '#8a5a34'); R(c, o.x + 11, o.y + 2, 4, 4, '#4a4a4a'); },
    lamp(c, o) { R(c, o.x + 3, o.y, 1, 6, '#2a2a2a'); R(c, o.x, o.y + 6, 8, 4, o.v === 'green' ? '#3f9a3a' : '#4a4a4a'); R(c, o.x + 2, o.y + 10, 4, 3, o.v === 'off' ? '#8a8f99' : '#fff2b0'); },
    poster(c, o) { const cc = COLS[o.v]; R(c, o.x, o.y, 16, 20, '#2a1a12'); R(c, o.x + 1, o.y + 1, 14, 18, cc); disc(c, o.x + 8, o.y + 8, 4, '#fbf8f0'); R(c, o.x + 3, o.y + 14, 10, 1, '#fbf8f0'); R(c, o.x + 3, o.y + 16, 7, 1, '#fbf8f0'); },
    cup(c, o) { R(c, o.x, o.y + 7, 10, 2, '#d6d1c6'); R(c, o.x + 1, o.y + 1, 7, 7, '#2a1a12'); R(c, o.x + 2, o.y + 2, 5, 5, '#fbf8f0'); R(c, o.x + 2, o.y + 2, 5, 2, DRINK[o.v]); R(c, o.x + 8, o.y + 3, 2, 3, '#2a1a12'); R(c, o.x + 3, o.y + 5, 3, 1, '#3fae6a'); },
    plate(c, o) {
      R(c, o.x, o.y + 4, 18, 2, '#c9c3b6'); R(c, o.x + 1, o.y + 3, 16, 2, '#fbf8f0');
      if (o.v === 'nasi') { R(c, o.x + 4, o.y, 7, 3, '#fbfbf4'); R(c, o.x + 11, o.y + 1, 3, 2, '#c0392b'); }
      if (o.v === 'roti') { R(c, o.x + 3, o.y + 1, 11, 2, '#d9a85a'); R(c, o.x + 5, o.y + 1, 3, 1, '#e8c890'); }
      if (o.v === 'mee') { R(c, o.x + 4, o.y, 10, 3, '#e8c35a'); R(c, o.x + 7, o.y, 2, 1, '#3f9a3a'); }
    },
    bottle(c, o) { const cc = o.v === 'chili' ? '#d4382c' : o.v === 'soy' ? '#2a1a12' : '#f2c84a'; R(c, o.x + 1, o.y, 3, 3, '#4a4a4a'); R(c, o.x, o.y + 3, 5, 9, cc); R(c, o.x + 1, o.y + 5, 1, 4, 'rgba(255,255,255,.4)'); },
    napkin(c, o) { R(c, o.x, o.y + 2, 10, 5, COLS[o.v] || '#f6f2e6'); R(c, o.x, o.y + 2, 10, 1, '#2a1a12'); R(c, o.x + 3, o.y, 4, 3, '#ffffff'); },
    bowl(c, o) { R(c, o.x, o.y + 2, 10, 5, '#fbf8f0'); R(c, o.x, o.y + 2, 10, 1, '#2a1a12'); R(c, o.x + 2, o.y + 6, 6, 1, '#c9c3b6'); if (o.v === 'telur') { disc(c, o.x + 5, o.y + 2, 2, '#fbfbf4'); R(c, o.x + 4, o.y + 1, 2, 2, '#f2a81e'); } },
    cat(c, o) {
      const cc = COLS[o.v], d = o.v === 'black' ? '#4a4a4a' : '#2a1a12';
      R(c, o.x + 2, o.y + 5, 9, 6, cc); R(c, o.x, o.y + 1, 6, 6, cc); R(c, o.x, o.y, 2, 2, cc); R(c, o.x + 4, o.y, 2, 2, cc);
      R(c, o.x + 1, o.y + 3, 1, 1, d); R(c, o.x + 4, o.y + 3, 1, 1, d); R(c, o.x + 11, o.y + 3, 2, 7, cc); R(c, o.x + 3, o.y + 11, 2, 1, d); R(c, o.x + 8, o.y + 11, 2, 1, d);
    },
    chair(c, o) { const cc = COLS[o.v]; R(c, o.x, o.y, 14, 10, cc); R(c, o.x, o.y + 10, 14, 2, '#2a1a12'); R(c, o.x + 1, o.y + 12, 2, 10, cc); R(c, o.x + 11, o.y + 12, 2, 10, cc); R(c, o.x + 2, o.y + 2, 10, 1, 'rgba(255,255,255,.3)'); },
    plant(c, o) { R(c, o.x + 3, o.y + 13, 6, 7, '#8a5a34'); R(c, o.x + 2, o.y + 13, 8, 2, '#6b4226'); R(c, o.x + 5, o.y + 4, 2, 9, '#2a7a3a'); R(c, o.x + 1, o.y + 6, 4, 3, '#3fae6a'); R(c, o.x + 7, o.y + 3, 4, 3, '#3fae6a'); if (o.v !== 'none') { R(c, o.x + 4, o.y, 4, 4, COLS[o.v]); R(c, o.x + 5, o.y + 1, 2, 2, '#fbf8f0'); } },
    fly(c, o) { R(c, o.x + 1, o.y + 1, 2, 2, '#1a1a1a'); R(c, o.x, o.y, 1, 1, '#d6eef4'); R(c, o.x + 3, o.y, 1, 1, '#d6eef4'); },
    tissue(c, o) { R(c, o.x, o.y + 1, 6, 4, '#ffffff'); R(c, o.x + 1, o.y, 3, 2, '#eeeee6'); R(c, o.x, o.y + 4, 6, 1, '#c9c3b6'); },
  };
  function drawScene(c, objs) {
    c.clearRect(0, 0, SW, SH);
    R(c, 0, 0, SW, 60, '#f1e6cf'); R(c, 0, 0, SW, 1, '#c9b89a');
    for (let x = 0; x < SW; x += 6) for (let y = 60; y < 84; y += 6) R(c, x, y, 6, 6, ((x + y) / 6) % 2 ? '#bfe0c4' : '#e8f4ea');
    R(c, 0, 59, SW, 1, '#8a7458');
    for (let x = 0; x < SW; x += 8) for (let y = 84; y < SH; y += 8) R(c, x, y, 8, 8, ((x + y) / 8) % 2 ? '#a8503a' : '#c8704a');
    const back = objs.filter(o => !o.gone && ['window', 'clock', 'calendar', 'menu', 'fan', 'lamp', 'poster', 'chair'].includes(o.k));
    const front = objs.filter(o => !o.gone && !back.includes(o));
    for (const o of back) DRAW[o.k](c, o);
    // the marble table
    R(c, 32, 62, 96, 4, '#2a1a12'); R(c, 33, 62, 94, 3, '#ece8df'); R(c, 40, 63, 20, 1, '#d6d1c6');
    R(c, 76, 66, 8, 22, '#3a3a3a'); R(c, 66, 88, 28, 3, '#2a2a2a');
    for (const o of front) DRAW[o.k](c, o);
  }
  function marks(c, now) {
    if (!st) return;
    for (const d of st.diffs || []) {
      if (!d.box) continue;
      const p = d.by && st.players.find(x => x.id === d.by);
      const col = p ? p.col : (Math.floor(now / 250) % 2 ? '#ffffff' : '#c0392b');
      const [x, y, w, h] = d.box;
      // a pixel ring around it
      c.fillStyle = col;
      c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
      c.fillStyle = 'rgba(42,26,18,.6)'; c.fillRect(x + 1, y + 1, w - 2, 1);
    }
    for (let i = misses.length - 1; i >= 0; i--) {
      const m = misses[i], a = now - m.at;
      if (a > 800) { misses.splice(i, 1); continue; }
      c.globalAlpha = 1 - a / 800;
      c.fillStyle = m.col;
      for (let j = -2; j <= 2; j++) { c.fillRect(Math.round(m.x + j), Math.round(m.y + j), 1, 1); c.fillRect(Math.round(m.x + j), Math.round(m.y - j), 1, 1); }
      c.globalAlpha = 1;
    }
    for (const p of pending) { if (now - p.at > 1500) continue; c.fillStyle = '#f6c744'; c.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3); }
  }

  // ---------- layout ----------
  function size() {
    const pics = $('.bz-pics', box);
    const r = pics.getBoundingClientRect();
    const aw = r.width / UIZ.z, ah = r.height / UIZ.z;
    if (!aw || !ah) return;
    const side = Math.min((aw - 12) / (SW * 2), ah / SH), stack = Math.min(aw / SW, (ah - 12) / (SH * 2));
    const tall = stack > side;
    k = Math.max(1, Math.floor(Math.max(side, stack) * 2) / 2);
    pics.classList.toggle('tall', tall);
    for (const c of [ca, cb]) { c.style.width = SW * k + 'px'; c.style.height = SH * k + 'px'; }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!st || box.classList.contains('hidden') || !st.a) return;
    const key = st.round + ':' + st.rnd;
    if (key !== BZ._key) { BZ._key = key; drawScene(BZ._ga, st.a); drawScene(BZ._gb, st.b); misses.length = 0; pending.length = 0; }
    for (const [c, g] of [[ca, BZ._ga], [cb, BZ._gb]]) { const x = c.getContext('2d'); x.clearRect(0, 0, SW, SH); x.drawImage(g.canvas, 0, 0); marks(x, now); }
  }

  BZ.mount = function (el, h) {
    box = el; handlers = h || {};
    box.innerHTML = `
      <div class="oq"></div>
      <div class="bz-head"><b class="bz-lvl"></b><span class="bz-count"></span></div>
      <div class="bz-pics"><div class="bz-pic"><canvas width="${SW}" height="${SH}"></canvas><i>A</i></div><div class="bz-pic"><canvas width="${SW}" height="${SH}"></canvas><i>B</i></div></div>`;
    [ca, cb] = [...box.querySelectorAll('canvas')];
    const off = () => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c.getContext('2d'); };
    BZ._ga = off(); BZ._gb = off();
    for (const c of [ca, cb]) c.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!st || st.phase !== 'play') return;
      const p = st.players.find(x => x.id === meId); if (!p || !p.inGame) return;
      const now = performance.now(); if (now < cool) { AU.play('deny'); return; }
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * SW, y = (e.clientY - r.top) / r.height * SH;
      pending.push({ x, y, at: now });
      cool = now + 250;
      handlers.onTap && handlers.onTap({ t: 'tap', x: +x.toFixed(1), y: +y.toFixed(1) });
    });
    window.addEventListener('resize', () => { if (!box.classList.contains('hidden')) size(); });
    requestAnimationFrame(frame);
  };
  BZ.render = function (s, me) {
    st = s; meId = me;
    size();
    const found = (s.diffs || []).filter(d => d.by).length;
    $('.bz-lvl', box).textContent = s.phase === 'lobby' ? 'CARI BEZA' : s.phase === 'over' ? 'HABIS!' : 'GAMBAR ' + Math.min(s.rnd, s.rounds) + '/' + s.rounds;
    $('.bz-count', box).innerHTML = s.a ? `Jumpa <b>${found}/${BEZA.DIFFS}</b>` : '';
    box.classList.toggle('noimg', !s.a);
  };
  BZ.fx = function (f) {
    if (f.type === 'found') { pending.length = 0; AU.play(f.pid === meId ? 'coin' : 'chip'); }
    if (f.type === 'miss') {
      pending.length = 0;
      const p = st && st.players.find(x => x.id === f.pid);
      misses.push({ x: f.x, y: f.y, at: performance.now(), col: f.late ? '#9a8a78' : (p ? p.col : '#c0392b') });
      if (f.pid === meId) { AU.play(f.late ? 'tick' : 'deny'); if (!f.late) cool = performance.now() + 900; }
    }
  };
  BZ.reset = function () { BZ._key = ''; misses.length = 0; pending.length = 0; };
  root.BZ = BZ;
})(window);
