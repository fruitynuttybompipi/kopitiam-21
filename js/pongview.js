/* Kopitiam 21 — Telur Pong view: perspective pixel table, kopi cups, flying eggs, swipe to throw. */
(function (root) {
  'use strict';
  const { PONG, SPR, AU } = root;
  const C = PONG.C;
  const PV = {};
  let cv, cx, S = 2, W = 0, H = 0, F = 0, H0 = 0, CX = 0;
  const CAM_Y = -2.0, CAM_H = 1.6;
  const SWIPE = 0.5; // a swipe this fraction of the table's height = full power
  let st = null, meId = null, mySeat = 0, onThrow = null;
  let tableImg = null, tableKey = '';
  let flight = null;          // {path, dt, t0, rims, rimDone}
  let drag = null;            // {x0,y0,x,y}
  let thrownAt = 0;
  const parts = [];           // particles in low-res screen space
  const ghosts = [];          // sinking cups {x,y,t0}
  const wind = [];            // wind streaks
  let prevCups = null;
  let raf = 0, visible = false;

  // ---------- projection (view frame: me at y<0 looking toward +y) ----------
  const view = (x, y) => mySeat === 0 ? [x, y] : [-x, C.L - y];
  function proj(x, y, z) {
    const d = Math.max(0.12, y - CAM_Y);
    return { x: CX + x * F / d, y: H0 + (CAM_H - z) * F / d, k: F / d, d };
  }
  const projW = (wx, wy, z) => { const [x, y] = view(wx, wy); return proj(x, y, z); };

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 2 : 3) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    // fit: near table edge at the bottom, far edge ~30% down
    const nd = 0 - CAM_Y, fd = C.L - CAM_Y;
    F = Math.min(0.76 * H / (CAM_H / nd - CAM_H / fd), 2.6 * W);
    H0 = 1.08 * H - CAM_H * F / (0 - CAM_Y);
    CX = W / 2;
    const key = W + 'x' + H + ':' + mySeat;
    if (key !== tableKey) { tableKey = key; tableImg = drawTable(); }
    return true;
  }

  // ---------- static table (scanline raster = crisp pixels) ----------
  function drawTable() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H), dd = img.data;
    const put = (x, y, r, gg, b, a) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const i = (y * W + x) * 4; dd[i] = r; dd[i + 1] = gg; dd[i + 2] = b; dd[i + 3] = a == null ? 255 : a; };
    const farY = Math.round(proj(0, C.L, 0).y), farLip = Math.round(proj(0, C.L, 0.03).y);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let sy = farLip; sy < H; sy++) {
      if (sy < farY) {
        // far wooden lip
        const d = CAM_H * F / Math.max(1, farY - H0);
        const hw = (C.W / 2 + 0.03) * F / d;
        for (let sx = Math.floor(CX - hw); sx <= Math.ceil(CX + hw); sx++) put(sx, sy, 107, 66, 38);
        continue;
      }
      const d = CAM_H * F / Math.max(0.5, sy - H0);
      const y = d + CAM_Y;
      if (y < -0.3) break;
      const hw = (C.W / 2) * F / d, rim = Math.max(1, Math.round(0.03 * F / d));
      const x0 = Math.floor(CX - hw - rim), x1 = Math.ceil(CX + hw + rim);
      for (let sx = x0; sx <= x1; sx++) {
        const edge = sx < CX - hw || sx > CX + hw;
        if (edge) { const top = sx < CX ? (sx - x0 < 1) : (x1 - sx < 1); top ? put(sx, sy, 42, 26, 18) : put(sx, sy, 122, 74, 42); continue; }
        const wx = (sx - CX) * d / F;
        // marble with soft veins
        const v = Math.sin(wx * 23 + y * 9 + Math.sin(y * 13) * 2) + Math.sin(wx * 7 - y * 17);
        let base = 234 + Math.floor(rnd() * 8) - 4;
        if (v > 1.6) base -= 22; else if (v > 1.35) base -= 10;
        put(sx, sy, base, base - 4, base - 12);
      }
    }
    // far edge shadow line
    for (let sx = 0; sx < W; sx++) { const i = (farY * W + sx) * 4; if (dd[i + 3]) { dd[i] = 59; dd[i + 1] = 36; dd[i + 2] = 22; } }
    g.putImageData(img, 0, 0);
    // centre line
    const m = proj(0, C.L / 2, 0);
    g.fillStyle = 'rgba(150,140,124,.5)';
    const hw = (C.W / 2) * m.k;
    g.fillRect(Math.round(CX - hw), Math.round(m.y), Math.round(hw * 2), 1);
    return c;
  }

  // ---------- sprites ----------
  const avCache = {};
  function avatarCanvas(id) {
    if (avCache[id]) return avCache[id];
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    SPR.drawGrid(c.getContext('2d'), SPR.avatarRows(id), SPR.AVATARS[id].pal, 0, 0, 1);
    return (avCache[id] = c);
  }

  function ellipseRows(cx0, cy0, rx, ry, cb) {
    const r = Math.max(1, Math.round(ry));
    for (let dy = -r; dy <= r; dy++) {
      const t = dy / (ry || 1);
      if (Math.abs(t) > 1) continue;
      const hw = rx * Math.sqrt(1 - t * t);
      cb(Math.round(cx0 - hw), Math.round(cy0 + dy), Math.max(1, Math.round(hw * 2)), dy, r);
    }
  }

  function drawCup(wx, wy, scale, alpha) {
    const b = projW(wx, wy, 0), t = projW(wx, wy, C.cupH * scale);
    const rx = C.cupR * b.k * scale;
    const tilt = Math.min(0.55, Math.max(0.18, (CAM_H - C.cupH) / b.d * 0.75));
    const ry = Math.max(1, rx * tilt);
    cx.globalAlpha = alpha == null ? 1 : alpha;
    // saucer
    ellipseRows(b.x, b.y, rx * 1.35, ry * 1.25, (x, y, w) => { cx.fillStyle = '#2a1a12'; cx.fillRect(x - 1, y, w + 2, 1); });
    ellipseRows(b.x, b.y, rx * 1.3, ry * 1.15, (x, y, w, dy) => { cx.fillStyle = dy < 0 ? '#e9e4d6' : '#cfc8b6'; cx.fillRect(x, y, w, 1); });
    // body
    const top = Math.round(t.y), bot = Math.round(b.y);
    const bh = bot - top, logo = rx >= 6 && bh >= 12 && root.Scene;
    for (let y = top; y <= bot; y++) {
      const k = (y - top) / Math.max(1, bot - top);
      const hw = rx * (1 - 0.22 * k);
      const x0 = Math.round(b.x - hw), w = Math.max(1, Math.round(hw * 2));
      const band = logo ? (k > 0.18 && k < 0.24) || (k > 0.76 && k < 0.82) : k > 0.32 && k < 0.5;
      cx.fillStyle = '#2a1a12'; cx.fillRect(x0 - 1, y, w + 2, 1);
      cx.fillStyle = band ? '#3fae6a' : '#f6f2e6'; cx.fillRect(x0, y, w, 1);
      cx.fillStyle = band ? '#2f8a5f' : '#d9d2c0'; cx.fillRect(x0 + Math.round(w * 0.72), y, Math.max(1, Math.round(w * 0.28)), 1);
    }
    if (logo) {
      // green KOPITIAM 21 logo printed on the cup
      const sc = rx >= 26 ? 2 : 1, big = rx * 1.6 >= root.Scene.tw('KOPITIAM', sc) + 2;
      const lines = big ? [['KOPITIAM', sc], ['21', sc * (bh >= 30 ? 2 : 1)]] : [['21', sc]];
      const th = lines.reduce((a, l) => a + 5 * l[1], 0) + (lines.length - 1) * sc;
      let ly = Math.round(top + bh * 0.5 - th / 2);
      const cxm = b.x - rx * 0.06;
      for (const [txt, s2] of lines) { root.Scene.ptext(cx, txt, Math.round(cxm - root.Scene.tw(txt, s2) / 2), ly, '#2f8a5f', s2); ly += 5 * s2 + sc; }
    }
    cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(b.x - rx * 0.78), bot, Math.max(1, Math.round(rx * 1.56)), 1);
    // handle
    const hx = Math.round(b.x + rx * 0.95), hy = Math.round(top + (bot - top) * 0.25), hh = Math.max(2, Math.round((bot - top) * 0.45));
    cx.fillStyle = '#2a1a12'; cx.fillRect(hx, hy, Math.max(1, Math.round(rx * 0.35)) + 1, hh);
    cx.fillStyle = '#f6f2e6'; cx.fillRect(hx, hy + 1, Math.max(1, Math.round(rx * 0.35)), Math.max(1, hh - 2));
    // rim + kopi
    ellipseRows(t.x, t.y, rx + 0.6, ry + 0.6, (x, y, w) => { cx.fillStyle = '#2a1a12'; cx.fillRect(x, y, w, 1); });
    ellipseRows(t.x, t.y, rx, ry, (x, y, w) => { cx.fillStyle = '#fbf8f0'; cx.fillRect(x, y, w, 1); });
    ellipseRows(t.x, t.y + Math.max(0.5, ry * 0.15), rx * 0.78, ry * 0.7, (x, y, w, dy) => { cx.fillStyle = dy < 0 ? '#5a3418' : '#3a2010'; cx.fillRect(x, y, w, 1); });
    if (rx > 3) { cx.fillStyle = 'rgba(255,240,200,.55)'; cx.fillRect(Math.round(t.x - rx * 0.35), Math.round(t.y - ry * 0.2), Math.max(1, Math.round(rx * 0.3)), 1); }
    cx.globalAlpha = 1;
  }

  function drawEgg(sx, sy, r, spin) {
    const rx = Math.max(1.5, r), ry = rx * 1.3;
    ellipseRows(sx, sy, rx + 1, ry + 1, (x, y, w) => { cx.fillStyle = '#2a1a12'; cx.fillRect(x, y, w, 1); });
    ellipseRows(sx, sy, rx, ry, (x, y, w, dy) => { cx.fillStyle = dy > ry * 0.35 ? '#e8dcc0' : '#fff8ea'; cx.fillRect(x, y, w, 1); });
    if (rx >= 2.5) {
      const off = Math.round(Math.cos(spin) * rx * 0.35);
      cx.fillStyle = '#ffffff'; cx.fillRect(Math.round(sx - rx * 0.4 + off), Math.round(sy - ry * 0.5), Math.max(1, Math.round(rx * 0.35)), Math.max(1, Math.round(ry * 0.3)));
    }
  }

  function drawSplat(wx, wy, i) {
    const p = projW(wx, wy, 0);
    const r = 0.04 * p.k, tilt = Math.min(0.55, Math.max(0.2, CAM_H / p.d * 0.7));
    let s = (i + 3) * 9973;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let k = 0; k < 6; k++) {
      const a = rnd() * Math.PI * 2, d = rnd() * r * 0.7;
      ellipseRows(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * tilt, r * (0.35 + rnd() * 0.35), r * tilt * 0.5, (x, y, w) => { cx.fillStyle = 'rgba(255,252,240,.95)'; cx.fillRect(x, y, w, 1); });
    }
    ellipseRows(p.x, p.y, r * 0.38, r * 0.38 * tilt + 0.5, (x, y, w) => { cx.fillStyle = '#f2b81e'; cx.fillRect(x, y, w, 1); });
    if (r > 3) { cx.fillStyle = '#ffe58a'; cx.fillRect(Math.round(p.x - r * 0.15), Math.round(p.y - 1), Math.max(1, Math.round(r * 0.2)), 1); }
    // shell bits
    cx.fillStyle = '#e8dcc0';
    for (let k = 0; k < 3; k++) cx.fillRect(Math.round(p.x + (rnd() - 0.5) * r * 2.4), Math.round(p.y + (rnd() - 0.5) * r * tilt * 2), 1, 1);
  }

  // ---------- frame ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    cx.clearRect(0, 0, W, H);
    const t = now / 1000;

    // opponent behind the far end
    const oppId = st.seats && st.seats.length === 2 ? st.seats.find(x => x !== meId) : st.players.find(p => p.id !== meId) && st.players.find(p => p.id !== meId).id;
    const opp = st.players.find(p => p.id === oppId);
    const fe = proj(0, C.L + 0.22, 0.02);
    if (opp) {
      const sc = Math.max(1, Math.floor(0.3 * fe.k / 16));
      const bob = Math.round(Math.sin(t * 3) * 0.6);
      const img = avatarCanvas(opp.avatar);
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, Math.round(CX - 8 * sc), Math.round(fe.y - 16 * sc + bob - 0.05 * fe.k), 16 * sc, 16 * sc);
      if (st.turn && st.turn.pid === opp.id && st.phase === 'aim') {
        const hp = proj(0.12, C.L + 0.12, 0.38 + Math.sin(t * 4) * 0.015);
        drawEgg(hp.x, hp.y, 0.022 * hp.k, 0);
      }
    }
    cx.drawImage(tableImg, 0, 0);

    // splats
    (st.splats || []).forEach((s, i) => drawSplat(s[0], s[1], i + Math.round(s[0] * 1000)));

    // wind streaks
    const vw = (mySeat === 0 ? 1 : -1) * (st.wind || 0);
    if (Math.abs(vw) > 0.05 && st.phase !== 'lobby') {
      while (wind.length < Math.round(Math.abs(vw) * 14)) wind.push({ x: Math.random(), y: 0.3 + Math.random() * 1.5, z: 0.2 + Math.random() * 0.4, l: 0.05 + Math.random() * 0.08 });
      while (wind.length > Math.round(Math.abs(vw) * 14)) wind.pop();
      cx.fillStyle = 'rgba(255,255,255,.45)';
      for (const w of wind) {
        w.x += vw * 0.006; if (w.x > 1.2) w.x = -0.2; if (w.x < -0.2) w.x = 1.2;
        const p = proj((w.x - 0.5) * 1.2, w.y, w.z);
        cx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(w.l * p.k)), 1);
      }
    } else wind.length = 0;

    // drawable objects sorted far -> near
    const objs = [];
    if (!st.cups || !Object.keys(st.cups).length) {
      for (const seat of [0, 1]) for (let i = 0; i < 6; i++) { const [x, y] = PONG.cupPos(seat, i); objs.push({ d: view(x, y)[1], f: () => drawCup(x, y, 1) }); }
    } else for (const pid of Object.keys(st.cups)) {
      const seat = st.seats.indexOf(pid);
      st.cups[pid].forEach((up, i) => { if (!up) return; const [x, y] = PONG.cupPos(seat, i); objs.push({ d: view(x, y)[1], f: () => drawCup(x, y, 1) }); });
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i], k = (now - g.t0) / 450;
      if (k >= 1) { ghosts.splice(i, 1); continue; }
      objs.push({ d: view(g.x, g.y)[1], f: () => drawCup(g.x, g.y, 1 - k * 0.9, 1 - k) });
    }
    // flying egg
    if (flight) {
      const el = Math.max(0, (now - flight.t0) / 1000), n = flight.path.length;
      const fi = el / flight.dt;
      if (fi >= n - 1) {
        if (now - flight.t0 > (n - 1) * flight.dt * 1000 + 250) flight = null;
      }
      if (flight) {
        const i0 = Math.min(n - 1, Math.floor(fi)), i1 = Math.min(n - 1, i0 + 1), k = Math.min(1, fi - i0);
        const a = flight.path[i0], b = flight.path[i1];
        const px = a[0] + (b[0] - a[0]) * k, py = a[1] + (b[1] - a[1]) * k, pz = a[2] + (b[2] - a[2]) * k;
        for (const ri of flight.rims) if (!flight.rimDone[ri] && i0 >= ri) { flight.rimDone[ri] = true; AU.play('clink'); }
        const vy = view(px, py)[1];
        objs.push({
          d: vy - 0.001, f: () => {
            if (pz >= 0 && Math.abs(view(px, py)[0]) <= C.W / 2 && vy >= -0.02 && vy <= C.L + 0.02) {
              const sh = projW(px, py, 0);
              const r = 0.025 * sh.k * Math.max(0.4, 1 - pz);
              ellipseRows(sh.x, sh.y, r, Math.max(0.6, r * 0.35), (x, y, w) => { cx.fillStyle = 'rgba(42,26,18,.28)'; cx.fillRect(x, y, w, 1); });
            }
            const p = projW(px, py, Math.max(-0.75, pz));
            drawEgg(p.x, p.y, 0.022 * p.k, el * 18);
          },
        });
      }
    }
    objs.sort((a, b) => b.d - a.d).forEach(o => o.f());

    // egg in my hand + aim arrow
    const myTurn = st.phase === 'aim' && st.turn && st.turn.pid === meId && !flight && now - thrownAt > 600;
    if (myTurn) {
      const hp = proj(0, C.y0, C.h0 + Math.sin(t * 4) * 0.01);
      drawEgg(hp.x, hp.y, 0.022 * hp.k, 0);
      if (drag) {
        const dy = (drag.y0 - drag.y), dx = drag.x - drag.x0;
        if (dy > 4) {
          const p = Math.min(1, dy / (SWIPE * cv.getBoundingClientRect().height));
          const a = Math.max(-1, Math.min(1, (dx / dy) / 0.75));
          const len = 10 + p * H * 0.3, ang = a * 0.6;
          const col = p < 0.5 ? '#7cff9a' : p < 0.85 ? '#f6c744' : '#ff6b5b';
          // distance guide: dashed line across the table where the egg would come down (no wind)
          const r = PONG.simulate(p, 0, 0, 0, [], { crossOnly: true });
          if (r && r.y > 0.05 && r.y < C.L + 0.3) {
            const gp = proj(0, r.y, 0), hw = (C.W / 2) * gp.k;
            for (let gx = Math.round(CX - hw); gx < CX + hw; gx += 4) { cx.fillStyle = 'rgba(246,199,68,.9)'; cx.fillRect(gx, Math.round(gp.y), 2, 1); }
          }
          for (let s = 0; s < len; s += 2) {
            const x = hp.x + Math.sin(ang) * s, y = hp.y - Math.cos(ang) * s - 4;
            cx.fillStyle = s % 6 < 2 ? '#2a1a12' : col; cx.fillRect(Math.round(x) - 1, Math.round(y), 2, 2);
          }
          PV.onAim && PV.onAim(p, a);
        }
      }
    }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.vy += q.g; q.x += q.vx; q.y += q.vy; q.life--;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      cx.fillStyle = q.c; cx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
  }

  function burstAt(wx, wy, z, cols, n, up) {
    const p = projW(wx, wy, z);
    const sc = Math.max(0.4, p.k / 120);
    for (let i = 0; i < n; i++) parts.push({
      x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2.4 * sc, vy: -(Math.random() * (up || 2.2) + 0.6) * sc, g: 0.16 * sc,
      c: cols[i % cols.length], s: Math.random() < 0.3 ? 2 : 1, life: 24 + Math.random() * 18,
    });
  }

  // ---------- input ----------
  function down(e) {
    if (!(st && st.phase === 'aim' && st.turn && st.turn.pid === meId) || flight) return;
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now() };
    e.preventDefault();
  }
  function move(e) { if (drag) { drag.x = e.clientX; drag.y = e.clientY; e.preventDefault(); } }
  function up(e) {
    if (!drag) return;
    const d = drag; drag = null;
    PV.onAim && PV.onAim(null);
    const dy = d.y0 - e.clientY, dx = e.clientX - d.x0;
    if (dy < 24) return;
    const h = cv.getBoundingClientRect().height;
    const p = Math.min(1, dy / (SWIPE * h));
    const a = Math.max(-1, Math.min(1, (dx / dy) / 0.75));
    thrownAt = performance.now();
    AU.play('whoosh');
    onThrow && onThrow(+p.toFixed(3), +a.toFixed(3));
  }

  // ---------- public ----------
  PV.mount = function (canvas, handlers) {
    cv = canvas; cx = cv.getContext('2d');
    onThrow = handlers.onThrow;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { drag = null; PV.onAim && PV.onAim(null); });
    raf = requestAnimationFrame(frame);
  };
  PV.show = function (on) { visible = on; if (!on) { flight = null; parts.length = 0; ghosts.length = 0; prevCups = null; st = null; tableKey = ''; } };
  PV.render = function (s, me) {
    meId = me;
    const seat = s.seats && s.seats.length === 2 ? s.seats.indexOf(me) : s.players.findIndex(p => p.id === me);
    const ns = seat < 0 ? 0 : seat;
    if (ns !== mySeat) { mySeat = ns; tableKey = ''; }
    // cups that just disappeared -> sink animation
    if (prevCups && s.cups) for (const pid of Object.keys(s.cups)) {
      const pc = prevCups[pid]; if (!pc) continue;
      s.cups[pid].forEach((up, i) => { if (!up && pc[i]) { const [x, y] = PONG.cupPos(s.seats.indexOf(pid), i); ghosts.push({ x, y, t0: performance.now() }); } });
    }
    prevCups = s.cups ? JSON.parse(JSON.stringify(s.cups)) : null;
    if (s.phase === 'lobby') flight = null;
    st = s;
  };
  PV.fx = function (f) {
    if (f.type === 'throw') {
      if (f.path && f.path.length) flight = { path: f.path, dt: f.dt, t0: performance.now(), rims: f.rims || [], rimDone: {} };
      if (f.pid !== meId && f.path && f.path.length) AU.play('whoosh');
      return;
    }
    if (f.type === 'land') {
      if (f.outcome === 'hit' && f.pos) {
        burstAt(f.pos[0], f.pos[1], C.cupH, ['#3a2010', '#5a3418', '#c98a4a', '#fff3dc'], 26, 2.6);
        AU.play('splash');
      } else if (f.outcome === 'splat' && f.pos) {
        burstAt(f.pos[0], f.pos[1], 0, ['#fff8ea', '#f2b81e', '#e8dcc0'], 14, 1.4);
        AU.play('crack');
      } else if (f.outcome === 'floor') AU.play('lose');
    }
  };
  // screen position (CSS px) of a world point, for HTML floating text
  PV.screenOf = function (wx, wy, z) {
    const r = cv.getBoundingClientRect(), p = projW(wx, wy, z || 0);
    return { x: (r.left + p.x * S) / UIZ.z, y: (r.top + p.y * S) / UIZ.z };
  };
  PV.mySeat = () => mySeat;
  root.PV = PV;
})(window);
