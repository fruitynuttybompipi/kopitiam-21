/* Kopitiam 21 — Kopi Tumpah view: side view of one glass, a kettle that tips as you hold, and a lot of kopi. */
(function (root) {
  'use strict';
  const { KOPI, AU } = root;
  const KV = {};
  let cv, cx, S = 3, W = 0, H = 0;
  let st = null, meId = null, visible = false, onLevel = null;
  let shown = 0;                 // level drawn on screen
  let local = null;              // my own pour: {turnId, level, holdT, active, dripLeft, dripT, lastSend}
  let tilt = 0;                  // kettle tilt 0..1
  let spillT = 0, spillCup = -1; // overflow animation
  let slideT = 0, lastCup = -1;
  const parts = [];
  let lastNow = 0;

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = r.width < 640 ? 3 : 4;
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    return true;
  }

  // geometry of the glass in low-res pixels
  function glass() {
    const tableY = Math.round(H * 0.8);
    const gw = Math.round(Math.min(W * 0.34, H * 0.3));
    const gh = Math.round(gw * 1.3);
    const cxm = Math.round(W * 0.44);
    return { tableY, gw, gh, x: cxm, top: tableY - gh, bot: tableY, base: 4, wall: 2 };
  }
  // half-width of the glass inside at height y
  function halfAt(g, y) { const k = (y - g.top) / g.gh; return (g.gw / 2) * (1 - 0.14 * k); }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now;
    stepLocal(dt, now);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    cx.clearRect(0, 0, W, H);
    const t = now / 1000;
    const g = glass();

    // target level
    const target = local ? local.level : (st.level || 0);
    shown += (target - shown) * (local ? 1 : Math.min(1, dt * 10));
    if (st.phase === 'lobby' || st.phase === 'pick') shown = 0;

    // new cup slides in
    // a fresh cup (new cup in this game, or a whole new game) resets the spill
    const cupKey = st.round + ':' + st.cupNo;
    if (cupKey !== lastCup) { if (lastCup !== -1) slideT = now; lastCup = cupKey; spillCup = -1; parts.length = 0; }
    const slide = slideT && now - slideT < 600 ? Math.round(-(1 - (now - slideT) / 600) * W * 0.7) : 0;

    // table
    cx.fillStyle = '#e9e5dc'; cx.fillRect(0, g.tableY, W, 5);
    cx.fillStyle = '#d6d1c6'; cx.fillRect(0, g.tableY + 5, W, 2);
    cx.fillStyle = '#7a4a2a'; cx.fillRect(0, g.tableY + 7, W, H - g.tableY - 7);
    cx.fillStyle = '#5a361f'; for (let x = 0; x < W; x += 22) cx.fillRect(x, g.tableY + 9, 1, H);
    cx.fillStyle = '#2a1a12'; cx.fillRect(0, g.tableY + 7, W, 1);

    const spilling = spillCup === cupKey;
    // puddle
    if (spilling) {
      const k = Math.min(1, (now - spillT) / 1500);
      const pw = Math.round(g.gw * (0.6 + k * 1.8)), ph = Math.max(3, Math.round(3 + k * 4));
      for (let dy = 0; dy < ph; dy++) { const hw = pw * Math.sqrt(1 - Math.pow((dy - ph / 2) / (ph / 2 + 0.5), 2)); cx.fillStyle = dy < 1 ? '#8a5028' : '#5a3418'; cx.fillRect(Math.round(g.x + slide - hw), g.tableY + dy - 1, Math.round(hw * 2), 1); }
    }

    // wobble when nearly full
    const danger = Math.max(0, shown - 0.88) / 0.2;
    const wob = danger > 0 && !spilling ? Math.round(Math.sin(t * (30 + danger * 30)) * Math.min(2, danger * 2)) : 0;
    const gx = g.x + slide + wob;

    // glass back + kopi
    for (let y = g.top; y < g.bot - g.base; y++) { const hw = halfAt(g, y); cx.fillStyle = 'rgba(200,232,240,.18)'; cx.fillRect(Math.round(gx - hw), y, Math.round(hw * 2), 1); }
    const innerH = g.gh - g.base;
    const lv = Math.max(0, shown);
    const fillTop = g.bot - g.base - Math.min(1, lv) * (innerH - 1);
    for (let y = Math.round(fillTop); y < g.bot - g.base; y++) {
      const hw = halfAt(g, y) - g.wall;
      const foam = y - fillTop < 3;
      cx.fillStyle = foam ? '#c8915a' : (y % 7 === 0 ? '#5e3218' : '#6b3a1c');
      cx.fillRect(Math.round(gx - hw), y, Math.round(hw * 2), 1);
    }
    // bulge above the rim
    if (lv > 1 && !spilling) {
      const dome = Math.max(1, Math.round((lv - 1) / 0.12 * g.gw * 0.14));
      const hw0 = halfAt(g, g.top) - 1;
      for (let dy = 0; dy < dome; dy++) {
        const hw = hw0 * Math.sqrt(Math.max(0, 1 - Math.pow((dy + 1) / (dome + 1), 2)));
        cx.fillStyle = dy > dome - 3 ? '#c8915a' : '#6b3a1c';
        cx.fillRect(Math.round(gx - hw), g.top - dy - 1, Math.round(hw * 2), 1);
      }
    }
    if (spilling) {
      // kopi running down both sides
      const k = Math.min(1, (now - spillT) / 500);
      const hw = halfAt(g, g.top);
      for (const s of [-1, 1]) {
        const x = Math.round(gx + s * (hw + 1));
        cx.fillStyle = '#5a3418';
        cx.fillRect(x - (s < 0 ? 3 : 0), g.top - 2, 3, Math.round(k * g.gh) + 2);
        cx.fillRect(x - (s < 0 ? 6 : -3), g.top + Math.round(g.gh * 0.35 * k), 3, Math.round(k * g.gh * 0.65));
        cx.fillStyle = '#a0602e'; cx.fillRect(x - (s < 0 ? 2 : -1), g.top + Math.round(g.gh * 0.2 * k), 1, Math.round(k * g.gh * 0.5));
      }
      cx.fillStyle = '#6b3a1c'; cx.fillRect(Math.round(gx - hw) - 2, g.top - 4, Math.round(hw * 2) + 4, 4);
      cx.fillStyle = '#c8915a'; cx.fillRect(Math.round(gx - hw) - 1, g.top - 5, Math.round(hw * 2) + 2, 1);
      if (Math.random() < 0.6) parts.push({ x: gx + (Math.random() < 0.5 ? -1 : 1) * (hw + 2), y: g.top + Math.random() * g.gh, vx: 0, vy: 1, g: 0.1, c: '#6b3a1c', s: 1, life: 12 });
    }
    // KOPITIAM 21 logo printed on the glass
    if (root.Scene && g.gw >= 40) {
      const ly = Math.round(g.top + g.gh * 0.64), sc = g.gw >= 80 ? 2 : 1;
      cx.globalAlpha = 0.62; // printed on glass: the kopi level shows through
      const t1 = 'KOPITIAM', t2 = '21';
      const w1 = root.Scene.tw(t1, sc), w2 = root.Scene.tw(t2, sc * 2);
      const bw = w1 + 6 * sc, bh = 5 * sc + 5 * sc * 2 + 8 * sc;
      const bx = Math.round(gx - bw / 2), by = ly - Math.round(bh / 2);
      cx.fillStyle = 'rgba(42,26,18,.9)'; cx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      cx.fillStyle = 'rgba(192,57,43,.95)'; cx.fillRect(bx, by, bw, bh);
      cx.fillStyle = 'rgba(246,199,68,.95)'; cx.fillRect(bx + sc, by + sc, bw - 2 * sc, sc);
      root.Scene.ptext(cx, t1, bx + 3 * sc, by + 3 * sc, '#f6c744', sc);
      root.Scene.ptext(cx, t2, Math.round(gx - w2 / 2), by + 5 * sc + 5 * sc, '#ffffff', sc * 2);
      cx.globalAlpha = 1;
    }
    // glass walls, rim, base, handle
    for (let y = g.top; y < g.bot; y++) {
      const hw = halfAt(g, y);
      cx.fillStyle = '#9fc4cf'; cx.fillRect(Math.round(gx - hw) - 1, y, g.wall, 1); cx.fillRect(Math.round(gx + hw) - 1, y, g.wall, 1);
      if (y > g.top + 3 && y < g.bot - g.base - 3) { cx.fillStyle = 'rgba(255,255,255,.55)'; cx.fillRect(Math.round(gx - hw) + 2, y, 1, 1); }
    }
    cx.fillStyle = '#d8eef4'; cx.fillRect(Math.round(gx - halfAt(g, g.top)) - 1, g.top - 1, Math.round(halfAt(g, g.top) * 2) + 2, 1);
    const bhw = halfAt(g, g.bot - 1);
    cx.fillStyle = 'rgba(180,215,225,.75)'; cx.fillRect(Math.round(gx - bhw), g.bot - g.base, Math.round(bhw * 2), g.base);
    cx.fillStyle = '#7fa5b0'; cx.fillRect(Math.round(gx - bhw), g.bot - 1, Math.round(bhw * 2), 1);
    const hx = Math.round(gx - halfAt(g, g.top + g.gh * 0.3)) - 1, hy = g.top + Math.round(g.gh * 0.22), hh = Math.round(g.gh * 0.5), hwid = Math.max(4, Math.round(g.gw * 0.22));
    cx.fillStyle = '#9fc4cf';
    cx.fillRect(hx - hwid, hy, hwid, 2); cx.fillRect(hx - hwid, hy + hh - 2, hwid, 2); cx.fillRect(hx - hwid, hy, 2, hh);

    // steam
    if (lv > 0.05 && Math.random() < 0.35) parts.push({ x: gx + (Math.random() - 0.5) * g.gw * 0.6, y: fillTop - 2, vx: (Math.random() - 0.5) * 0.15, vy: -0.25, g: 0, c: 'rgba(255,255,255,.6)', s: 1, life: 30 });

    // kettle
    const pouring = local ? local.active : !!(st.turn && st.turn.pouring && st.phase === 'pour');
    const holdK = local && local.active ? Math.min(1, local.holdT / 1.2) : pouring ? 0.6 : 0;
    const want = pouring ? 0.35 + holdK * 0.65 : 0;
    tilt += (want - tilt) * Math.min(1, dt * 12);
    const tip = drawKettle(g, gx, tilt, t);
    // stream
    const surf = lv > 1 ? g.top - 2 : fillTop;
    if ((pouring || (local && local.dripLeft > 0)) && !spilling) {
      const thick = local && !local.active ? 1 : 1 + Math.round(holdK * 2);
      for (let y = Math.round(tip.y); y < surf; y++) {
        const k = (y - tip.y) / Math.max(1, surf - tip.y);
        const x = Math.round(tip.x + (gx - tip.x) * Math.pow(k, 0.6) * 0.9 + Math.sin(t * 25 + y * 0.6) * 0.6);
        if (local && !local.active && (y + Math.floor(t * 40)) % 4) continue; // drips
        cx.fillStyle = (y + Math.floor(t * 30)) % 5 ? '#6b3a1c' : '#a0602e';
        cx.fillRect(x, y, thick, 1);
      }
      if (Math.random() < 0.5) parts.push({ x: gx + (Math.random() - 0.5) * 4, y: surf, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 0.8, g: 0.12, c: '#c8915a', s: 1, life: 10 });
    }

    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.vy += q.g; q.x += q.vx; q.y += q.vy; q.life--;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      cx.fillStyle = q.c; cx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
  }

  function drawKettle(g, gx, k, t) {
    // pivot sits above-right of the glass; tipping swings the spout down toward the cup
    const size = Math.max(10, Math.round(g.gw * 0.55));
    const px = gx + g.gw * 0.75, py = g.top - g.gh * 0.4;
    const ang = -k * 0.75; // radians, counter-clockwise tips spout down-left
    cx.save();
    cx.translate(Math.round(px), Math.round(py));
    cx.rotate(ang);
    const u = size / 26;
    const R = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x * u), Math.round(y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u))); };
    // handle
    R(4, -16, 14, 3, '#2a1a12'); R(16, -16, 3, 14, '#2a1a12');
    // body
    R(-12, -6, 26, 18, '#2a1a12'); R(-11, -5, 24, 16, '#c9ced6'); R(-11, 6, 24, 5, '#9aa1ab'); R(-9, -4, 4, 9, '#eef1f4');
    // lid
    R(-7, -9, 16, 4, '#2a1a12'); R(-6, -8, 14, 2, '#b4bac4'); R(-1, -12, 4, 3, '#2a1a12');
    // spout
    R(-22, -3, 11, 4, '#2a1a12'); R(-21, -2, 10, 2, '#c9ced6'); R(-25, -6, 4, 5, '#2a1a12');
    cx.restore();
    // spout tip in screen space
    const lx = -24 * u, ly = -3 * u;
    return { x: px + lx * Math.cos(ang) - ly * Math.sin(ang), y: py + lx * Math.sin(ang) + ly * Math.cos(ang) };
  }

  // ---------- my pour ----------
  function stepLocal(dt, now) {
    if (!local) return;
    const tr = st && st.turn;
    if (!st || st.phase !== 'pour' || !tr || tr.id !== local.turnId || tr.pid !== meId) {
      // turn moved on (or spilled): drop the local copy
      if (!local.active && local.dripLeft <= 0) { local = null; AU.pour && AU.pour(false); }
      else if (!st || st.phase !== 'pour') { local = null; AU.pour && AU.pour(false); }
      return;
    }
    if (local.active) {
      local.holdT += dt;
      local.level += KOPI.rate(local.holdT) * dt;
    } else if (local.dripLeft > 0) {
      const d = Math.min(local.dripLeft, local.dripTotal * dt / 0.3);
      local.level += d; local.dripLeft -= d;
      if (local.dripLeft <= 1e-6) { local.dripLeft = 0; send(true); }
    }
    if (local && local.active && now - local.lastSend > 100) { local.lastSend = now; send(false); }
    if (local && KV.onLocal) KV.onLocal(local.level - tr.start > 0.0005, local.level);
  }
  function send(done) { if (local && onLevel) onLevel({ t: 'lvl', id: local.turnId, v: +local.level.toFixed(4), done }); }

  KV.press = function () {
    const tr = st && st.turn;
    if (!st || st.phase !== 'pour' || !tr || tr.pid !== meId) return;
    if (local && (local.active || local.dripLeft > 0)) return;
    const base = local && local.turnId === tr.id ? Math.max(local.level, st.level) : st.level;
    local = { turnId: tr.id, level: base, holdT: 0, active: true, dripLeft: 0, dripTotal: 0, lastSend: 0 };
    AU.unlock(); AU.pour && AU.pour(true);
  };
  KV.release = function () {
    if (!local || !local.active) return;
    local.active = false;
    local.dripTotal = local.dripLeft = KOPI.drip(local.holdT, Math.random());
    AU.pour && AU.pour(false);
    send(false);
  };
  KV.isMine = () => !!(st && st.phase === 'pour' && st.turn && st.turn.pid === meId);

  KV.mount = function (canvas, handlers) {
    cv = canvas; cx = cv.getContext('2d');
    onLevel = handlers.onLevel;
    cv.addEventListener('pointerdown', e => { if (KV.isMine()) { e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); KV.press(); } });
    cv.addEventListener('pointerup', () => KV.release());
    cv.addEventListener('pointercancel', () => KV.release());
    requestAnimationFrame(frame);
  };
  KV.show = function (on) { visible = on; if (!on) { st = null; local = null; parts.length = 0; lastCup = -1; spillCup = -1; AU.pour && AU.pour(false); } };
  KV.render = function (s, me) {
    meId = me; st = s;
    // other people's pour sound
    if (!local) AU.pour && AU.pour(!!(s.phase === 'pour' && s.turn && s.turn.pouring));
  };
  KV.fx = function (f) {
    if (f.type === 'spill') {
      spillT = performance.now(); spillCup = st ? st.round + ':' + st.cupNo : -1;
      local = null; AU.pour && AU.pour(false); AU.play('splash'); AU.play('bust');
      if (layout()) {
        const g = glass();
        for (let i = 0; i < 40; i++) parts.push({ x: g.x + (Math.random() - 0.5) * g.gw, y: g.top, vx: (Math.random() - 0.5) * 2.2, vy: -Math.random() * 2.5, g: 0.15, c: i % 3 ? '#6b3a1c' : '#c8915a', s: Math.random() < 0.3 ? 2 : 1, life: 30 + Math.random() * 20 });
      }
    }
  };
  root.KV = KV;
})(window);
