/* Kopitiam 21 — Ais Kacang Tower view: a bowl of shaved ice, a wobbly tower of toppings,
   and the next topping swinging across the top. Tap to drop. */
(function (root) {
  'use strict';
  const { KACANG, AU } = root;
  const IV = {};
  let cv, cx, S = 3, W = 0, H = 0;
  let st = null, meId = null, visible = false, onDrop = null;
  let offs = null, offsAt = 0;
  let geo = null, cam = 0, sent = null, lastLen = 0, landAt = 0, fallKey = '';
  const falling = [], drops = [];

  const hostNow = () => Date.now() + (offs || 0);
  function syncClock(s) {
    if (typeof s.clock !== 'number') return;
    const o = s.clock - Date.now();
    if (offs === null || o > offs || Date.now() - offsAt > 8000) { offs = o; offsAt = Date.now(); }
  }
  const mine = () => !!(st && st.phase === 'turn' && st.turn && st.turn.pid === meId);

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 3 : 4) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    const kq = cv.parentElement.querySelector('.kq');
    const top = kq ? Math.ceil((kq.offsetTop + kq.offsetHeight) * UIZ.z / S) + 4 : 4;
    const U = Math.round(Math.min(W * 0.46, (H - top) * 0.5));
    geo = { top, U, cx0: Math.round(W / 2), floor: H - 8 };
    return true;
  }
  // drawn a bit taller than the physics so toppings read well on screen
  const dims = k => { const d = k === 'ice' ? KACANG.BASE : KACANG.KINDS[k]; return { w: d.w, h: d.h * (k === 'ice' ? 1.2 : 1.6) }; };

  // ---------- pieces ----------
  function blob(x, y, w, h, col, edge) {
    // rounded pixel slab, (x, y) = bottom centre
    const l = Math.round(x - w / 2), t = Math.round(y - h), ww = Math.round(w), hh = Math.max(2, Math.round(h));
    cx.fillStyle = edge; cx.fillRect(l + 1, t, ww - 2, hh); cx.fillRect(l, t + 1, ww, hh - 2);
    cx.fillStyle = col; cx.fillRect(l + 1, t + 1, ww - 2, hh - 2);
    return { l, t, ww, hh };
  }
  function seeded(i) { let s = (i * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
  function drawPiece(k, x, y, U, seed) {
    const d = dims(k), w = d.w * U, h = d.h * U;
    const r = seeded(seed + 1);
    if (k === 'ice') {
      // shaved-ice mountain with sirap and santan drizzle
      const l = Math.round(x - w / 2);
      for (let dy = 0; dy < h; dy++) {
        const k2 = dy / h, hw = w / 2 * Math.sqrt(1 - Math.pow(Math.max(0, k2 - 0.15) / 0.85, 2.2));
        cx.fillStyle = dy === Math.floor(h) - 1 ? '#9fb8c8' : '#eef6fb';
        cx.fillRect(Math.round(x - hw), Math.round(y - dy - 1), Math.round(hw * 2), 1);
      }
      for (let i = 0; i < 10; i++) { cx.fillStyle = i % 3 ? '#e8446a' : '#3fae6a'; const px = l + r() * w, py = y - r() * h * 0.8 - 1; cx.fillRect(Math.round(px), Math.round(py), 1, 2 + Math.round(r() * 2)); }
      cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(x - w * 0.15), Math.round(y - h + 1), Math.round(w * 0.2), 1);
      return;
    }
    const pal = { kacang: ['#7a1f1f', '#4a1010', '#a83232'], jagung: ['#f2c84a', '#a8801e', '#fbe49a'], cendol: ['#d8eec8', '#2a7a3a', '#3fae6a'], jelly: ['#fbf3dc', '#8a7458', '#e8446a'], atapchee: ['#eeeedd', '#9a9a80', '#ffffff'], aiskrim: ['#f58ab0', '#b8506e', '#ffd0e0'] }[k];
    const b = blob(x, y, w, h, pal[0], pal[1]);
    if (k === 'kacang' || k === 'jagung') { for (let i = 0; i < b.ww * b.hh / 5; i++) { cx.fillStyle = pal[2]; cx.fillRect(b.l + 1 + Math.floor(r() * (b.ww - 2)), b.t + 1 + Math.floor(r() * (b.hh - 2)), k === 'kacang' ? 2 : 1, 1); } }
    if (k === 'cendol') { for (let i = 0; i < b.ww / 3; i++) { cx.fillStyle = pal[2]; const px = b.l + 1 + Math.floor(r() * (b.ww - 4)), py = b.t + 1 + Math.floor(r() * (b.hh - 2)); cx.fillRect(px, py, 3, 1); } }
    if (k === 'jelly') { const cols = ['#e8446a', '#3fae6a', '#f2c84a', '#7aa0e8']; for (let i = 0; i < b.ww / 3; i++) { cx.fillStyle = cols[i % 4]; cx.fillRect(b.l + 1 + Math.floor(r() * (b.ww - 3)), b.t + 1 + Math.floor(r() * (b.hh - 3)), 2, 2); } }
    if (k === 'atapchee') { for (let i = 0; i < b.ww / 4; i++) { cx.fillStyle = '#c9c9b0'; cx.fillRect(b.l + 1 + Math.floor(r() * (b.ww - 3)), b.t + 1 + Math.floor(r() * (b.hh - 2)), 2, 1); } }
    if (k === 'aiskrim') { cx.fillStyle = pal[2]; cx.fillRect(b.l + 2, b.t + 1, Math.max(1, Math.round(b.ww * 0.3)), 1); cx.fillStyle = '#6a4028'; cx.fillRect(b.l + Math.round(b.ww * 0.6), b.t + 2, 1, 1); }
    cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(b.l + 1, b.t + 1, b.ww - 2, 1);
  }

  // ---------- frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    const t = now / 1000, g = geo, U = g.U;
    cx.clearRect(0, 0, W, H);
    const stack = st.stack || [];
    if (stack.length !== lastLen) { if (stack.length > lastLen && stack.length > 1) landAt = now; lastLen = stack.length; sent = null; }
    // heights of each piece (bottom y in tower units)
    const ys = []; let acc = 0;
    for (const p of stack) { ys.push(acc); acc += dims(p.k).h; }
    const towerTop = acc;
    // tower collapsed? hide everything from the falling level up and throw it
    const fell = st.last && !st.last.ok && (st.phase === 'drop' || st.phase === 'over') && st.last.level ? st.last.level : 0;
    const fk = fell ? st.round + ':' + st.bowl + ':' + stack.length : '';
    if (fk && fk !== fallKey) {
      fallKey = fk;
      for (let i = fell; i < stack.length; i++) falling.push({ k: stack[i].k, x: stack[i].x, y: ys[i], vx: (st.last.dir || 1) * (0.25 + Math.random() * 0.35) * (1 + (i - fell) * 0.15), vy: 0.2 + Math.random() * 0.3, at: now, seed: i });
      for (let i = 0; i < 26; i++) drops.push({ x: stack[Math.max(0, fell - 1)].x + (Math.random() - 0.5) * 0.4, y: ys[fell] || 0, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 1.4, c: ['#e8446a', '#3fae6a', '#f2c84a', '#7a1f1f'][i % 4], at: now });
    }
    // camera: keep the top of the tower in the upper half
    const want = Math.max(0, (towerTop + 0.3) * U - (g.floor - g.top) * 0.62);
    cam += (want - cam) * 0.08;
    const baseY = g.floor - 18 + cam;               // screen y of the ice bottom
    const sy = y => baseY - y * U;
    // lean -> sway
    const lean = st.last && st.last.ok ? st.last.lean : stack.length > 1 ? (KACANG.check(stack).lean || 0) : 0;
    const n = stack.length - 1;
    const amp = Math.pow(lean, 2) * 0.05 * Math.sqrt(Math.max(1, n));
    const sway = i => (fell && i >= fell) ? 0 : amp * Math.sin(t * 2.4) * Math.pow(i / Math.max(1, n), 1.6);
    // table
    cx.fillStyle = '#e9e5dc'; cx.fillRect(0, baseY + 6, W, 4); cx.fillStyle = '#7a4a2a'; cx.fillRect(0, baseY + 10, W, H);
    // bowl
    const bw = KACANG.BASE.w * U * 1.15, bh = 16;
    for (let dy = 0; dy < bh; dy++) { const hw = bw / 2 * (1 - dy / bh * 0.35); cx.fillStyle = dy === 0 ? '#2a1a12' : dy < 3 ? '#e8446a' : '#d6eef4'; cx.fillRect(Math.round(g.cx0 - hw), Math.round(baseY - 6 + dy), Math.round(hw * 2), 1); }
    cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(g.cx0 - bw / 2), Math.round(baseY - 6), 1, 8); cx.fillRect(Math.round(g.cx0 + bw / 2) - 1, Math.round(baseY - 6), 1, 8);
    cx.fillStyle = '#9fb8c8'; cx.fillRect(Math.round(g.cx0 - bw * 0.25), Math.round(baseY + bh - 6), Math.round(bw * 0.5), 2);
    // tower
    for (let i = 0; i < stack.length; i++) {
      if (fell && i >= fell) continue;
      const p = stack[i];
      let drop = 0;
      if (i === stack.length - 1 && i > 0 && now - landAt < 220) drop = (1 - (now - landAt) / 220) * 30;
      drawPiece(p.k, g.cx0 + (p.x + sway(i)) * U, sy(ys[i]) - drop, U, i);
    }
    // falling pieces + splashes
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i], a = (now - f.at) / 1000;
      if (a > 2.5) { falling.splice(i, 1); continue; }
      const x = f.x + f.vx * a * 1.5, y = f.y + f.vy * a - 2.2 * a * a;
      drawPiece(f.k, g.cx0 + x * U, sy(y), U, f.seed);
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], a = (now - d.at) / 1000;
      if (a > 1.4) { drops.splice(i, 1); continue; }
      cx.fillStyle = d.c; cx.fillRect(Math.round(g.cx0 + (d.x + d.vx * a) * U), Math.round(sy(d.y + d.vy * a - 3 * a * a)), 1, 1);
    }
    // the swinging topping
    const tr = st.turn;
    if (st.phase === 'turn' && tr) {
      const x = sent && sent.id === tr.id ? sent.x : KACANG.swingX(tr.n, tr.phase, Math.max(0, hostNow() - tr.t0));
      const d = dims(tr.k);
      const hy = sy(towerTop) - Math.max(14, d.h * U + 10);
      // drop guide
      cx.fillStyle = mine() ? 'rgba(42,26,18,.45)' : 'rgba(42,26,18,.2)';
      for (let y = hy + 2; y < sy(towerTop) - 1; y += 3) cx.fillRect(Math.round(g.cx0 + x * U), Math.round(y), 1, 1);
      // a spoon holding it
      const px = Math.round(g.cx0 + x * U);
      cx.fillStyle = '#9aa1ab'; cx.fillRect(px - 1, Math.round(hy - d.h * U - 12), 2, 10);
      drawPiece(tr.k, g.cx0 + x * U, hy, U, n + 1);
      label(KACANG.KINDS[tr.k].label, px, Math.round(hy - d.h * U - 20));
    }
    // height
    const sc = W > 420 ? 2 : 1;
    const txt = 'TINGKAT ' + Math.max(0, fell ? fell - 1 : n);
    cx.fillStyle = 'rgba(251,243,220,.92)'; cx.fillRect(4, g.top, root.Scene.tw(txt, sc) + 8, 7 * sc + 6);
    root.Scene.ptext(cx, txt, 8, g.top + 3, '#2a1a12', sc);
    if (fell && (st.phase === 'drop' || st.phase === 'over')) big('RUNTUH!', '#c0392b', g.cx0, Math.max(g.top + 20, sy(towerTop) - 30));
  }
  function label(txt, x, y) {
    const w = root.Scene.tw(txt) + 4;
    cx.fillStyle = 'rgba(42,26,18,.8)'; cx.fillRect(Math.round(x - w / 2), y - 1, w, 7);
    root.Scene.ptext(cx, txt, Math.round(x - w / 2 + 2), y, '#f6c744');
  }
  function big(txt, col, x, y) {
    const sc = W > 300 ? 2 : 1, tx = Math.round(x - root.Scene.tw(txt, sc) / 2);
    root.Scene.ptext(cx, txt, tx + sc, Math.round(y) + sc, '#fbf8f0', sc);
    root.Scene.ptext(cx, txt, tx, Math.round(y), col, sc);
  }

  IV.tap = function () {
    if (!mine()) return;
    const tr = st.turn;
    if (sent && sent.id === tr.id) return;
    const x = KACANG.swingX(tr.n, tr.phase, Math.max(0, hostNow() - tr.t0));
    sent = { id: tr.id, x };
    AU.play('whoosh');
    onDrop && onDrop({ t: 'drop', id: tr.id, x: +x.toFixed(4) });
  };
  IV.mount = function (canvas, h) {
    cv = canvas; cx = cv.getContext('2d');
    onDrop = h.onDrop;
    cv.addEventListener('pointerdown', e => { if (!mine()) return; e.preventDefault(); IV.tap(); });
    requestAnimationFrame(frame);
  };
  IV.show = function (on) { visible = on; if (!on) { st = null; falling.length = 0; drops.length = 0; cam = 0; lastLen = 0; } };
  IV.render = function (s, me) { st = s; meId = me; syncClock(s); };
  IV.fx = function (f) {
    if (f.type === 'drop') AU.play(f.ok ? (f.lean > 0.75 ? 'tick' : 'chip') : 'crack');
    if (f.type === 'runtuh') { AU.play('splash'); AU.play('bust'); }
    if (f.type === 'banner' && /MANGKUK|AIS KACANG/.test(f.text)) { falling.length = 0; drops.length = 0; fallKey = ''; }
  };
  IV.mine = mine;
  root.IV = IV;
})(window);
