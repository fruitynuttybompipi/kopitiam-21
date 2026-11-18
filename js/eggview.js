/* Kopitiam 21 — Cari Telur view: pink kopitiam bowls on the marble table, an egg, and a fast shuffle. */
(function (root) {
  'use strict';
  const { EGG, SPR, AU } = root;
  const EV = {};
  let cv, cx, S = 3, W = 0, H = 0, st = null, meId = null, onPick = null, visible = false;
  let placeKey = null, placeT0 = 0, shufKey = null, shufT0 = 0, revealKey = null, revealT0 = 0;
  let myPick = null, pickKey = null, hover = -1;
  const sparks = [];
  let lastStepSound = -1;

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 3 : 4) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    return true;
  }
  function geo(n) {
    const tableY = Math.round(H * 0.66);
    const spacing = Math.min((W * 0.92) / n, 56);
    const bw = Math.round(Math.min(spacing * 0.84, 46, H * 0.19)), bh = Math.round(bw * 0.62);
    const x = i => Math.round(W / 2 + (i - (n - 1) / 2) * spacing);
    return { tableY, spacing, bw, bh, x };
  }

  // where every bowl is at time `ms` into the shuffle
  function bowlsAt(sc, ms) {
    const g = geo(sc.n);
    const slotOf = [...Array(sc.n).keys()]; // bowl id -> slot
    const pos = slotOf.map(s => ({ x: g.x(s), y: 0, front: 0 }));
    let t = 0, idx = -1;
    for (let i = 0; i < sc.steps.length; i++) {
      const s = sc.steps[i], d = s.ms + 40;
      if (ms < t + d) {
        idx = i;
        const k = Math.min(1, (ms - t) / s.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (s.k === 'pause') break;
        const ba = slotOf.indexOf(s.a), bb = slotOf.indexOf(s.b);
        const xa = g.x(s.a), xb = g.x(s.b);
        if (s.k === 'fake') {
          const f = Math.sin(Math.PI * Math.min(1, k)) * 0.4;
          pos[ba].x = xa + (xb - xa) * f; pos[bb].x = xb + (xa - xb) * f;
        } else {
          pos[ba].x = xa + (xb - xa) * e; pos[bb].x = xb + (xa - xb) * e;
          if (s.arc) { pos[ba].y = -Math.sin(Math.PI * e) * g.bh * 1.1; pos[ba].front = 1; }
          else { pos[ba].y = Math.sin(Math.PI * e) * 2; pos[ba].front = 1; pos[bb].y = -Math.sin(Math.PI * e) * 2; }
        }
        break;
      }
      if (s.k === 'swap') { const ba = slotOf.indexOf(s.a), bb = slotOf.indexOf(s.b); slotOf[ba] = s.b; slotOf[bb] = s.a; pos[ba].x = g.x(s.b); pos[bb].x = g.x(s.a); }
      t += d;
    }
    return { pos, slotOf, idx, done: idx === -1 };
  }
  function endSlot(sc) { const slotOf = [...Array(sc.n).keys()]; for (const s of sc.steps) if (s.k === 'swap') { const ba = slotOf.indexOf(s.a), bb = slotOf.indexOf(s.b); slotOf[ba] = s.b; slotOf[bb] = s.a; } return slotOf[sc.start]; }

  function drawBowl(x, baseY, bw, bh, lift, hi) {
    const y0 = Math.round(baseY - lift);
    // shadow on the table
    const sw = Math.round(bw * (0.9 - Math.min(0.4, lift / 80)));
    cx.fillStyle = 'rgba(42,26,18,.22)'; cx.fillRect(Math.round(x - sw / 2), baseY - 1, sw, 3);
    for (let dy = 0; dy < bh; dy++) {
      const k = dy / bh; // 0 top .. 1 rim
      const hw = (bw / 2) * Math.sqrt(Math.min(1, 0.18 + k * 1.1));
      const yy = y0 - bh + dy;
      cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(x - hw) - 1, yy, Math.round(hw * 2) + 2, 1);
      const rim = k > 0.84;
      cx.fillStyle = rim ? '#fbd0e0' : (hi ? '#ffa8c8' : '#f58ab0');
      cx.fillRect(Math.round(x - hw), yy, Math.round(hw * 2), 1);
      if (!rim) { cx.fillStyle = 'rgba(255,255,255,.55)'; cx.fillRect(Math.round(x - hw * 0.62), yy, 1, 1); }
    }
    // foot ring on top + little flowers
    cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(x - bw * 0.2) - 1, y0 - bh - 2, Math.round(bw * 0.4) + 2, 3);
    cx.fillStyle = '#e46a98'; cx.fillRect(Math.round(x - bw * 0.2), y0 - bh - 1, Math.round(bw * 0.4), 1);
    cx.fillStyle = '#fff';
    for (const fx of [-0.22, 0.12, 0.3]) { const px = Math.round(x + fx * bw), py = Math.round(y0 - bh * 0.45 + fx * 4); cx.fillRect(px, py, 1, 1); cx.fillRect(px - 1, py + 1, 3, 1); cx.fillRect(px, py + 2, 1, 1); }
    cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(x - bw / 2) - 1, y0 - 1, bw + 2, 1);
  }
  function drawEgg(x, baseY, bw) {
    const rx = Math.max(3, Math.round(bw * 0.17)), ry = Math.round(rx * 1.3);
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2);
      cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(x - hw) - 1, baseY - ry - 1 + dy, Math.round(hw * 2) + 2, 1);
      cx.fillStyle = dy > ry * 0.3 ? '#c98a56' : '#e8b07a'; cx.fillRect(Math.round(x - hw), baseY - ry - 1 + dy, Math.round(hw * 2), 1);
    }
    cx.fillStyle = '#fbe0bc'; cx.fillRect(Math.round(x - rx * 0.4), baseY - ry * 2, 2, 2);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !st || document.hidden || !layout()) return;
    cx.clearRect(0, 0, W, H);
    const sc = st.script;
    // table
    const n = sc ? sc.n : 3, g = geo(n);
    cx.fillStyle = '#e9e5dc'; cx.fillRect(0, g.tableY, W, 6);
    cx.fillStyle = '#d6d1c6'; cx.fillRect(0, g.tableY + 6, W, 2);
    cx.fillStyle = '#7a4a2a'; cx.fillRect(0, g.tableY + 8, W, H);
    cx.fillStyle = '#5a361f'; for (let x = 0; x < W; x += 22) cx.fillRect(x, g.tableY + 10, 1, H);
    cx.fillStyle = '#2a1a12'; cx.fillRect(0, g.tableY + 8, W, 1);
    const baseY = g.tableY + 4;
    if (!sc) {
      // lobby: three idle bowls
      const g3 = geo(3);
      for (let i = 0; i < 3; i++) drawBowl(g3.x(i), baseY, g3.bw, g3.bh, Math.abs(Math.sin(now / 400 + i)) * 3, false);
      return;
    }
    const ph = st.phase;
    let pos, lift = 0, eggSlot = null, showEgg = false, eggBowl = sc.start;
    if (ph === 'place') {
      if (placeKey !== sc.id) { placeKey = sc.id; placeT0 = now; myPick = null; }
      const k = (now - placeT0) / EGG.PLACE_MS;
      lift = k < 0.45 ? g.bh * 1.3 : Math.max(0, g.bh * 1.3 * (1 - (k - 0.45) / 0.25));
      pos = [...Array(n).keys()].map(i => ({ x: g.x(i), y: 0 }));
      showEgg = true; eggSlot = sc.start;
      if (k > 0.68 && k < 0.72) AU.play('pop');
    } else if (ph === 'shuffle') {
      if (shufKey !== sc.id) { shufKey = sc.id; shufT0 = now; lastStepSound = -1; }
      const b = bowlsAt(sc, now - shufT0);
      pos = b.pos;
      if (b.idx !== lastStepSound && b.idx >= 0) { lastStepSound = b.idx; AU.play(sc.steps[b.idx].k === 'pause' ? 'tick' : 'whoosh'); }
    } else {
      const b = bowlsAt(sc, 1e9);
      pos = b.pos;
      if (ph === 'reveal') {
        if (revealKey !== sc.id) { revealKey = sc.id; revealT0 = now; for (let i = 0; i < 18; i++) sparks.push({ t0: now + i * 30 }); }
        lift = Math.min(1, (now - revealT0) / 350) * g.bh * 1.1;
        showEgg = true; eggSlot = st.result ? st.result.slot : endSlot(sc);
      }
    }
    if (showEgg && eggSlot != null) drawEgg(g.x(eggSlot), baseY, g.bw);
    // draw bowls back-to-front (the one crossing in front last)
    const order = pos.map((p, i) => i).sort((a, b) => (pos[a].front || 0) - (pos[b].front || 0));
    for (const i of order) {
      const p = pos[i];
      const slotNow = Math.round((p.x - g.x(0)) / g.spacing);
      const hi = ph === 'pick' && (slotNow === hover || slotNow === myPick);
      drawBowl(p.x, baseY + Math.round(p.y > 0 ? p.y : 0), g.bw, g.bh, lift + (p.y < 0 ? -p.y : 0), hi);
    }
    // my pick arrow
    if ((ph === 'pick' || ph === 'reveal') && myPick != null && pickKey === sc.id) {
      const x = g.x(myPick), y = baseY - g.bh - 10 - lift + Math.round(Math.sin(now / 150) * 2);
      cx.fillStyle = '#2a1a12'; cx.fillRect(x - 4, y - 1, 9, 6);
      cx.fillStyle = '#f6c744'; cx.fillRect(x - 3, y, 7, 2); cx.fillRect(x - 2, y + 2, 5, 1); cx.fillRect(x - 1, y + 3, 3, 1); cx.fillRect(x, y + 4, 1, 1);
    }
    // everyone's picks at the reveal
    if (ph === 'reveal' && st.result) {
      const per = {};
      for (const [pid, slot] of Object.entries(st.result.picks)) (per[slot] = per[slot] || []).push(pid);
      for (const [slot, pids] of Object.entries(per)) {
        pids.forEach((pid, i) => {
          const p = st.players.find(x => x.id === pid); if (!p) return;
          const img = avatar(p.avatar), sz = 16;
          const x = g.x(+slot) - sz / 2 + (i - (pids.length - 1) / 2) * (sz + 2);
          cx.drawImage(img, Math.round(x), Math.round(baseY + 12), sz, sz);
        });
      }
      // sparkle around the egg
      const ex = g.x(st.result.slot);
      for (const s of sparks) {
        const k = (now - s.t0) / 700; if (k < 0 || k > 1) continue;
        const a = (s.t0 % 360) / 57.3;
        cx.fillStyle = k < 0.5 ? '#fff6b8' : '#f6c744';
        cx.fillRect(Math.round(ex + Math.cos(a) * (6 + k * 18)), Math.round(baseY - 8 + Math.sin(a) * (4 + k * 10)), 1, 1);
      }
      if (now - revealT0 > 900) sparks.length = 0;
    }
  }
  const avCache = {};
  function avatar(id) { if (avCache[id]) return avCache[id]; const c = document.createElement('canvas'); c.width = 16; c.height = 16; SPR.drawGrid(c.getContext('2d'), SPR.avatarRows(id), SPR.AVATARS[id].pal, 0, 0, 1); return (avCache[id] = c); }

  function slotAt(e) {
    if (!st || !st.script) return -1;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / S;
    const g = geo(st.script.n);
    let best = -1, bd = 1e9;
    for (let i = 0; i < st.script.n; i++) { const d = Math.abs(g.x(i) - x); if (d < bd) { bd = d; best = i; } }
    return bd <= g.spacing / 2 ? best : -1;
  }
  function canPick() { return st && st.phase === 'pick' && myPick == null && st.players.some(p => p.id === meId && p.inGame); }

  EV.mount = function (canvas, h) {
    cv = canvas; cx = cv.getContext('2d'); onPick = h.onPick;
    cv.addEventListener('pointerdown', e => {
      if (!canPick()) return;
      const s = slotAt(e); if (s < 0) return;
      e.preventDefault();
      myPick = s; pickKey = st.script.id;
      AU.play('chip');
      onPick && onPick(s);
    });
    cv.addEventListener('pointermove', e => { hover = canPick() ? slotAt(e) : -1; });
    cv.addEventListener('pointerleave', () => { hover = -1; });
    requestAnimationFrame(frame);
  };
  EV.show = function (on) { visible = on; if (!on) { st = null; placeKey = shufKey = revealKey = null; myPick = null; } };
  EV.render = function (s, me) { st = s; meId = me; if (s.phase === 'place' || s.phase === 'lobby' || s.phase === 'over') { if (pickKey !== (s.script && s.script.id)) myPick = null; } };
  EV.myPick = () => myPick;
  root.EV = EV;
})(window);
