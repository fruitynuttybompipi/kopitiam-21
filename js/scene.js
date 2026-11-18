/* Kopitiam 21 — animated pixel kopitiam background + marble table painter */
(function (root) {
  'use strict';
  const SPR = root.SPR;

  // ---------- tiny 3x5 pixel font ----------
  const F = { "A": '.#.#.#####.##.#', "B": '##.#.###.#.###.', "C": '.###..#..#...##', "D": '##.#.##.##.###.', "E": '####..##.#..###', "F": '####..##.#..#..', "G": '.###..#.##.#.##', "H": '#.##.#####.##.#', "I": '###.#..#..#.###', "J": '..#..#..##.#.#.', "K": '#.###.#..##.#.#', "L": '#..#..#..#..###', "M": '#.########.##.#', "N": '##.#.##.##.##.#', "O": '.#.#.##.##.#.#.', "P": '##.#.###.#..#..', "Q": '.#.#.##.###..##', "R": '##.#.###.#.##.#', "S": '.###...#...###.', "T": '###.#..#..#..#.', "U": '#.##.##.##.####', "V": '#.##.##.##.#.#.', "W": '#.##.########.#', "X": '#.##.#.#.#.##.#', "Y": '#.##.#.#..#..#.', "Z": '###..#.#.#..###', "0": '####.##.##.####', "1": '.#.##..#..#.###', "2": '##...#.#.#..###', "3": '##...#.#...###.', "4": '#.##.####..#..#', "5": '####..##...###.', "6": '.###..####.####', "7": '###..#.#..#..#.', "8": '####.#####.####', "9": '####.####..###.', ".": '.............#.', "-": '......###......', "!": '.#..#..#.....#.', ":": '....#.....#....', "/": '..#..#.#.#..#..', " ": '...............', "$": '.####..#..####.', "%": '#.#..#.#.#..#.#' };
  function ptext(ctx, str, x, y, col, sc) {
    sc = sc || 1; ctx.fillStyle = col;
    str = String(str).toUpperCase();
    for (let i = 0; i < str.length; i++) {
      const g = F[str[i]] || F[' '];
      for (let p = 0; p < 15; p++) if (g[p] === '#') ctx.fillRect(x + (i * 4 + (p % 3)) * sc, y + Math.floor(p / 3) * sc, sc, sc);
    }
  }
  const tw = (str, sc) => (String(str).length * 4 - 1) * (sc || 1);

  function pline(ctx, x0, y0, x1, y1, col, th) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy; ctx.fillStyle = col; th = th || 1;
    for (let n = 0; n < 400; n++) {
      ctx.fillRect(x0, y0, th, th);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- small sprites ----------
  const CAT = [
    ['........o..o', 'o.......oooo', '.o......oeoo', '.ooooooooooo', '..oOoOoOooo.', '..o.o..o.o..', '..o.o..o.o..'],
    ['........o..o', 'o.......oooo', '.o......oeoo', '.ooooooooooo', '..oOoOoOooo.', '...o.o..o.o.', '...o.o..o.o.'],
  ];
  const CAT_PAL = { o: '#f0a040', O: '#c0661c', e: '#2a1a12' };
  const CICAK = ['..g...g.', 'gggggGGG', '..g...g.'];
  const CICAK_PAL = { g: '#a8a878', G: '#7c7c54' };

  const Scene = {};
  let cv, cx, W = 0, H = 0, S = 4, bg = null, t0 = 0, last = 0;
  const L = {};
  let cat = { x: -40, active: false, next: 8 }, cicak = { active: false, next: 4, x: 0, y: 0, vx: 0, vy: 0, pause: 0 };

  function layout() {
    S = root.innerWidth < 640 ? 3 : 4;
    W = Math.ceil(root.innerWidth / S); H = Math.ceil(root.innerHeight / S);
    cv.width = W; cv.height = H;
    L.ceil = Math.max(6, Math.round(H * 0.06));
    L.dado = Math.round(H * 0.6);
    L.floor = Math.round(H * 0.84);
    bg = drawStatic();
  }

  function drawStatic() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const R = rng(21);
    // wall
    g.fillStyle = '#efdcb4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e7d2a7';
    for (let x = 0; x < W; x += 6) g.fillRect(x, L.ceil, 1, L.dado - L.ceil);
    for (let i = 0; i < W * H / 900; i++) { g.fillStyle = 'rgba(160,120,60,.08)'; g.fillRect(R() * W, L.ceil + R() * (L.dado - L.ceil), 2 + R() * 5, 1 + R() * 3); }
    // ceiling planks
    g.fillStyle = '#3b2416'; g.fillRect(0, 0, W, L.ceil);
    g.fillStyle = '#4e3020'; for (let x = 0; x < W; x += 14) g.fillRect(x, 0, 1, L.ceil);
    g.fillStyle = '#21140c'; g.fillRect(0, L.ceil, W, 1);
    // dado trim + tiles
    g.fillStyle = '#6b4226'; g.fillRect(0, L.dado, W, 2);
    g.fillStyle = '#8a5a34'; g.fillRect(0, L.dado, W, 1);
    for (let y = L.dado + 2; y < L.floor; y += 5) for (let x = 0; x < W; x += 5) {
      g.fillStyle = ((x / 5 + (y - L.dado - 2) / 5) % 2 === 0) ? '#7cc4a0' : '#eef5ea';
      g.fillRect(x, y, 5, 5);
      g.fillStyle = 'rgba(40,90,70,.35)'; g.fillRect(x, y, 5, 1); g.fillRect(x, y, 1, 5);
    }
    // floor
    for (let y = L.floor; y < H; y += 4) for (let x = 0; x < W; x += 8) {
      g.fillStyle = ((x / 8 + (y - L.floor) / 4) % 2 === 0) ? '#b0563a' : '#c97a4c'; g.fillRect(x, y, 8, 4);
    }
    g.fillStyle = '#5a2a1a'; g.fillRect(0, L.floor, W, 1);
    // menu board
    if (W > 150) {
      const mx = 6, my = L.ceil + 26, mw = 47, mh = 57;
      g.fillStyle = '#6b4226'; g.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      g.fillStyle = '#234a3a'; g.fillRect(mx, my, mw, mh);
      ptext(g, 'MENU', mx + 15, my + 3, '#f6c744');
      ['KOPI  1.80', 'TEH   2.00', 'MILO  3.00', 'ROTI  2.50', 'TELUR 2.20', 'NASI  5.50'].forEach((l, i) => ptext(g, l, mx + 4, my + 12 + i * 7, '#e9efe6'));
    }
    // calendar
    if (W > 120) {
      const kx = W - 24, ky = L.ceil + 46;
      g.fillStyle = '#2a1a12'; g.fillRect(kx - 1, ky - 1, 18, 21);
      g.fillStyle = '#fbf6ea'; g.fillRect(kx, ky, 16, 19);
      g.fillStyle = '#c0392b'; g.fillRect(kx, ky, 16, 6);
      const d = new Date();
      ptext(g, ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()], kx + 2, ky + 1, '#fbf6ea');
      const dd = String(d.getDate());
      ptext(g, dd, kx + 8 - Math.round(tw(dd, 2) / 2), ky + 8, '#c0392b', 2);
    }
    // counter (teh tarik stall)
    if (W > 110) {
      const cw = Math.min(70, Math.round(W * 0.3)), cx0 = W - cw, ct = L.floor - 20;
      g.fillStyle = '#5a361f'; g.fillRect(cx0, ct, cw, L.floor - ct + 6);
      g.fillStyle = '#8a5a34'; g.fillRect(cx0 - 2, ct - 3, cw + 2, 3);
      g.fillStyle = '#a8703f'; g.fillRect(cx0 - 2, ct - 3, cw + 2, 1);
      g.fillStyle = '#4a2c18'; for (let x = cx0 + 4; x < W; x += 8) g.fillRect(x, ct + 2, 1, 16);
      ptext(g, 'TEH TARIK', cx0 + 4, ct + 7, '#f6c744');
      L.counter = { x: cx0, top: ct - 3, w: cw };
    } else L.counter = null;
    // hawker stalls along the back wall: as many as fit, left to right
    L.stalls = [];
    const sw = 48, gap = 4;
    const right = L.counter ? L.counter.x - 4 : W - 2;
    // fill from both edges inward so the side stalls stay visible around the game in the middle
    let lx = 3, rx = right - sw;
    ['nasi', 'roti', 'ckt', 'rojak', 'mee'].forEach((kind, i) => {
      const left = i % 2 === 0;
      const x = left ? lx : rx;
      const clash = L.stalls.some(o => x < o.x + o.w + gap && x + sw + gap > o.x);
      if (x < 2 || x + sw > right || clash) return;
      L.stalls.push({ kind, x, w: sw });
      if (left) lx += sw + gap; else rx -= sw + gap;
    });
    for (const st of L.stalls) drawStall(g, st);
    // warm light
    const grd = g.createRadialGradient(W / 2, 0, 2, W / 2, 0, W * 0.8);
    grd.addColorStop(0, 'rgba(255,220,140,.18)'); grd.addColorStop(1, 'rgba(60,30,10,.18)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    return c;
  }

  // ---------- hawker stalls ----------
  const STALLS = {
    nasi: { lines: ['NASI', 'LEMAK'], sign: '#2f8a5f', light: '#3fae6a', body: '#8a5a34', bodyD: '#6b4226', bodyL: '#a8703f', price: 'RM5', hawker: 'makcik', fx: 'steam' },
    ckt: { lines: ['PENANG CHAR', 'KUEY TEOW'], sign: '#2a5cb0', light: '#4a7cd0', body: '#b9c0c8', bodyD: '#8f979f', bodyL: '#dfe4e8', price: 'RM9', hawker: 'ahpek', fx: 'fire', cart: true },
    roti: { lines: ['ROTI', 'CANAI'], sign: '#d97a1e', light: '#f09a3e', body: '#8a5a34', bodyD: '#6b4226', bodyL: '#a8703f', price: 'RM2', hawker: 'anneh', fx: 'flip' },
    mee: { lines: ['WANTAN', 'MEE'], sign: '#c0392b', light: '#d24a3a', body: '#b9c0c8', bodyD: '#8f979f', bodyL: '#dfe4e8', price: 'RM7', hawker: 'auntie', fx: 'steam', cart: true },
    rojak: { lines: ['ROJAK'], sign: '#7a2a5a', light: '#9a4a7a', body: '#8a5a34', bodyD: '#6b4226', bodyL: '#a8703f', price: 'RM6', hawker: 'ahboy', fx: null },
  };
  function drawStall(g, st) {
    const c = STALLS[st.kind];
    const x = st.x, w = st.w, base = L.floor + 2, ctop = base - 20, signH = 6 * c.lines.length + 4, signY = ctop - 22 - signH;
    st.ctop = ctop;
    // poles + signboard
    g.fillStyle = '#4a4a4a'; g.fillRect(x + 2, signY + signH, 2, ctop - signY - signH); g.fillRect(x + w - 4, signY + signH, 2, ctop - signY - signH);
    g.fillStyle = '#2a1a12'; g.fillRect(x - 1, signY - 1, w + 2, signH + 2);
    g.fillStyle = c.sign; g.fillRect(x, signY, w, signH);
    g.fillStyle = c.light; g.fillRect(x, signY, w, 1);
    c.lines.forEach((l, i) => ptext(g, l, x + Math.round((w - tw(l)) / 2), signY + 3 + i * 6, '#f6c744'));
    // awning
    for (let i = 0; i < w; i += 6) { g.fillStyle = (i / 6) % 2 ? '#fbf3dc' : c.sign; g.fillRect(x + i, signY + signH + 1, Math.min(6, w - i), 3); }
    // glass display case
    const gy = ctop - 12;
    g.fillStyle = '#2a1a12'; g.fillRect(x + 3, gy - 1, w - 6, 13);
    g.fillStyle = '#d6eef4'; g.fillRect(x + 4, gy, w - 8, 11);
    const R = (a, b, ww, hh, col) => { g.fillStyle = col; g.fillRect(x + a, gy + b, ww, hh); };
    if (st.kind === 'nasi') {
      for (let i = 0; i < 4; i++) { const px = 6 + i * 7; R(px, 6, 6, 4, '#2a6b2a'); R(px + 1, 5, 4, 1, '#2a6b2a'); R(px + 2, 4, 2, 1, '#2a6b2a'); R(px + 1, 7, 2, 2, '#3f9a3a'); }
      R(w - 15, 6, 7, 4, '#c0392b'); R(w - 16, 9, 9, 1, '#e8e2d0'); R(w - 8, 5, 3, 4, '#fff8ea'); R(w - 7, 6, 1, 2, '#f2b81e');
    } else if (st.kind === 'mee') {
      for (let i = 0; i < 3; i++) { const px = 6 + i * 6; R(px, 1, 3, 7, '#e8c35a'); R(px + 1, 2, 1, 6, '#c9a23e'); }
      for (let i = 0; i < 2; i++) { const px = 25 + i * 5; R(px, 1, 3, 6, '#b8322a'); R(px, 6, 3, 1, '#7a1f17'); }
      R(w - 13, 8, 8, 3, '#fbf8f0'); R(w - 13, 9, 8, 1, '#3fae6a');
    } else if (st.kind === 'ckt') {
      // plates of flat noodles with prawns and cockles
      for (let i = 0; i < 2; i++) { const px = 6 + i * 14; R(px, 8, 12, 2, '#fbf8f0'); R(px + 2, 6, 8, 2, '#8a5028'); R(px + 3, 5, 2, 1, '#f08a5a'); R(px + 7, 5, 2, 1, '#3a2a1a'); }
      R(w - 14, 9, 9, 1, '#2a2a2a');
    } else if (st.kind === 'roti') {
      // stack of roti + curry
      for (let i = 0; i < 4; i++) R(6, 9 - i * 2, 14, 2, i % 2 ? '#e8c890' : '#d9a85a');
      R(24, 7, 8, 3, '#c97a2a'); R(23, 9, 10, 1, '#e8e2d0');
      R(w - 12, 6, 6, 4, '#fbf8f0'); R(w - 11, 7, 4, 2, '#7a3a1a');
    } else if (st.kind === 'rojak') {
      // fruit pieces + dark sauce
      const cols = ['#9ad04a', '#f2c84a', '#f58ab0', '#7ab83a', '#e8e2d0', '#f2c84a'];
      for (let i = 0; i < 6; i++) R(6 + (i % 3) * 5, 3 + Math.floor(i / 3) * 4, 4, 3, cols[i]);
      R(w - 18, 6, 10, 4, '#3a2010'); R(w - 19, 9, 12, 1, '#e8e2d0'); R(w - 16, 6, 2, 1, '#a07040');
    }
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 5, gy + 1, 1, 9);
    // counter / cart body
    g.fillStyle = '#2a1a12'; g.fillRect(x, ctop - 1, w, base - ctop + 1);
    g.fillStyle = c.body; g.fillRect(x + 1, ctop, w - 2, base - ctop - 1);
    g.fillStyle = c.bodyD; for (let i = x + 4; i < x + w - 2; i += 6) g.fillRect(i, ctop + 2, 1, base - ctop - 4);
    g.fillStyle = c.bodyL; g.fillRect(x + 1, ctop, w - 2, 1);
    g.fillStyle = '#fbf3dc'; g.fillRect(x + w - tw(c.price) - 7, ctop + 4, tw(c.price) + 4, 7);
    ptext(g, c.price, x + w - tw(c.price) - 5, ctop + 5, '#c0392b');
    if (c.cart) { g.fillStyle = '#2a1a12'; g.fillRect(x + 6, base - 2, 6, 4); g.fillRect(x + w - 12, base - 2, 6, 4); }
  }
  function drawStallLife(t) {
    for (const st of L.stalls || []) {
      const c = STALLS[st.kind];
      // hawker behind the counter
      const hx = st.x + Math.round(st.w * 0.55) - 8, hy = st.ctop - 15 + (Math.floor(t * 2 + st.x) % 2);
      SPR.drawGrid(cx, SPR.avatarRows(c.hawker).slice(0, 13), SPR.AVATARS[c.hawker].pal, hx, hy, 1);
      cx.fillStyle = '#2a1a12'; cx.fillRect(st.x + 3, st.ctop - 13, st.w - 6, 1);
      const ax = st.x + Math.round(st.w * 0.25), ay = st.ctop - 13;
      if (c.fx === 'steam') {
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.7 + i / 3) % 1);
          cx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - k)).toFixed(2)})`;
          cx.fillRect(Math.round(ax + Math.sin(t * 3 + i) * 2), Math.round(ay - 1 - k * 14), 1, 2);
        }
      } else if (c.fx === 'fire') {
        // wok over flames
        cx.fillStyle = '#2a2a2a'; cx.fillRect(ax - 6, ay - 3, 12, 2); cx.fillRect(ax - 4, ay - 1, 8, 1); cx.fillRect(ax + 6, ay - 4, 4, 1);
        for (let i = 0; i < 4; i++) {
          const fh = 2 + Math.floor(((Math.sin(t * 18 + i * 2) + 1) / 2) * 4);
          cx.fillStyle = i % 2 ? '#f6c744' : '#e8641e';
          cx.fillRect(ax - 4 + i * 2, ay - 3 - fh, 2, fh);
        }
        if (Math.sin(t * 5) > 0.3) { cx.fillStyle = 'rgba(80,80,80,.5)'; cx.fillRect(Math.round(ax + Math.sin(t * 2) * 3), ay - 12 - Math.floor(t * 8 % 6), 2, 2); }
      } else if (c.fx === 'flip') {
        // roti being flipped
        const k = (t * 1.3) % 1, up = Math.sin(k * Math.PI) * 10;
        cx.fillStyle = '#2a2a2a'; cx.fillRect(ax - 6, ay - 1, 12, 1);
        cx.fillStyle = '#e8c890'; cx.fillRect(ax - 4, Math.round(ay - 3 - up), 8, k > 0.4 && k < 0.6 ? 1 : 2);
      }
    }
  }

  function drawFan(x, t, len) {
    const y = L.ceil + 7;
    cx.fillStyle = '#2a1a12'; cx.fillRect(x, L.ceil - 1, 1, 7);
    for (let b = 0; b < 4; b++) {
      const a = t * 9 + b * Math.PI / 2;
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.28;
      pline(cx, x, y, ex, ey, '#5a3a24', 2);
      pline(cx, x, y, ex, ey - 1, '#7a5232', 1);
    }
    cx.fillStyle = '#2a1a12'; cx.fillRect(x - 2, y - 1, 5, 3);
    cx.fillStyle = '#8a8a8a'; cx.fillRect(x - 1, y - 1, 3, 1);
  }

  function drawClock(t) {
    if (W < 120) return;
    const ox = W - 16, oy = L.ceil + 26, r = 8;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) { cx.fillStyle = d > r - 1.2 ? '#2a1a12' : d > r - 2.2 ? '#c0392b' : '#fbf6ea'; cx.fillRect(ox + x, oy + y, 1, 1); }
    }
    const d = new Date(), hh = d.getHours() % 12 + d.getMinutes() / 60, mm = d.getMinutes();
    const ha = hh / 12 * Math.PI * 2 - Math.PI / 2, ma = mm / 60 * Math.PI * 2 - Math.PI / 2;
    pline(cx, ox, oy, ox + Math.cos(ha) * 3.5, oy + Math.sin(ha) * 3.5, '#2a1a12');
    pline(cx, ox, oy, ox + Math.cos(ma) * 5.5, oy + Math.sin(ma) * 5.5, '#2a1a12');
    const sa = d.getSeconds() / 60 * Math.PI * 2 - Math.PI / 2;
    cx.fillStyle = '#c0392b'; cx.fillRect(Math.round(ox + Math.cos(sa) * 5), Math.round(oy + Math.sin(sa) * 5), 1, 1);
  }

  function drawTehMan(t) {
    const C = L.counter; if (!C) return;
    const mx = C.x + Math.round(C.w / 2) - 8, my = C.top - 15;
    SPR.drawGrid(cx, SPR.avatarRows('anneh').slice(0, 15), SPR.AVATARS.anneh.pal, mx, my, 1);
    const pull = Math.abs(Math.sin(t * 2.2));
    const lowY = C.top - 5, upY = Math.round(my - 2 - pull * 10);
    // arms
    pline(cx, mx + 2, my + 12, mx - 3, lowY + 1, '#a86a3c', 1);
    pline(cx, mx + 13, my + 11, mx + 18, upY + 4, '#a86a3c', 1);
    // cups
    cx.fillStyle = '#e8e2d0'; cx.fillRect(mx - 6, lowY, 5, 5); cx.fillStyle = '#c98a4a'; cx.fillRect(mx - 5, lowY + 1, 3, 1);
    cx.fillStyle = '#e8e2d0'; cx.fillRect(mx + 16, upY, 5, 5);
    // tea stream
    for (let y = upY + 5; y < lowY; y++) { cx.fillStyle = (y + Math.floor(t * 20)) % 3 ? '#c98a4a' : '#e0b07a'; cx.fillRect(Math.round(mx + 18 - (y - upY) / (lowY - upY) * 21), y, 1, 1); }
  }

  function drawCat(dt) {
    if (!cat.active) { cat.next -= dt; if (cat.next < 0) { cat.active = true; cat.x = -14; cat.dir = Math.random() < 0.5 ? 1 : -1; if (cat.dir < 0) cat.x = W + 2; } return; }
    cat.x += cat.dir * dt * 14;
    const f = Math.floor(cat.x / 3) % 2 ? 1 : 0;
    const y = H - 9;
    const rows = CAT[Math.abs(f)];
    if (cat.dir > 0) SPR.drawGrid(cx, rows, CAT_PAL, Math.round(cat.x), y, 1);
    else SPR.drawGrid(cx, rows.map(r => r.split('').reverse().join('')), CAT_PAL, Math.round(cat.x), y, 1);
    if (cat.x > W + 20 || cat.x < -30) { cat.active = false; cat.next = 20 + Math.random() * 25; }
  }

  function drawCicak(dt) {
    const c = cicak;
    if (!c.active) {
      c.next -= dt;
      if (c.next < 0) {
        c.active = true; c.dir = Math.random() < 0.5 ? 1 : -1;
        c.x = c.dir > 0 ? -8 : W + 8; c.y = L.ceil + 8 + Math.random() * (L.dado - L.ceil - 20);
        c.vy = (Math.random() - 0.5) * 3; c.pause = 0;
      }
      return;
    }
    if (c.pause > 0) c.pause -= dt;
    else {
      c.x += c.dir * dt * 9; c.y += c.vy * dt;
      if (Math.random() < dt * 0.5) c.pause = 0.6 + Math.random() * 1.5;
    }
    const rows = c.dir > 0 ? CICAK : CICAK.map(r => r.split('').reverse().join(''));
    SPR.drawGrid(cx, rows, CICAK_PAL, Math.round(c.x), Math.round(c.y), 1);
    if (c.x > W + 12 || c.x < -12) { c.active = false; c.next = 15 + Math.random() * 25; }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (now - last < 1000 / 12) return;
    const dt = Math.min(0.2, (now - (last || now)) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    cx.drawImage(bg, 0, 0);
    drawFan(Math.round(W * 0.18), t, W < 200 ? 12 : 18);
    drawFan(Math.round(W * 0.82), t + 0.4, W < 200 ? 12 : 18);
    drawClock(t);
    drawCicak(dt);
    drawStallLife(t);
    drawTehMan(t);
    drawCat(dt);
  }

  Scene.init = function (canvas) {
    cv = canvas; cx = cv.getContext('2d');
    layout();
    let rz = null;
    root.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
    t0 = performance.now();
    requestAnimationFrame(frame);
  };

  // ---------- marble table (rounded "squircle") ----------
  Scene.table = function (w, h, lines) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = rng(77);
    const P = 4;
    const inside = (x, y, m) => {
      const hw = w / 2 - m, hh = h / 2 - m - 3;
      if (hw <= 0 || hh <= 0) return false;
      const nx = (x + 0.5 - w / 2) / hw, ny = (y + 0.5 - (h - 3) / 2) / hh;
      return Math.pow(Math.abs(nx), P) + Math.pow(Math.abs(ny), P) <= 1;
    };
    const img = g.createImageData(w, h), d = img.data;
    const put = (x, y, col) => { const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3] == null ? 255 : col[3]; };
    // shadow
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!inside(x, y, 0) && inside(x, y - 3, 0)) put(x, y, [40, 20, 10, 110]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y, 0)) continue;
      let col;
      if (!inside(x, y, 1)) col = [42, 26, 18];
      else if (!inside(x, y, 2)) col = y < h / 2 ? [168, 112, 63] : [122, 74, 42];
      else if (!inside(x, y, 5)) col = [122, 74, 42];
      else if (!inside(x, y, 6)) col = [59, 36, 22];
      else { const n = Math.floor(R() * 10) - 5; col = [236 + n, 232 + n, 223 + n]; }
      put(x, y, col);
    }
    g.putImageData(img, 0, 0);
    // marble veins
    for (let v = 0; v < Math.max(4, w * h / 3000); v++) {
      let x = R() * w, y = R() * h, a = R() * Math.PI * 2;
      const len = 30 + R() * 90, col = R() < 0.5 ? 'rgba(180,174,162,.4)' : 'rgba(205,199,188,.55)';
      for (let i = 0; i < len; i++) {
        a += (R() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a) * 0.7;
        const xi = Math.round(x), yi = Math.round(y);
        if (inside(xi, yi, 7)) { g.fillStyle = col; g.fillRect(xi, yi, 1, 1); }
      }
    }
    // printed table text
    if (lines && w > 150) {
      const sc = w > 220 ? 1 : 1;
      lines.forEach((l, i) => {
        const x = Math.round(w / 2 - tw(l, sc) / 2), y = Math.round(h * 0.47 + i * 8 - lines.length * 4);
        if (tw(l, sc) < w - 30) ptext(g, l, x, y, 'rgba(150,140,124,.75)', sc);
      });
    }
    return c.toDataURL();
  };

  Scene.marble = function () {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const g = c.getContext('2d'), R = rng(5);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const n = Math.floor(R() * 10) - 5; g.fillStyle = `rgb(${236 + n},${232 + n},${223 + n})`; g.fillRect(x, y, 1, 1); }
    return c.toDataURL();
  };

  Scene.ptext = ptext; Scene.tw = tw;
  root.Scene = Scene;
})(window);
