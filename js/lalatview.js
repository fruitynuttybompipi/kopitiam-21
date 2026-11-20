/* Kopitiam 21 — Lalat Hunt view: a marble kopitiam table seen from above, plates, kopi, the cat,
   and lots of lalat. Tap a landed fly to swat it with your selipar. */
(function (root) {
  'use strict';
  const { LALAT, SPR, AU } = root;
  const LV = {};
  let cv, cx, S = 3, W = 0, H = 0;
  let st = null, meId = null, visible = false, onSwat = null;
  let offs = null, offsAt = 0;          // host clock - local clock
  const flyCache = {};                  // fkey -> flies
  let geo = null, marble = null, marbleKey = '';
  const marks = [];                     // splats + cracks, per round
  const slaps = [];                     // selipar animations
  const pops = [];                      // "+10" texts
  let markKey = '', cool = 0, stun = 0;
  let lastBuzz = 0;

  const hostNow = () => Date.now() + (offs || 0);
  function syncClock(s) {
    if (typeof s.clock !== 'number') return;
    const o = s.clock - Date.now();
    // the smallest lag wins; let it drift back slowly in case clocks move
    if (offs === null || o > offs || Date.now() - offsAt > 8000) { offs = o; offsAt = Date.now(); }
  }
  function view() {
    if (!st) return null;
    const flies = st.flies || flyCache[st.fkey] || [];
    return Object.assign({}, st, { flies });
  }
  const colOf = pid => { const p = st && st.players.find(x => x.id === pid); return p ? p.col : '#fff'; };

  // ---------- geometry ----------
  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    S = Math.round((r.width / UIZ.z < 640 ? 3 : 4) * UIZ.z);
    const w = Math.ceil(r.width / S), h = Math.ceil(r.height / S);
    if (w !== W || h !== H) { W = w; H = h; cv.width = W; cv.height = H; }
    const kq = cv.parentElement.querySelector('.kq');
    const top = kq ? Math.ceil((kq.offsetTop + kq.offsetHeight) * UIZ.z / S) + 4 : 4;
    const aw = W - 8, ah = H - top - 6;
    const rot = ah > aw * 1.05;                 // tall phone: turn the table sideways
    const tw = rot ? LALAT.TH : LALAT.TW, th = rot ? LALAT.TW : LALAT.TH;
    const k = Math.floor(Math.min((aw - 8) / tw, (ah - 8) / th));
    const pw = Math.round(tw * k), ph = Math.round(th * k);
    geo = { rot, k, ox: Math.round((W - pw) / 2), oy: Math.round(top + (ah - ph) / 2), pw, ph };
    return true;
  }
  function toS(x, y) { const g = geo; return g.rot ? [g.ox + (LALAT.TH - y) * g.k, g.oy + x * g.k] : [g.ox + x * g.k, g.oy + y * g.k]; }
  function fromS(px, py) { const g = geo; return g.rot ? [(py - g.oy) / g.k, LALAT.TH - (px - g.ox) / g.k] : [(px - g.ox) / g.k, (py - g.oy) / g.k]; }

  // ---------- drawing helpers ----------
  function disc(c, x, y, r, col) {
    c.fillStyle = col;
    for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
      const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      c.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2 + 1, 1);
    }
  }
  function drawMarble() {
    const key = geo.pw + 'x' + geo.ph;
    if (key === marbleKey) return;
    marbleKey = key;
    marble = document.createElement('canvas'); marble.width = geo.pw + 8; marble.height = geo.ph + 8;
    const g = marble.getContext('2d');
    g.fillStyle = '#2a1a12'; g.fillRect(0, 0, geo.pw + 8, geo.ph + 8);
    g.fillStyle = '#6b4226'; g.fillRect(1, 1, geo.pw + 6, geo.ph + 6);
    g.fillStyle = '#8a5a34'; g.fillRect(1, 1, geo.pw + 6, 2);
    g.fillStyle = '#ece8df'; g.fillRect(4, 4, geo.pw, geo.ph);
    // grey veins
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let v = 0; v < Math.max(4, geo.pw * geo.ph / 2500); v++) {
      let x = 4 + rnd() * geo.pw, y = 4 + rnd() * geo.ph, a = rnd() * Math.PI * 2;
      for (let i = 0; i < 40 + rnd() * 60; i++) {
        a += (rnd() - 0.5) * 0.6; x += Math.cos(a); y += Math.sin(a);
        if (x < 4 || y < 4 || x > geo.pw + 3 || y > geo.ph + 3) break;
        g.fillStyle = rnd() < 0.7 ? '#d6d1c6' : '#c9c3b6'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    g.fillStyle = '#fbf8f0'; g.fillRect(4, 4, geo.pw, 1);
  }
  const FOOD = {
    nasilemak: (x, y, r) => { disc(cx, x - r * 0.15, y, r * 0.45, '#fbfbf4'); disc(cx, x + r * 0.35, y - r * 0.25, r * 0.22, '#c0392b'); disc(cx, x + r * 0.3, y + r * 0.35, r * 0.2, '#f2b81e'); cx.fillStyle = '#2a6b2a'; cx.fillRect(Math.round(x - r * 0.7), Math.round(y + r * 0.3), Math.round(r * 0.4), 2); },
    roticanai: (x, y, r) => { disc(cx, x - r * 0.1, y, r * 0.55, '#d9a85a'); disc(cx, x - r * 0.1, y, r * 0.3, '#e8c890'); disc(cx, x + r * 0.5, y + r * 0.35, r * 0.2, '#c97a2a'); },
    ckt: (x, y, r) => { disc(cx, x, y, r * 0.6, '#8a5028'); disc(cx, x - r * 0.2, y - r * 0.1, r * 0.2, '#f08a5a'); cx.fillStyle = '#3f9a3a'; cx.fillRect(Math.round(x + r * 0.1), Math.round(y + r * 0.1), 3, 1); },
    mee: (x, y, r) => { disc(cx, x, y, r * 0.6, '#e8c35a'); disc(cx, x + r * 0.2, y - r * 0.2, r * 0.18, '#b8322a'); cx.fillStyle = '#3f9a3a'; cx.fillRect(Math.round(x - r * 0.3), Math.round(y + r * 0.2), 3, 1); },
    rojak: (x, y, r) => { disc(cx, x - r * 0.25, y, r * 0.22, '#9ad04a'); disc(cx, x + r * 0.2, y - r * 0.2, r * 0.22, '#f2c84a'); disc(cx, x + r * 0.15, y + r * 0.3, r * 0.22, '#f58ab0'); disc(cx, x, y, r * 0.15, '#3a2010'); },
  };
  const DRINK = { kopi: '#8a5a34', teh: '#c98a4a', milo: '#6a4028' };
  function drawPlate(p) {
    const [x, y] = toS(p.x, p.y), r = p.r * geo.k;
    disc(cx, x + 1, y + 2, r, 'rgba(0,0,0,.12)');
    if (p.cup) {
      disc(cx, x, y, r, '#2a1a12'); disc(cx, x, y, r - 1, '#e8e4d8');          // saucer
      const cr = r * 0.68;
      disc(cx, x, y, cr, '#2a1a12'); disc(cx, x, y, cr - 1, '#fbf8f0');
      disc(cx, x, y, cr - 2.5, DRINK[p.drink] || '#8a5a34');
      cx.fillStyle = '#3fae6a'; cx.fillRect(Math.round(x - cr + 1), Math.round(y), 1, 1);
      cx.fillStyle = '#2a1a12'; cx.fillRect(Math.round(x + cr), Math.round(y - 1), Math.max(2, Math.round(r * 0.3)), 3);
      cx.fillStyle = 'rgba(255,255,255,.5)'; cx.fillRect(Math.round(x - cr * 0.4), Math.round(y - cr * 0.4), 2, 1);
    } else {
      disc(cx, x, y, r, '#2a1a12'); disc(cx, x, y, r - 1, '#f6f2e6');
      disc(cx, x, y, r * 0.78, '#e8e2d0'); disc(cx, x, y, r * 0.74, '#fbf8f0');
      (FOOD[p.food] || FOOD.rojak)(x, y, r);
    }
  }
  function drawCat(t, ht) {
    const c = LALAT.catPos(st.layout, ht); if (!c) return;
    const [x, y] = toS(c.x, c.y);
    const sz = Math.max(1, Math.round(geo.k * 0.15 / 12));
    const rows = SPR.avatarRows('kucing'), w = 12 * sz;
    const walking = !!st.layout.cat.walk;
    const bob = walking ? (Math.floor(t * 6) % 2) : 0;
    disc(cx, x, y + w * 0.45, w * 0.45, 'rgba(0,0,0,.15)');
    SPR.drawGrid(cx, rows.slice(0, 12), SPR.AVATARS.kucing.pal, Math.round(x - w / 2), Math.round(y - w / 2) - bob, sz);
    if (stun > performance.now() && Math.floor(t * 8) % 2) { cx.fillStyle = '#f6c744'; cx.fillRect(Math.round(x - w / 2), Math.round(y - w / 2 - 4), 2, 2); cx.fillRect(Math.round(x + w / 2 - 2), Math.round(y - w / 2 - 3), 2, 2); }
  }
  function drawFly(f, p, t) {
    const [x, y] = toS(p.x, p.y);
    const big = f.k === 'langau', gold = f.k === 'gold';
    const body = gold ? '#f6c744' : big ? '#2a7a3a' : '#1a1a1a';
    const sz = Math.max(1, Math.round(geo.k / 65));
    const bw = (big ? 4 : 3) * sz, bh = (big ? 3 : 2) * sz;
    if (!p.landed) {
      // shadow on the table, fly a little above it
      cx.fillStyle = 'rgba(0,0,0,.18)'; cx.fillRect(Math.round(x - bw / 2 + 2 * sz), Math.round(y + 4 * sz), bw, Math.max(1, sz));
      const yy = Math.round(y - 3 * sz), wf = Math.floor(t * 30) % 2;
      cx.fillStyle = 'rgba(230,240,255,.85)';
      cx.fillRect(Math.round(x - bw / 2 - sz), yy - (wf ? 2 * sz : sz), sz * 2, sz);
      cx.fillRect(Math.round(x + bw / 2 - sz), yy - (wf ? 2 * sz : sz), sz * 2, sz);
      cx.fillStyle = body; cx.fillRect(Math.round(x - bw / 2), yy, bw, bh);
    } else {
      // landed: wings folded back, rubbing hands
      cx.fillStyle = 'rgba(200,215,230,.9)'; cx.fillRect(Math.round(x - bw / 2), Math.round(y + bh - sz), bw, sz * 2);
      cx.fillStyle = body; cx.fillRect(Math.round(x - bw / 2), Math.round(y), bw, bh);
      cx.fillStyle = '#c0392b'; cx.fillRect(Math.round(x - bw / 2), Math.round(y), sz, sz); cx.fillRect(Math.round(x + bw / 2 - sz), Math.round(y), sz, sz);
      if (Math.floor(t * 6 + x) % 3 === 0) { cx.fillStyle = body; cx.fillRect(Math.round(x - sz / 2), Math.round(y - sz), sz, sz); }
    }
    if (gold && Math.floor(t * 8) % 2) { cx.fillStyle = '#fff6b8'; cx.fillRect(Math.round(x + bw), Math.round(y - 2 * sz), sz, sz); cx.fillRect(Math.round(x - bw - sz), Math.round(y + sz), sz, sz); }
  }
  // a selipar (flip-flop) seen from above
  function drawSelipar(x, y, col, k, sc) {
    const s = Math.max(1, Math.round(geo.k / 60 * sc));
    const w = 5 * s, h = 9 * s, l = Math.round(x - w / 2), t0 = Math.round(y - h / 2);
    cx.fillStyle = '#2a1a12'; cx.fillRect(l - 1, t0 - 1, w + 2, h + 2);
    cx.fillStyle = col; cx.fillRect(l, t0, w, h);
    cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(l, t0, w, s);
    cx.fillStyle = '#fbf3dc'; cx.fillRect(Math.round(x - s / 2), t0 + s, s, Math.round(h * 0.45));
    cx.fillRect(l + s, t0 + Math.round(h * 0.45), w - 2 * s, s);
    cx.globalAlpha = 1;
  }

  // ---------- frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !st || document.hidden) return;
    if (!layout()) return;
    const t = now / 1000, V = view();
    const ht = hostNow() - (st.t0 || 0);
    const key = st.round + ':' + st.rnd;
    if (key !== markKey) { markKey = key; marks.length = 0; }
    cx.clearRect(0, 0, W, H);
    drawMarble();
    cx.drawImage(marble, geo.ox - 4, geo.oy - 4);
    if (!st.layout) { centerText(st.phase === 'over' ? 'HABIS!' : 'TUNGGU HOST...', '#4a3020'); return; }
    for (const p of st.layout.plates) drawPlate(p);
    // splats and cracks
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i], age = now - m.at;
      const [x, y] = toS(m.x, m.y);
      if (m.kind === 'splat') {
        const a = Math.max(0, 1 - age / 8000); if (!a) { marks.splice(i, 1); continue; }
        cx.globalAlpha = a;
        const s = Math.max(1, Math.round(geo.k / 90));
        cx.fillStyle = m.gold ? '#c9a23a' : '#3a2a1a';
        cx.fillRect(Math.round(x - s), Math.round(y - s), 3 * s, 2 * s); cx.fillRect(Math.round(x - 3 * s), Math.round(y), s, s); cx.fillRect(Math.round(x + 3 * s), Math.round(y - 2 * s), s, s); cx.fillRect(Math.round(x + s), Math.round(y + 2 * s), s, s);
        cx.fillStyle = m.col; cx.fillRect(Math.round(x - 4 * s), Math.round(y + 3 * s), s, s);
        cx.globalAlpha = 1;
      } else if (m.kind === 'crack') {
        cx.fillStyle = '#2a1a12';
        let px = x, py = y;
        for (const [dx, dy] of m.path) { px += dx; py += dy; cx.fillRect(Math.round(px), Math.round(py), 1, 1); }
        if (m.spill) disc(cx, x + m.spill[0], y + m.spill[1], m.spill[2], m.spillCol);
      }
    }
    drawCat(t, ht);
    // flies
    if (st.phase === 'play') {
      let near = 0;
      for (const f of V.flies) {
        if (st.dead && st.dead[f.id]) continue;
        const p = LALAT.flyPos(f, ht); if (!p) continue;
        drawFly(f, p, t);
        if (!p.landed) near++;
      }
      if (near && now - lastBuzz > 900) { lastBuzz = now; AU.play('tick'); }
    }
    // selipar slaps
    for (let i = slaps.length - 1; i >= 0; i--) {
      const s = slaps[i], age = now - s.at;
      if (age > 450) { slaps.splice(i, 1); continue; }
      const [x, y] = toS(s.x, s.y);
      const sc = age < 80 ? 1.8 - age / 80 * 0.8 : 1;
      cx.globalAlpha = age > 300 ? (450 - age) / 150 : 1;
      drawSelipar(x, y, s.col, geo.k, sc);
      cx.globalAlpha = 1;
    }
    // pops
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i], age = now - p.at;
      if (age > 1100) { pops.splice(i, 1); continue; }
      const [x, y] = toS(p.x, p.y), sc = geo.k > 150 ? 2 : 1;
      const tx = Math.round(x - root.Scene.tw(p.text, sc) / 2), ty = Math.round(y - 10 - age / 1100 * 14);
      root.Scene.ptext(cx, p.text, tx + 1, ty + 1, '#2a1a12', sc);
      root.Scene.ptext(cx, p.text, tx, ty, p.col, sc);
    }
    // countdown
    if (st.phase === 'ready') { const n = Math.ceil(Math.max(0, -ht) / 1000); centerText(n > 0 ? String(n) : 'PAP!', '#c0392b', 4); }
    if (st.phase === 'break') centerText('ROUND ' + st.rnd + ' HABIS', '#4a3020', 2);
    if (stun > now) centerText('PENING!', '#c0392b', 2, 0.3);
  }
  function centerText(txt, col, sc, yk) {
    sc = sc || 2;
    const x = Math.round(geo.ox + geo.pw / 2 - root.Scene.tw(txt, sc) / 2), y = Math.round(geo.oy + geo.ph * (yk || 0.5) - 3 * sc);
    root.Scene.ptext(cx, txt, x + sc, y + sc, '#fbf8f0', sc);
    root.Scene.ptext(cx, txt, x, y, col, sc);
  }

  // ---------- input ----------
  function onDown(e) {
    if (!st || st.phase !== 'play' || !geo) return;
    const meP = st.players.find(p => p.id === meId);
    if (!meP || !meP.inGame) return;
    e.preventDefault();
    const now = performance.now();
    if (now < stun || now < cool) return;
    const r = cv.getBoundingClientRect();
    const [x, y] = fromS((e.clientX - r.left) / S, (e.clientY - r.top) / S);
    if (x < -0.03 || y < -0.03 || x > LALAT.TW + 0.03 || y > LALAT.TH + 0.03) return;
    const ht = hostNow() - st.t0;
    const hit = LALAT.hitTest(view(), x, y, ht, e.pointerType === 'touch' ? 0.025 : 0.01);
    slaps.push({ x, y, col: colOf(meId), at: now });
    AU.play('whoosh');
    cool = now + (hit.tgt === 'fly' ? 150 : hit.tgt === 'cat' ? 1000 : 400);
    if (hit.tgt === 'cat') stun = now + 1000;
    onSwat && onSwat({ t: 'swat', x: +x.toFixed(3), y: +y.toFixed(3), tgt: hit.tgt, fid: hit.fid, id: hit.id });
  }

  LV.mount = function (canvas, h) {
    cv = canvas; cx = cv.getContext('2d');
    onSwat = h.onSwat;
    cv.addEventListener('pointerdown', onDown);
    requestAnimationFrame(frame);
  };
  LV.show = function (on) { visible = on; if (!on) { st = null; slaps.length = 0; pops.length = 0; } };
  LV.render = function (s, me) {
    meId = me; st = s;
    syncClock(s);
    if (s.flies && s.fkey) { flyCache[s.fkey] = s.flies; for (const k of Object.keys(flyCache)) if (k !== s.fkey) delete flyCache[k]; }
  };
  LV.fx = function (f) {
    const now = performance.now();
    if (f.type === 'kill') {
      if (f.pid !== meId) slaps.push({ x: f.x, y: f.y, col: colOf(f.pid), at: now });
      marks.push({ kind: 'splat', x: f.x, y: f.y, at: now, col: colOf(f.pid), gold: f.k === 'gold' });
      pops.push({ x: f.x, y: f.y, text: '+' + f.pts, col: f.k === 'gold' ? '#f6c744' : colOf(f.pid), at: now });
      AU.play(f.k === 'gold' ? 'tada' : f.pid === meId ? 'crack' : 'chip');
      if (st && st.dead) st.dead[f.fid] = f.pid;
    } else if (f.type === 'slap') {
      if (f.pid !== meId) slaps.push({ x: f.x, y: f.y, col: colOf(f.pid), at: now });
      if (f.pid === meId && f.late) pops.push({ x: f.x, y: f.y, text: 'LAMBAT!', col: '#9a8a78', at: now });
    } else if (f.type === 'oops') {
      if (f.pid !== meId) slaps.push({ x: f.x, y: f.y, col: colOf(f.pid), at: now });
      pops.push({ x: f.x, y: f.y, text: String(f.pts), col: '#ff6b5b', at: now });
      AU.play(f.tgt === 'cat' ? 'deny' : 'crack');
      if (f.tgt !== 'cat') {
        const path = []; let a = Math.random() * 6;
        for (let i = 0; i < 14; i++) { a += (Math.random() - 0.5) * 1.2; path.push([Math.round(Math.cos(a)), Math.round(Math.sin(a))]); }
        const sp = f.tgt === 'cup' ? [Math.round(Math.random() * 6 - 3), Math.round(Math.random() * 6 - 3), 3 + Math.random() * 3] : null;
        marks.push({ kind: 'crack', x: f.x, y: f.y, at: now, path, spill: sp, spillCol: 'rgba(138,90,52,.7)' });
      }
    }
  };
  // table coords -> page coords (used by the automated tests)
  LV.toClient = function (x, y) { if (!geo) return null; const r = cv.getBoundingClientRect(), [px, py] = toS(x, y); return { x: r.left + (px + 0.5) * S, y: r.top + (py + 0.5) * S }; };
  root.LV = LV;
})(window);
