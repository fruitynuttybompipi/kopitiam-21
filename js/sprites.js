/* Kopitiam 21 — pixel sprites (all hand-drawn grids, no image files) */
(function (root) {
  'use strict';

  // Each avatar row = [cols 0-3, cols 4-11, cols 12-15] so every row is 16 px wide.
  const BODY_END = ['.kkk', 'kkkkkkkk', 'kkk.'];
  const NECK = ['....', '.kSSSSk.', '....'];

  const AVATARS = {
    ahpek: {
      name: 'Ah Pek', skin: 's',
      pal: { k: '#2a1a12', s: '#f0c08a', S: '#d4965e', h: '#b9b9b9', w: '#fff6e0', e: '#1a1010', g: '#2a2a2a', p: '#f19a8a', m: '#9a3b2b', c: '#f5f2e8', C: '#d2ccbb' },
      rows: [
        ['....', '........', '....'],
        ['....', '.kkkkkk.', '....'],
        ['....', 'kswssssk', '....'],
        ['...h', 'ssssssss', 'h...'],
        ['...h', 'ssssssss', 'h...'],
        ['...k', 'geggggeg', 'k...'],
        ['...k', 'ssssssss', 'k...'],
        ['...k', 'spssssps', 'k...'],
        ['...k', 'sshhhhss', 'k...'],
        ['....', 'ksssmssk', '....'],
        NECK,
        ['..ks', 'scsSSscs', 'sk..'],
        ['.kss', 'sccccccs', 'ssk.'],
        ['.kss', 'sccCCccs', 'ssk.'],
        ['.kss', 'scccCccs', 'ssk.'],
        BODY_END,
      ],
    },
    auntie: {
      name: 'Auntie', skin: 's',
      pal: { k: '#2a1a12', s: '#f2c8a0', S: '#d6a27a', h: '#3a2230', H: '#7a4470', e: '#1a1010', p: '#f39a9a', m: '#d43a5a', c: '#d94a4a', C: '#a83232', a: '#ffd34d' },
      rows: [
        ['...h', 'hhhhhhhh', 'h...'],
        ['..hh', 'hHhhhhHh', 'hh..'],
        ['.hhH', 'hhhhhhhh', 'Hhh.'],
        ['.hhh', 'hshhhhsh', 'hhh.'],
        ['.hhh', 'ssssssss', 'hhh.'],
        ['.hhk', 'sesssses', 'khh.'],
        ['.hhk', 'sesssses', 'khh.'],
        ['.hhk', 'spssssps', 'khh.'],
        ['..hk', 'sssmmsss', 'kh..'],
        ['..h.', 'kssssssk', '.h..'],
        NECK,
        ['..kc', 'cccacccc', 'ck..'],
        ['.kcc', 'caccccac', 'cck.'],
        ['.kca', 'cccaccca', 'cck.'],
        ['.kcc', 'ccaccacc', 'ack.'],
        BODY_END,
      ],
    },
    ahboy: {
      name: 'Ah Boy', skin: 's',
      pal: { k: '#2a1a12', s: '#f5cc9c', S: '#d9a676', h: '#1e1a1a', H: '#5a4a4a', e: '#1a1010', p: '#f5a39a', m: '#9a3b2b', c: '#f4f4f4', C: '#cdd3dd', w: '#ffffff', A: '#2a5cb0' },
      rows: [
        ['...h', '.h.h.h.h', '....'],
        ['...h', 'hhhhhhhh', 'h...'],
        ['..hh', 'hHhhhhhH', 'hh..'],
        ['..hh', 'hhhhhhhh', 'hh..'],
        ['...h', 'sshhhhss', 'h...'],
        ['...k', 'sesssses', 'k...'],
        ['...k', 'sesssses', 'k...'],
        ['...k', 'spssssps', 'k...'],
        ['...k', 'ssssmmss', 'k...'],
        ['....', 'kssssssk', '....'],
        NECK,
        ['..kc', 'cwwccwwc', 'ck..'],
        ['.kcc', 'ccccccAc', 'cck.'],
        ['.kcc', 'cccCcccc', 'cck.'],
        ['.kcc', 'cccCcccc', 'cck.'],
        BODY_END,
      ],
    },
    makcik: {
      name: 'Makcik', skin: 's',
      pal: { k: '#2a1a12', s: '#dba46a', S: '#b9804a', h: '#2f9e98', H: '#6fd8cf', e: '#1a1010', p: '#ef8f7a', m: '#a8344a', c: '#ef9cc8', C: '#c973a3', a: '#ffd34d' },
      rows: [
        ['....', '.hhhhhh.', '....'],
        ['...h', 'hhhhhhhh', 'h...'],
        ['..hh', 'hHhhhhhh', 'hh..'],
        ['..hh', 'hssssssh', 'hh..'],
        ['..hh', 'hssssssh', 'hh..'],
        ['..hh', 'hesssseh', 'hh..'],
        ['..hh', 'hesssseh', 'hh..'],
        ['..hh', 'hpssssph', 'hh..'],
        ['..hh', 'hssmmssh', 'hh..'],
        ['..hh', 'hhsssshh', 'hh..'],
        ['.hhh', 'hhhhhhhh', 'hhh.'],
        ['.hhh', 'hhhHhhhh', 'hhh.'],
        ['.kcc', 'hhhhhhhh', 'cck.'],
        ['.kcc', 'cchhhhcc', 'cck.'],
        ['.kcc', 'cccacccc', 'cck.'],
        BODY_END,
      ],
    },
    anneh: {
      name: 'Anneh Mamak', skin: 's',
      pal: { k: '#2a1a12', s: '#a86a3c', S: '#87502a', h: '#141010', H: '#3a3030', e: '#0e0a0a', p: '#a86a3c', m: '#6a2a20', c: '#f5f5f0', C: '#d0d0c8', a: '#e05a2a', A: '#ffd1a0' },
      rows: [
        ['....', '........', '....'],
        ['....', 'hhhhhhhh', '....'],
        ['...h', 'hhHhhhhh', 'h...'],
        ['...h', 'hhhhhHhh', 'h...'],
        ['...k', 'ssssssss', 'k...'],
        ['...k', 'sesssses', 'k...'],
        ['...k', 'sesssses', 'k...'],
        ['...k', 'sssSSsss', 'k...'],
        ['...k', 'shhhhhhs', 'k...'],
        ['....', 'kssmmssk', '....'],
        NECK,
        ['..kc', 'ccccccaa', 'ak..'],
        ['.kcc', 'cccccaAa', 'Aak.'],
        ['.kcc', 'cccCccaA', 'aak.'],
        ['.kcc', 'cccCcccA', 'aak.'],
        BODY_END,
      ],
    },
    officegirl: {
      name: 'Office Girl', skin: 's',
      pal: { k: '#2a1a12', s: '#f5cfa8', S: '#d9a97e', h: '#4a2a1a', H: '#8a5a3a', e: '#1a1010', p: '#f7a0a0', m: '#d45a6a', c: '#3a4a7a', C: '#2a3660', w: '#ffffff' },
      rows: [
        ['....', '.hhhhhh.', '....'],
        ['...h', 'hhhhhhhh', 'h...'],
        ['..hh', 'hHhhhhhh', 'hh..'],
        ['..hh', 'hhhsssss', 'hh..'],
        ['..hh', 'hsssssss', 'hh..'],
        ['..hk', 'sesssses', 'kh..'],
        ['..hk', 'sesssses', 'kh..'],
        ['..hk', 'spssssps', 'kh..'],
        ['..hk', 'sssmmsss', 'kh..'],
        ['..hh', 'kssssssk', 'hh..'],
        ['..hh', '.kSSSSk.', 'hh..'],
        ['..hc', 'ccwwwwcc', 'ch..'],
        ['.kcc', 'ccwwwwcc', 'cck.'],
        ['.kcc', 'cccwwccc', 'cck.'],
        ['.kcC', 'cccccccc', 'Cck.'],
        BODY_END,
      ],
    },
    rider: {
      name: 'Abang Rider', skin: 's',
      pal: { k: '#2a1a12', s: '#c98a56', S: '#a86c3c', h: '#2fa84f', H: '#8ae0a0', g: '#22313f', e: '#1a1010', p: '#d98a6a', m: '#7a2a20', c: '#2fa84f', C: '#1f7a39', a: '#e8f0a0' },
      rows: [
        ['....', '..hhhh..', '....'],
        ['....', 'hhhhhhhh', '....'],
        ['...h', 'hHHhhhhh', 'h...'],
        ['..hh', 'hhhhhhhh', 'hh..'],
        ['..hh', 'gggggggg', 'hh..'],
        ['..hk', 'sesssses', 'kh..'],
        ['..hk', 'sesssses', 'kh..'],
        ['..hk', 'spssssps', 'kh..'],
        ['..hk', 'sssmmsss', 'kh..'],
        ['...h', 'kssssssk', 'h...'],
        NECK,
        ['..kc', 'ccckkccc', 'ck..'],
        ['.kcc', 'ccckcccc', 'cck.'],
        ['.kaa', 'aaakaaaa', 'aak.'],
        ['.kcC', 'ccckcccc', 'Cck.'],
        BODY_END,
      ],
    },
    kucing: {
      name: 'Kopitiam Cat', skin: 'o',
      pal: { k: '#2a1a12', o: '#f0a040', O: '#c0661c', w: '#fff4e0', e: '#3a7a2a', p: '#f08aa0' },
      rows: [
        ['....', '........', '....'],
        ['...k', '........', 'k...'],
        ['..kp', 'k......k', 'pk..'],
        ['..ko', 'okkkkkko', 'ok..'],
        ['..ko', 'oOoOOoOo', 'ok..'],
        ['..ko', 'oooooooo', 'ok..'],
        ['..ko', 'oeeooeeo', 'ok..'],
        ['.kko', 'oeeooeeo', 'okk.'],
        ['..ko', 'wwwppwww', 'ok..'],
        ['.kkw', 'wwkwwkww', 'wkk.'],
        ['...k', 'wwwwwwww', 'k...'],
        ['..ko', 'oowwwwoo', 'ok..'],
        ['.koo', 'oowwwwoo', 'ook.'],
        ['.koO', 'oowwwwoo', 'Ook.'],
        ['.koo', 'ooowwooo', 'ook.'],
        BODY_END,
      ],
    },
  };

  const DRINKS = {
    tehtarik: {
      name: 'Teh Tarik', hot: true,
      pal: { k: '#2a1a12', f: '#fff3dc', t: '#c98a4a', T: '#a86a30', g: '#ffffff' },
      rows: [
        'kkkkkkkk..',
        'kffffffk..',
        'kfffgffk..',
        'kttttttkkk',
        'kgtttttk.k',
        'kTtttttk.k',
        'kTtttttkkk',
        'kTtttttk..',
        '.kttttk...',
        '..kkkk....',
      ],
    },
    kopio: {
      name: 'Kopi-O', hot: true,
      pal: { k: '#2a1a12', d: '#3a2010', w: '#fbfbf4', a: '#3fae6a', s: '#e8e4d8' },
      rows: [
        '..........',
        '..........',
        'kkkkkkkk..',
        'kddddddkkk',
        'kwwwwwwk.k',
        'kaaaaaak.k',
        'kwwwwwwkkk',
        '.kwwwwk...',
        'kkkkkkkkk.',
        '.ksssssk..',
      ],
    },
    miloais: {
      name: 'Milo Ais', hot: false,
      pal: { k: '#2a1a12', i: '#e4f6ff', m: '#8a5a3a', M: '#6a4028', w: '#ffffff' },
      rows: [
        '.kkkkkkk..',
        '.kwiwiwk..',
        '.kmmmmmk..',
        '.kmimmmk..',
        '.kmmmimk..',
        '.kwmmmmk..',
        '.kMmmmmk..',
        '.kMmmmmk..',
        '..kmmmk...',
        '..kkkkk...',
      ],
    },
    bandung: {
      name: 'Sirap Bandung', hot: false,
      pal: { k: '#2a1a12', i: '#e4f6ff', m: '#f58ab0', M: '#d2608a', w: '#ffffff' },
      rows: [
        '.kkkkkkk..',
        '.kwiwiwk..',
        '.kmmmmmk..',
        '.kmimmmk..',
        '.kmmmimk..',
        '.kwmmmmk..',
        '.kMmmmmk..',
        '.kMmmmmk..',
        '..kmmmk...',
        '..kkkkk...',
      ],
    },
    limauais: {
      name: 'Limau Ais', hot: false,
      pal: { k: '#2a1a12', i: '#e4f6ff', m: '#c4e86a', M: '#9cc040', w: '#ffffff', l: '#4aa02a' },
      rows: [
        '.kkkkkkkl.',
        '.kwiwiwkll',
        '.kmmmmmkl.',
        '.kmimmmk..',
        '.kmmmimk..',
        '.kwmmmmk..',
        '.kMmmmmk..',
        '.kMmmmmk..',
        '..kmmmk...',
        '..kkkkk...',
      ],
    },
  };

  const SUITS = {
    H: { color: 'r', rows: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'] },
    D: { color: 'r', rows: ['...r...', '..rrr..', '.rrrrr.', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'] },
    S: { color: 'b', rows: ['...b...', '..bbb..', '.bbbbb.', 'bbbbbbb', 'bbbbbbb', '.b.b.b.', '..bbb..'] },
    C: { color: 'b', rows: ['..bbb..', '..bbb..', 'bbbbbbb', 'bbbbbbb', 'bb.b.bb', '...b...', '..bbb..'] },
  };
  const SUIT_PAL = { r: '#d42a2a', b: '#1c1c28' };

  const CHIPS = [
    { v: 10, base: '#f2f2ec', edge: '#2a5cb0', label: '10' },
    { v: 50, base: '#d63a3a', edge: '#ffffff', label: '50' },
    { v: 100, base: '#2a9a4a', edge: '#ffffff', label: '100' },
    { v: 500, base: '#22222a', edge: '#ffcf3a', label: '500' },
  ];

  function avatarRows(id) {
    return AVATARS[id].rows.map(r => r.join(''));
  }

  function blinkRows(id) {
    const a = AVATARS[id];
    const rows = avatarRows(id).map(r => r.split(''));
    const eyeRows = [];
    rows.forEach((r, i) => { if (r.includes('e')) eyeRows.push(i); });
    eyeRows.forEach((ri, n) => {
      const last = n === eyeRows.length - 1;
      rows[ri] = rows[ri].map(ch => ch === 'e' ? (last ? 'k' : a.skin) : ch);
    });
    return rows.map(r => r.join(''));
  }

  function drawGrid(ctx, rows, pal, ox, oy, scale) {
    scale = scale || 1;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  const cache = {};
  function url(key, w, h, draw) {
    if (cache[key]) return cache[key];
    const c = makeCanvas(w, h);
    draw(c.getContext('2d'));
    return (cache[key] = c.toDataURL());
  }

  // 2-frame sheet: [normal | blink]
  function avatarSheet(id) {
    return url('av:' + id, 32, 16, ctx => {
      const a = AVATARS[id];
      drawGrid(ctx, avatarRows(id), a.pal, 0, 0, 1);
      drawGrid(ctx, blinkRows(id), a.pal, 16, 0, 1);
    });
  }
  function avatarStill(id) {
    return url('avs:' + id, 16, 16, ctx => drawGrid(ctx, avatarRows(id), AVATARS[id].pal, 0, 0, 1));
  }
  function drink(id) {
    return url('dr:' + id, 10, 10, ctx => drawGrid(ctx, DRINKS[id].rows, DRINKS[id].pal, 0, 0, 1));
  }
  function suit(s) {
    return url('su:' + s, 7, 7, ctx => drawGrid(ctx, SUITS[s].rows, SUIT_PAL, 0, 0, 1));
  }
  function chip(v) {
    const c = CHIPS.find(x => x.v === v) || CHIPS[0];
    return url('ch:' + v, 14, 14, ctx => {
      const R = 7;
      for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
        const dx = x - 6.5, dy = y - 6.5, d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) continue;
        let col = c.base;
        if (d > R - 1.1) col = '#1a1010';
        else if (d > R - 2.6) {
          const ang = Math.atan2(dy, dx) + Math.PI;
          col = Math.floor(ang / (Math.PI / 4)) % 2 ? c.edge : c.base;
        } else if (d > R - 3.4) col = shade(c.base, -0.18);
        ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(4, 3, 2, 1);
    });
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Random names that fit each avatar (Auntie, Makcik and Office Girl get female names only)
  const NAMES = {
    ahpek: ['Uncle Lim', 'Uncle Tan', 'Uncle Chong', 'Ah Pek Wong', 'Uncle Lee', 'Ah Kow', 'Uncle Ong', 'Ah Hock'],
    auntie: ['Auntie Mary', 'Auntie Lily', 'Auntie Rosie', 'Auntie Mei', 'Auntie Susan', 'Auntie Ah Lian', 'Auntie Jenny', 'Auntie Grace'],
    ahboy: ['Ah Boy', 'Ah Beng', 'Ah Seng', 'Kok Wai', 'Jun Hao', 'Wei Jie', 'Ah Keong', 'Kenny'],
    makcik: ['Makcik Kiah', 'Makcik Timah', 'Makcik Som', 'Kak Ros', 'Makcik Esah', 'Kak Yati', 'Makcik Gayah', 'Kak Wani'],
    anneh: ['Anneh Muthu', 'Raju', 'Anand', 'Ravi', 'Siva', 'Kumar', 'Bala', 'Anneh Mani'],
    officegirl: ['Mei Ling', 'Siti', 'Jessica', 'Nurul', 'Priya', 'Farah', 'Su Lin', 'Kavitha', 'Sharon', 'Aishah'],
    rider: ['Abang Mat', 'Zul', 'Hafiz', 'Amir', 'Abang Din', 'Faiz', 'Abang Lan', 'Izwan'],
    kucing: ['Oyen', 'Comot', 'Tompok', 'Bulu', 'Kiki', 'Gemok', 'Mimi', 'Si Belang'],
  };
  function randomName(avatar, avoid) {
    const list = NAMES[avatar] || NAMES.ahboy;
    const free = list.filter(n => !(avoid && (avoid.has ? avoid.has(n) : avoid.includes(n))));
    const pool = free.length ? free : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const api = { NAMES, randomName, AVATARS, DRINKS, SUITS, SUIT_PAL, CHIPS, avatarRows, blinkRows, drawGrid, avatarSheet, avatarStill, drink, suit, chip, shade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SPR = api;
})(this);
