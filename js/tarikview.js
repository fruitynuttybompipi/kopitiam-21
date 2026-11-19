/* Kopitiam 21 — Tarik Teh view: two stainless mugs, a swaying stream of teh, a height ruler and a lot of buih.
   My own pull runs here at full frame rate and streams frames to the host; everyone else replays the frames. */
(function (root) {
  'use strict';
  const { TARIK, AU } = root;
  const P = TARIK.P;
  const TV = {};
  let cv, cx, S = 3, W = 0, H = 0;
  let st = null, meId = null, visible = false, onFrame = null;
  let local = null;            // my pull
  let target = 0, keyDir = 0;  // where my bottom mug wants to be (-1..1)
  let view = { h: 0, m: 0, l: 0, tea: 1, fr: 0, sp: 0, a: false };  // what is drawn
  let liveAt = 0, liveKey = '';
  let puddle = 0, lastTurn = -1;
  let pop = null;              // floating "+87" / TUMPAH text
  let pose = 0;                // 0 = top mug resting, 1 = tipped and pouring
  const parts = [];
  let lastNow = 0;

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 3 : 4) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    return true;
  }
  function geo() {
    const tableY = Math.round(H * 0.85);
    const R = Math.round(Math.min(W * (W < 200 ? 0.27 : 0.3), H * 0.32));
    const cx0 = Math.round(W * 0.5);
    const mw = Math.max(12, Math.round(R * P.MUG * 2) + 4), mh = Math.round(mw * 1.2);
    const mugBot = tableY - 3, mugTop = mugBot - mh;
    // keep the raised mug mostly clear of the player cards
    const kq = cv.parentElement && cv.parentElement.querySelector('.kq');
    const cards = kq ? Math.ceil((kq.offsetTop + kq.offsetHeight) * UIZ.z / S) : 0;
    const topMin = Math.round(Math.max(30, H * 0.2, cards + mh * 0.6));
    return { tableY, R, cx0, mw, mh, mugBot, mugTop, topMin, span: Math.max(20, mugTop - 6 - topMin) };
  }

  // ---------- my pull ----------
  function mine() { return !!(st && st.phase === 'tarik' && st.turn && st.turn.pid === meId); }
  function stepLocal(dt, now) {
    target = Math.max(-1, Math.min(1, target + keyDir * dt * 2.6));
    if (!local) return;
    const tr = st && st.turn;
    if (!tr || tr.id !== local.turnId) { stopPour(); local = null; return; }
    if (!local.active) return;
    local.t += dt;
    local.h = Math.min(1, local.h + P.RISE * dt);
    local.tea = Math.max(0, local.tea - P.DRAIN * dt);
    local.l = P.land(local.t, local.h, local.seed);
    local.m += (target - local.m) * Math.min(1, dt * 18);
    local.miss = Math.abs(local.l - local.m) > P.MUG;
    if (local.miss) local.sp += P.DRAIN * dt; else local.fr += P.rate(local.h) * dt;
    if (local.tea <= 0 || local.sp >= P.TUMPAH) { finishLocal(); return; }
    if (now - local.lastSend > 100) { local.lastSend = now; send(false); }
    if (TV.onLocal) TV.onLocal(local);
  }
  function send(done) {
    if (!local || !onFrame) return;
    const L = local;
    onFrame({ t: 'tt', id: L.turnId, tm: +L.t.toFixed(3), h: +L.h.toFixed(3), m: +L.m.toFixed(3), l: +L.l.toFixed(3), tea: +L.tea.toFixed(3), fr: Math.round(L.fr), sp: +L.sp.toFixed(3), a: L.active, miss: !!L.miss, done, tumpah: L.sp >= P.TUMPAH, perfect: L.tea <= 0 && L.sp < 0.05 });
  }
  function finishLocal() {
    if (!local || !local.active) return;
    local.active = false; local.done = true;
    stopPour();
    send(true);
    if (TV.onLocal) TV.onLocal(local);
  }
  function stopPour() { AU.pour && AU.pour(false); }

  TV.press = function () {
    if (!mine()) return;
    const tr = st.turn;
    if (local && local.turnId === tr.id) return; // one pull per turn
    local = { turnId: tr.id, seed: tr.seed || 0, t: 0, h: 0, tea: 1, fr: 0, sp: 0, m: view.m, l: 0, miss: false, active: true, lastSend: 0 };
    AU.unlock(); AU.pour && AU.pour(true);
    send(false);
  };
  TV.release = function () { if (local && local.active) finishLocal(); };
  TV.isMine = mine;
  TV.started = () => !!(local && st && st.turn && local.turnId === st.turn.id);
  TV.key = function (dir) { keyDir = dir; };

  // ---------- drawing ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now;
    stepLocal(dt, now);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    const t = now / 1000;
    const g = geo();
    const tr = st.turn;
    if (tr && tr.id !== lastTurn) { lastTurn = tr.id; puddle = 0; parts.length = 0; pop = null; }

    // what to show: my pull, someone else's live frames, or idle
    let want;
    const myLocal = local && tr && local.turnId === tr.id;
    if (myLocal) want = local;
    else if (st.live && tr && st.live.id === tr.id) {
      const L = st.live, key = L.id + ':' + L.tm;
      if (key !== liveKey) { liveKey = key; liveAt = now; }
      const tm = L.a ? L.tm + Math.min(0.25, (now - liveAt) / 1000) : L.tm;
      want = { h: L.h, m: L.m, l: L.a ? P.land(tm, L.h, tr.seed || 0) : L.l, tea: L.tea, fr: L.fr, sp: L.sp, active: L.a, miss: L.miss };
    } else want = { h: 0, m: mine() ? target : 0, l: 0, tea: 1, fr: 0, sp: 0, active: false };
    const k = myLocal ? 1 : Math.min(1, dt * 12);
    const done = !want.active && (want.fr > 0 || want.sp > 0);
    view.h += ((done ? 0 : want.h) - view.h) * (want.active ? k : Math.min(1, dt * 4));
    view.m += (want.m - view.m) * k;
    view.l += (want.l - view.l) * (myLocal ? 1 : Math.min(1, dt * 20));
    view.tea = want.tea; view.fr = want.fr; view.sp = want.sp; view.a = want.active;
    if (!want.active && !done && !myLocal) view.m += ((mine() ? target : 0) - view.m) * Math.min(1, dt * 14);

    cx.clearRect(0, 0, W, H);
    // table
    cx.fillStyle = '#e9e5dc'; cx.fillRect(0, g.tableY, W, 5);
    cx.fillStyle = '#d6d1c6'; cx.fillRect(0, g.tableY + 5, W, 2);
    cx.fillStyle = '#7a4a2a'; cx.fillRect(0, g.tableY + 7, W, H - g.tableY - 7);
    cx.fillStyle = '#5a361f'; for (let x = 0; x < W; x += 22) cx.fillRect(x, g.tableY + 9, 1, H);
    cx.fillStyle = '#2a1a12'; cx.fillRect(0, g.tableY + 7, W, 1);
    // puddle of spilled teh
    if (view.a && want.miss) puddle = Math.min(1, puddle + dt * 0.5);
    if (puddle > 0) {
      const pw = Math.round(g.R * (0.3 + puddle * 1.2));
      for (let dy = 0; dy < 3; dy++) { const hw = pw * (dy === 1 ? 1 : 0.8); cx.fillStyle = dy ? '#b07a44' : '#c98a4a'; cx.fillRect(Math.round(g.cx0 - hw), g.tableY + dy, Math.round(hw * 2), 1); }
    }

    ruler(g, t);
    counter(g, t);

    // bottom mug
    const mx = Math.round(g.cx0 + view.m * g.R);
    drawMug(mx, g.mugTop, g.mw, g.mh, 0);
    // tea + buih inside
    const caught = Math.max(0, 1 - view.tea - view.sp);
    const innerTop = g.mugTop + 2, innerBot = g.mugBot - 2, innerH = innerBot - innerTop;
    const lvl = Math.round(innerH * 0.72 * Math.min(1, caught));
    const froth = Math.min(innerH * 0.5, Math.round(view.fr / P.MAXPTS * innerH * 0.55) + (caught > 0.02 ? 1 : 0));
    const surf = innerBot - lvl - froth;
    if (lvl > 0) { cx.fillStyle = '#b8723a'; cx.fillRect(mx - g.mw / 2 + 2, innerBot - lvl, g.mw - 4, lvl); }
    if (froth > 0) {
      cx.fillStyle = '#f1dcb4'; cx.fillRect(mx - g.mw / 2 + 2, Math.round(surf), g.mw - 4, Math.round(froth));
      cx.fillStyle = '#fff3d8'; for (let i = 0; i < g.mw - 6; i += 3) cx.fillRect(mx - g.mw / 2 + 3 + i, Math.round(surf) + ((i + Math.floor(t * 6)) % 2), 1, 1);
    }
    // buih dome over the rim when it's really frothy
    if (view.fr > 90 && surf <= g.mugTop + 3) {
      const dome = Math.min(5, Math.round((view.fr - 90) / 14) + 1), hw0 = g.mw / 2 - 1;
      for (let dy = 0; dy < dome; dy++) { const hw = hw0 * Math.sqrt(1 - Math.pow((dy + 1) / (dome + 1), 2)); cx.fillStyle = dy === dome - 1 ? '#fff3d8' : '#f1dcb4'; cx.fillRect(Math.round(mx - hw), g.mugTop - dy - 1, Math.round(hw * 2), 1); }
    }

    // top mug + stream: idle it rests upright beside the bottom mug; pouring it tips over and rises
    const pouring = view.a;
    pose += ((pouring ? 1 : 0) - pose) * Math.min(1, dt * (pouring ? 10 : 4));
    const ang = 1.9 * pose, c = Math.cos(-ang), sn = Math.sin(-ang);
    const offX = -g.mw * c + g.mh * sn, offY = -g.mw * sn - g.mh * c;   // rim corner relative to the pivot
    const rimX = g.cx0 + g.R * 0.15 + g.mw * 0.2, rimY = g.mugTop - 5 - view.h * g.span;
    const idleX = mx + g.mw * 1.7 + 4, idleY = g.mugBot - 4;
    const pvX = idleX + ((rimX - offX) - idleX) * pose, pvY = idleY + ((rimY - offY) - idleY) * pose;
    const lip = drawTopMug(pvX, pvY, g.mw, g.mh, ang, view.tea);
    if (pouring) {
      const lx = g.cx0 + view.l * g.R;
      const hit = Math.abs(view.l - view.m) <= P.MUG;
      const ye = hit ? Math.max(g.mugTop - 2, Math.round(surf)) : g.tableY;
      const thick = view.tea > 0.05 ? 2 : 1;
      for (let y = Math.round(lip.y); y < ye; y++) {
        const kk = (y - lip.y) / Math.max(1, ye - lip.y);
        const x = Math.round(lip.x + (lx - lip.x) * Math.pow(kk, 0.75) + Math.sin(t * 22 + y * 0.5) * 0.5);
        cx.fillStyle = (y + Math.floor(t * 40)) % 6 ? '#c98a4a' : '#e8b880';
        cx.fillRect(x, y, thick, 1);
      }
      // splash: buih when it lands in the mug, drops when it hits the table
      if (Math.random() < 0.7) parts.push({ x: lx + (Math.random() - 0.5) * 3, y: ye - 1, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * (hit ? 0.9 : 1.6), g: 0.12, c: hit ? (Math.random() < 0.5 ? '#fff3d8' : '#f1dcb4') : '#c98a4a', s: 1, life: hit ? 8 : 14 });
    }


    // floating result
    if (st.phase === 'result' && st.last && !st.last.tumpah && (!pop || pop.turn !== (tr && tr.id))) pop = { turn: tr && tr.id, at: now, text: st.last.tumpah ? 'TUMPAH!' : st.last.why ? (st.last.why === 'slow' ? 'TIDUR KE?' : 'OFFLINE') : '+' + st.last.pts, bad: st.last.tumpah || !!st.last.why };
    if (pop && st.phase === 'result') {
      const a = Math.min(1, (now - pop.at) / 1600), sc = W > 240 ? 3 : 2;
      const tx = Math.round(mx - root.Scene.tw(pop.text, sc) / 2), ty = Math.round(g.mugTop - 14 - a * 14);
      cx.globalAlpha = a < 0.8 ? 1 : (1 - a) * 5;
      root.Scene.ptext(cx, pop.text, tx + 1, ty + 1, '#2a1a12', sc);
      root.Scene.ptext(cx, pop.text, tx, ty, pop.bad ? '#ff6b5b' : '#f6c744', sc);
      cx.globalAlpha = 1;
    }

    // steam
    if (caught > 0.1 && Math.random() < 0.25) parts.push({ x: mx + (Math.random() - 0.5) * g.mw * 0.6, y: g.mugTop - 2, vx: (Math.random() - 0.5) * 0.15, vy: -0.25, g: 0, c: 'rgba(255,255,255,.55)', s: 1, life: 26 });
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.vy += q.g; q.x += q.vx; q.y += q.vy; q.life--;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      cx.fillStyle = q.c; cx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
  }

  // stainless "mug tarik": tall can with a rolled rim and a side handle
  function drawMug(x, top, w, h, sh) {
    const l = Math.round(x - w / 2);
    cx.fillStyle = '#2a1a12'; cx.fillRect(l - 1, top - 1, w + 2, h + 2);
    cx.fillStyle = '#c9ced6'; cx.fillRect(l, top, w, h);
    cx.fillStyle = '#9aa1ab'; cx.fillRect(l + w - Math.max(2, Math.round(w * 0.25)), top, Math.max(2, Math.round(w * 0.25)), h);
    cx.fillStyle = '#eef1f4'; cx.fillRect(l + 2, top + 2, Math.max(1, Math.round(w * 0.12)), h - 4);
    cx.fillStyle = '#7d848e'; cx.fillRect(l, top + h - 2, w, 2); cx.fillRect(l, top, w, 1);
    // dark inside when looking from above the rim
    cx.fillStyle = '#5a5f66'; cx.fillRect(l + 1, top + 1, w - 2, 1);
    // handle on the left
    const hy = top + Math.round(h * 0.25), hh = Math.round(h * 0.5), hw = Math.max(3, Math.round(w * 0.25));
    cx.fillStyle = '#2a1a12'; cx.fillRect(l - hw - 1, hy - 1, hw + 1, 3); cx.fillRect(l - hw - 1, hy + hh - 2, hw + 1, 3); cx.fillRect(l - hw - 1, hy - 1, 3, hh + 2);
    cx.fillStyle = '#9aa1ab'; cx.fillRect(l - hw, hy, hw, 1); cx.fillRect(l - hw, hy + hh - 1, hw, 1); cx.fillRect(l - hw, hy, 1, hh);
  }
  // top mug, rotated about its bottom-right corner (px, py); returns where the stream leaves the rim
  function drawTopMug(px, py, w, h, ang, tea) {
    cx.save();
    cx.translate(Math.round(px), Math.round(py));
    cx.rotate(-ang);
    const R = (rx, ry, rw, rh, c) => { cx.fillStyle = c; cx.fillRect(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh))); };
    R(-w - 1, -h - 1, w + 2, h + 2, '#2a1a12');
    R(-w, -h, w, h, '#c9ced6');
    R(-w + 2, -h + 2, Math.max(1, w * 0.12), h - 4, '#eef1f4');
    R(-Math.max(2, w * 0.25), -h, Math.max(2, w * 0.25), h, '#9aa1ab');
    R(-w, -2, w, 2, '#7d848e');
    // handle (right side)
    const hy = -h + h * 0.25, hh = h * 0.5, hw = Math.max(3, w * 0.25);
    R(0, hy - 1, hw + 1, 3, '#2a1a12'); R(0, hy + hh - 2, hw + 1, 3, '#2a1a12'); R(hw - 2, hy - 1, 3, hh + 2, '#2a1a12');
    R(0, hy, hw - 1, 1, '#9aa1ab'); R(0, hy + hh - 1, hw - 1, 1, '#9aa1ab'); R(hw - 1, hy, 1, hh, '#9aa1ab');
    // teh peeking at the rim while upright
    if (ang < 0.2 && tea > 0.05) R(-w + 1, -h + 1, w - 2, 1, '#c98a4a');
    cx.restore();
    // rim corner (top-left of the mug) after rotation
    const lx = -w, ly = -h, c = Math.cos(-ang), s = Math.sin(-ang);
    return { x: px + lx * c - ly * s, y: py + lx * s + ly * c };
  }

  function panel(x, y, w, h) {
    cx.fillStyle = '#2a1a12'; cx.fillRect(x - 1, y - 1, w + 2, h + 2);
    cx.fillStyle = '#fbf3dc'; cx.fillRect(x, y, w, h);
    cx.fillStyle = '#e8dcbc'; cx.fillRect(x, y + h - 1, w, 1);
  }
  function ruler(g, t) {
    const y0 = g.mugTop - 5, y1 = y0 - g.span;
    const x = Math.max(9, Math.round(g.cx0 - g.R - g.mw / 2 - 44));
    panel(x - 7, y1 - 5, 40, y0 - y1 + 10);
    cx.fillStyle = '#2a1a12'; cx.fillRect(x, y1 - 1, 4, y0 - y1 + 2);
    const segs = [['#7cff9a', 0.25], ['#c9e26a', 0.5], ['#f6c744', 0.75], ['#ff6b5b', 1]];
    let prev = 0;
    for (const [c, h] of segs) { cx.fillStyle = c; cx.fillRect(x + 1, Math.round(y0 - h * g.span), 2, Math.round((h - prev) * g.span)); prev = h; }
    const labels = [['OK', 0.25], ['TINGGI', 0.5], ['PRO', 0.75], ['GILA!', 1]];
    for (const [s, h] of labels) { const yy = Math.round(y0 - h * g.span); cx.fillStyle = '#2a1a12'; cx.fillRect(x + 4, yy, 2, 1); root.Scene.ptext(cx, s, x + 7, yy - 2, h >= 1 ? '#c0392b' : '#4a3020'); }
    // marker
    const my = Math.round(y0 - view.h * g.span);
    cx.fillStyle = '#2a1a12'; cx.fillRect(x - 5, my - 2, 4, 5);
    cx.fillStyle = view.a && Math.floor(t * 8) % 2 ? '#fff3d8' : '#f6c744'; cx.fillRect(x - 4, my - 1, 2, 3); cx.fillRect(x - 2, my, 1, 1);
  }

  function counter(g, t) {
    const sc = W > 240 ? 2 : 1;
    const bw = Math.max(48, root.Scene.tw('000', sc * 2) + 20);
    const x = Math.round(Math.min(W - bw - 6, g.cx0 + g.R + g.mw / 2 + 14));
    const y = Math.round(Math.min(g.topMin + 2, g.mugTop - 5 - g.span * 0.5));
    panel(x - 4, y - 4, bw + 8, 18 + 10 * sc + 4);
    root.Scene.ptext(cx, 'BUIH', x, y, '#4a3020', 1);
    const num = String(Math.round(view.fr));
    root.Scene.ptext(cx, num, x + bw - root.Scene.tw(num, sc * 2), y, view.fr >= 90 ? '#c0392b' : '#2a1a12', sc * 2);
    // teh left in the top mug
    const by = y + 10 * sc + 2;
    root.Scene.ptext(cx, 'TEH', x, by, '#4a3020', 1);
    cx.fillStyle = '#2a1a12'; cx.fillRect(x + 14, by - 1, bw - 14, 7);
    cx.fillStyle = '#e9e5dc'; cx.fillRect(x + 15, by, bw - 16, 5);
    cx.fillStyle = '#c98a4a'; cx.fillRect(x + 15, by, Math.round((bw - 16) * view.tea), 5);
    // spill meter fills toward TUMPAH
    const sy = by + 8;
    root.Scene.ptext(cx, 'TUMPAH', x, sy, '#4a3020', 1);
    const sx = x + 26, sw = Math.max(10, bw - 26);
    cx.fillStyle = '#2a1a12'; cx.fillRect(sx, sy - 1, sw, 7);
    cx.fillStyle = '#e9e5dc'; cx.fillRect(sx + 1, sy, sw - 2, 5);
    const k = Math.min(1, view.sp / P.TUMPAH);
    cx.fillStyle = k > 0.6 && Math.floor(t * 10) % 2 ? '#ff6b5b' : '#c0392b'; cx.fillRect(sx + 1, sy, Math.round((sw - 2) * k), 5);
  }

  // ---------- input ----------
  function pointerX(e) {
    const r = cv.getBoundingClientRect(), g = geo();
    const lx = (e.clientX - r.left) / S;
    return Math.max(-1, Math.min(1, (lx - g.cx0) / g.R));
  }
  TV.mount = function (canvas, handlers) {
    cv = canvas; cx = cv.getContext('2d');
    onFrame = handlers.onFrame;
    cv.addEventListener('pointerdown', e => {
      if (!mine()) return;
      e.preventDefault(); cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      target = pointerX(e);
      TV.press();
    });
    cv.addEventListener('pointermove', e => { if (mine() && W) target = pointerX(e); });
    cv.addEventListener('pointerup', () => TV.release());
    cv.addEventListener('pointercancel', () => TV.release());
    requestAnimationFrame(frame);
  };
  TV.show = function (on) { visible = on; if (!on) { st = null; local = null; parts.length = 0; pop = null; stopPour(); } };
  TV.render = function (s, me) {
    meId = me; st = s;
    const tr = s.turn;
    if (local && (!tr || local.turnId !== tr.id)) { if (local.active) stopPour(); local = null; }
    if (!local) AU.pour && AU.pour(!!(s.phase === 'tarik' && s.live && tr && s.live.id === tr.id && s.live.a));
  };
  TV.fx = function (f) {
    if (f.type === 'tumpah') {
      AU.pour && AU.pour(false); AU.play('splash'); AU.play('bust');
      puddle = 1;
      if (layout()) { const g = geo(); for (let i = 0; i < 30; i++) parts.push({ x: g.cx0 + (Math.random() - 0.5) * g.R, y: g.tableY - 1, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2.2, g: 0.15, c: i % 3 ? '#c98a4a' : '#e8b880', s: Math.random() < 0.3 ? 2 : 1, life: 30 }); }
    }
    if (f.type === 'score') { AU.play(f.perfect ? 'tada' : 'coin'); }
  };
  root.TV = TV;
})(window);
