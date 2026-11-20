/* Kopitiam 21 — Roti Flip view: a greased steel counter, your dough, the timing ring and the tawa griddle.
   Your dough runs here; flips are reported to the host. */
(function (root) {
  'use strict';
  const { ROTI, AU } = root;
  const R = ROTI.R;
  const RV = {};
  let cv, cx, S = 3, W = 0, H = 0;
  let st = null, meId = null, visible = false, onReport = null;
  let d = null, dKey = '';            // my dough this round
  const pops = [], bits = [];
  let geo = null, steel = null, steelKey = '';

  const P = () => st && st.players.find(p => p.id === meId);
  function playing() { const p = P(); return !!(st && st.phase === 'play' && p && p.inGame && d && (d.st === 'ball' || d.st === 'air')); }

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 3 : 4) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    const kq = cv.parentElement.querySelector('.kq');
    const top = kq ? Math.ceil((kq.offsetTop + kq.offsetHeight) * UIZ.z / S) + 4 : 4;
    const wide = W > H * 1.1;
    const base = Math.max(6, Math.round(Math.min(W * (wide ? 0.08 : 0.1), (H - top) * (wide ? 0.12 : 0.075))));
    geo = { top, wide, base,
      dx: Math.round(wide ? W * 0.42 : W * 0.5), dy: Math.round(wide ? top + (H - top) * 0.55 : top + (H - top) * 0.45),
      gx: Math.round(wide ? W * 0.8 : W * 0.5), gy: Math.round(wide ? top + (H - top) * 0.55 : top + (H - top) * 0.86), gr: Math.round(base * 2.1) };
    return true;
  }
  function disc(x, y, r, col) {
    cx.fillStyle = col;
    for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) { const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))); cx.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2 + 1, 1); }
  }
  function ring(x, y, r, col) {
    cx.fillStyle = col;
    const n = Math.max(24, Math.round(r * 6));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; cx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); }
  }
  function drawSteel() {
    const key = W + 'x' + H;
    if (key === steelKey) return;
    steelKey = key;
    steel = document.createElement('canvas'); steel.width = W; steel.height = H;
    const g = steel.getContext('2d');
    const top = geo.top - 2;
    g.fillStyle = '#2a1a12'; g.fillRect(2, top - 1, W - 4, H - top + 1);
    g.fillStyle = '#b9c0c9'; g.fillRect(3, top, W - 6, H - top - 1);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = top + 1; y < H - 1; y++) if (rnd() < 0.5) { g.fillStyle = rnd() < 0.5 ? '#c9ced6' : '#aab1ba'; g.fillRect(3 + Math.floor(rnd() * W * 0.3), y, Math.floor(W * (0.3 + rnd() * 0.6)), 1); }
    // oil sheen
    for (let i = 0; i < 10; i++) { const x = 6 + rnd() * (W - 12), y = top + 4 + rnd() * (H - top - 8); g.fillStyle = 'rgba(255,240,190,.35)'; g.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(rnd() * 5), 1); }
  }

  // the dough: shading thins out as it grows, holes appear as it tears
  function drawDough(x, y, r, squash, tear, size, alpha) {
    const thin = Math.min(1, (size - 1) / 5);
    cx.globalAlpha = alpha == null ? 1 : alpha;
    const rx = r, ry = Math.max(1, r * squash);
    const row = (yy, hw, col) => { cx.fillStyle = col; cx.fillRect(Math.round(x - hw), Math.round(yy), Math.round(hw * 2) + 1, 1); };
    for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
      const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)));
      row(y + dy, hw, '#c9a36a');
      row(y + dy, Math.max(0, hw - 1), thin > 0.6 ? 'rgba(251,240,214,.82)' : thin > 0.3 ? '#f6e6c4' : '#f1dcb0');
    }
    // folds / sheen
    cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(Math.round(x - rx * 0.4), Math.round(y - ry * 0.4), Math.max(1, Math.round(rx * 0.3)), 1);
    if (size < 1.3) { cx.fillStyle = '#e8cc98'; cx.fillRect(Math.round(x - rx * 0.2), Math.round(y + ry * 0.3), Math.max(1, Math.round(rx * 0.5)), 1); }
    // holes
    const holes = Math.floor(tear * 9);
    for (let i = 0; i < holes; i++) {
      const a = i * 2.39, dd = 0.25 + ((i * 37) % 10) / 16;
      const hx = x + Math.cos(a) * rx * dd * 0.8, hy = y + Math.sin(a) * ry * dd * 0.8;
      disc(hx, hy, 1 + (i % 2), '#7d848e');
    }
    cx.globalAlpha = 1;
  }

  // ---------- my dough ----------
  function ensureDough() {
    const key = st ? st.round + ':' + st.rnd : '';
    if (key !== dKey) { dKey = key; d = { n: 0, size: 1, tear: 0, st: 'ball', t0: 0, T: 0, pts: 0 }; pops.length = 0; bits.length = 0; }
    if (d && st && st.dough && st.dough[meId]) {
      const sd = st.dough[meId];
      if (sd.st === 'banked' && d.st !== 'banked') { d.st = 'banked'; d.pts = sd.pts; }
      if (sd.st === 'banked') d.pts = sd.pts;
    }
  }
  function send(ev) { onReport && onReport({ t: 'rf', r: st.rnd, n: d.n, size: +d.size.toFixed(3), tear: +d.tear.toFixed(3), st: d.st, ev }); }
  function land(ev, now) {
    d.size += R.grow[ev](d.n); d.tear = Math.min(1, d.tear + R.tear[ev]); d.n++;
    const [txt, col] = ev === 'perfect' ? ['PERFECT!', '#3fae6a'] : ev === 'ok' ? ['OK', '#c9a23a'] : ['AIYO!', '#c0392b'];
    pops.push({ text: d.n >= R.TISU && ev !== 'miss' && d.n === R.TISU ? 'ROTI TISU!' : txt, col, at: now });
    AU.play(ev === 'perfect' ? 'coin' : ev === 'ok' ? 'chip' : 'crack');
    if (d.tear >= 1) { d.st = 'koyak'; tearApart(); AU.play('bust'); navigator.vibrate && navigator.vibrate([60, 40, 100]); }
    else { d.st = 'ball'; navigator.vibrate && navigator.vibrate(ev === 'perfect' ? 15 : 40); }
    send(ev);
    RV.onLocal && RV.onLocal(d);
  }
  function tearApart() {
    for (let i = 0; i < 5; i++) bits.push({ a: i / 5 * Math.PI * 2 + Math.random() * 0.5, d: 0, v: 0.6 + Math.random() * 0.8, r: 0.35 + Math.random() * 0.25 });
  }
  RV.tap = function () {
    if (!playing()) return;
    const now = performance.now();
    if (d.st === 'ball') {
      d.st = 'air'; d.t0 = now; d.T = R.air(d.n) * 1000; d.W = R.win(d.n) * 1000;
      AU.play('whoosh');
      send('fling');
      RV.onLocal && RV.onLocal(d);
      return;
    }
    if (d.st === 'air') {
      const off = Math.abs(now - d.t0 - d.T);
      land(off <= d.W ? 'perfect' : off <= d.W * 2.2 ? 'ok' : 'miss', now);
    }
  };
  RV.letak = function () {
    if (!playing() || d.st !== 'ball') return false;
    d.st = 'banked'; d.pts = R.pts(d.size, d.n, st.telur);
    AU.play('splash');
    send('letak');
    RV.onLocal && RV.onLocal(d);
    return true;
  };
  RV.state = () => d;

  // ---------- frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    ensureDough();
    // dropped it: too late to catch
    if (d && d.st === 'air' && st.phase === 'play' && now - d.t0 > d.T + d.W * 2.2) land('miss', now);
    const t = now / 1000, g = geo;
    cx.clearRect(0, 0, W, H);
    drawSteel(); cx.drawImage(steel, 0, 0);
    // tawa griddle
    disc(g.gx, g.gy + 1, g.gr + 1, '#1a1a1a'); disc(g.gx, g.gy, g.gr, '#3a3a3a'); disc(g.gx, g.gy, g.gr - 2, '#2a2a2a');
    cx.fillStyle = 'rgba(255,255,255,.08)'; cx.fillRect(g.gx - g.gr + 3, g.gy - 2, g.gr, 1);
    if (!d) return;
    const r0 = g.base * Math.sqrt(d.size);
    if (d.st === 'banked') {
      // folded square roti on the tawa, golden spots, steam
      const sq = Math.round(Math.min(g.gr * 1.3, r0 * 1.1));
      cx.fillStyle = '#8a5a34'; cx.fillRect(g.gx - sq / 2 - 1, g.gy - sq / 2 - 1, sq + 2, sq + 2);
      cx.fillStyle = '#e8b866'; cx.fillRect(g.gx - sq / 2, g.gy - sq / 2, sq, sq);
      cx.fillStyle = '#c98a3a'; for (let i = 0; i < 6; i++) cx.fillRect(Math.round(g.gx - sq / 2 + ((i * 7) % sq)), Math.round(g.gy - sq / 2 + ((i * 11) % sq)), 2, 1);
      if (st.telur) { disc(g.gx, g.gy, sq * 0.22, '#fff8ea'); disc(g.gx, g.gy, sq * 0.1, '#f2a81e'); }
      for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; cx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - k)).toFixed(2)})`; cx.fillRect(Math.round(g.gx - sq / 3 + i * sq / 3), Math.round(g.gy - sq / 2 - k * 16), 1, 2); }
      bigText('+' + d.pts, '#f6c744', g.gx, g.gy - sq / 2 - 12);
      if (d.n >= R.TISU) bigText('TISU!', '#c0392b', g.gx, g.gy + sq / 2 + 6, 1);
    } else if (d.st === 'koyak') {
      for (const b of bits) {
        b.d = Math.min(1, b.d + 0.04);
        const x = g.dx + Math.cos(b.a) * r0 * 0.9 * b.d * b.v, y = g.dy + Math.sin(b.a) * r0 * 0.9 * b.d * b.v;
        drawDough(x, y, r0 * b.r, 0.8, 0.5, d.size, 1);
      }
      if (st.telur) { disc(g.dx + 2, g.dy, r0 * 0.4, '#fff8ea'); disc(g.dx + 3, g.dy + 1, r0 * 0.2, '#f2a81e'); }
      bigText('KOYAK!', '#c0392b', g.dx, g.dy - r0 - 10);
    } else if (d.st === 'air') {
      const u = Math.min(1.25, (now - d.t0) / d.T);
      const up = Math.sin(Math.min(1, u) * Math.PI);
      const sc = 1 + up * 0.45, spin = Math.abs(Math.cos(u * Math.PI * (2 + Math.min(4, d.n * 0.3))));
      // shadow
      disc(g.dx, g.dy + 2, r0 * (1 - up * 0.3), 'rgba(0,0,0,.18)');
      drawDough(g.dx, g.dy - up * g.base * 2.2, r0 * sc, Math.max(0.15, spin), d.tear, d.size);
      // timing ring closes in on the dough's landing size
      const left = (d.t0 + d.T) - now;
      const rr = r0 * (1 + Math.max(0, left) / d.T * 1.6);
      const hot = Math.abs(left) <= d.W;
      ring(g.dx, g.dy, rr, hot ? '#3fae6a' : '#f6c744');
      ring(g.dx, g.dy, rr + 1, hot ? '#3fae6a' : '#c9a23a');
      ring(g.dx, g.dy, r0, 'rgba(42,26,18,.45)');
    } else {
      drawDough(g.dx, g.dy, r0, 1, d.tear, d.size);
      if (playing() && Math.floor(t * 2) % 2) bigText('TAP!', '#2a1a12', g.dx, g.dy + r0 + 4, 1);
    }
    hud(t);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i], age = now - p.at;
      if (age > 900) { pops.splice(i, 1); continue; }
      bigText(p.text, p.col, g.dx, g.dy - r0 - 14 - age / 900 * 10);
    }
    if (st.phase === 'ready') { const left = st.timer ? Math.ceil(st.timer.left / 1000) : 0; bigText(st.telur ? 'ROTI TELUR X2' : 'SIAP...', '#2a1a12', W / 2, geo.top + 6); }
    if (st.phase === 'break') bigText('ROUND ' + st.rnd + ' HABIS', '#2a1a12', W / 2, geo.top + 6);
  }
  function bigText(txt, col, x, y, sc) {
    sc = sc || (W > 420 ? 2 : 1);
    const tx = Math.round(x - root.Scene.tw(txt, sc) / 2), ty = Math.round(y);
    root.Scene.ptext(cx, txt, tx + sc, ty + sc, '#fbf8f0', sc);
    root.Scene.ptext(cx, txt, tx, ty, col, sc);
  }
  function hud(t) {
    const sc = W > 420 ? 2 : 1;
    const x = 8, y = geo.top + 4;
    const pts = R.pts(d.size, d.n, st && st.telur);
    const lines = [['FLIP ' + d.n, '#2a1a12'], [(d.st === 'koyak' ? 0 : pts) + ' PTS', d.n >= R.TISU ? '#c0392b' : '#2a1a12']];
    cx.fillStyle = 'rgba(251,243,220,.9)'; cx.fillRect(x - 3, y - 3, root.Scene.tw('000 PTS', sc) + 8, 14 * sc + 16);
    lines.forEach(([s, c], i) => root.Scene.ptext(cx, s, x, y + i * 7 * sc, c, sc));
    // koyak meter
    const by = y + 14 * sc + 1, bw = root.Scene.tw('000 PTS', sc) + 2;
    root.Scene.ptext(cx, 'KOYAK', x, by, '#4a3020', 1);
    cx.fillStyle = '#2a1a12'; cx.fillRect(x, by + 6, bw, 5);
    cx.fillStyle = '#e9e5dc'; cx.fillRect(x + 1, by + 7, bw - 2, 3);
    cx.fillStyle = d.tear > 0.6 && Math.floor(t * 8) % 2 ? '#ff6b5b' : '#c0392b'; cx.fillRect(x + 1, by + 7, Math.round((bw - 2) * Math.min(1, d.tear)), 3);
  }

  RV.mount = function (canvas, h) {
    cv = canvas; cx = cv.getContext('2d');
    onReport = h.onReport;
    cv.addEventListener('pointerdown', e => { if (!playing()) return; e.preventDefault(); RV.tap(); });
    requestAnimationFrame(frame);
  };
  RV.show = function (on) { visible = on; if (!on) { st = null; d = null; dKey = ''; } };
  RV.render = function (s, me) { st = s; meId = me; ensureDough(); };
  RV.fx = function (f) {
    if (f.type === 'koyak' && f.pid !== meId) AU.play('crack');
    if (f.type === 'letak' && f.pid !== meId) AU.play('chip');
  };
  root.RV = RV;
})(window);
