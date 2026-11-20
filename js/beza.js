/* Kopitiam 21 — Cari Beza (spot the difference): two kopitiam pictures, 5 things changed.
   Everyone hunts at the same time; first to tap a difference gets it (+10), a wrong tap costs 2.
   5 rounds. Host engine: it builds both pictures as object lists, so every browser draws the same thing,
   and it checks every tap. Picture space is 160 × 100 units. */
(function (root) {
  'use strict';

  const SW = 160, SH = 100;
  const SIZE = {
    window: [34, 26], clock: [12, 12], calendar: [12, 14], menu: [30, 24], fan: [26, 6], lamp: [8, 13], poster: [16, 20],
    cup: [10, 9], plate: [18, 6], bottle: [5, 12], napkin: [10, 7], bowl: [10, 7], cat: [14, 12], chair: [14, 22], plant: [12, 20], fly: [4, 3], tissue: [6, 5],
  };
  const V = {
    window: ['red', 'green', 'blue', 'none'], lamp: ['warm', 'off', 'green'], poster: ['red', 'blue', 'green', 'yellow'],
    cup: ['kopi', 'teh', 'milo', 'sirap'], plate: ['nasi', 'roti', 'mee', 'kosong'], bottle: ['chili', 'soy', 'yellow'],
    napkin: ['pink', 'blue', 'white'], bowl: ['telur', 'empty'], cat: ['orange', 'grey', 'black'], chair: ['red', 'blue', 'green'],
    plant: ['red', 'yellow', 'none'], tissue: ['white'],
  };
  const box = o => { const s = SIZE[o.k]; return [o.x, o.y, s[0], s[1]]; };

  const LINES = {
    found: ['Jumpa!', 'Sana!', 'Nampak!', 'Mata helang!'],
    miss: ['Eh, sama je...', 'Salah!', 'Mana ada beza?'],
    win: ['Mata paling tajam!', 'Raja Cari Beza!', 'Huat ah!'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const COL = ['#e74c3c', '#3d6fd1', '#3fae6a', '#f6c744', '#b45ad1', '#f08a3a'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);
  const ROUNDS = 5, DIFFS = 5, MAX = 6, ROUND_SEC = 60, PTS = 10, MISS = -2;

  class Table {
    constructor(o) {
      o = o || {};
      this.rng = o.rng || Math.random;
      this.now = o.now || (() => Date.now());
      this.setT = o.setTimeout || ((f, ms) => setTimeout(f, ms));
      this.clrT = o.clearTimeout || (t => clearTimeout(t));
      this.onChange = o.onChange || (() => {});
      this.onFx = o.onFx || (() => {});
      this.gen = 0; this.timer = null; this.timerId = 0;
      this.s = {
        game: 'beza', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], rnd: 0, rounds: ROUNDS, round: 0, a: null, b: null, diffs: [], ranking: null, winner: null, log: [],
      };
    }
    rnd(a, b) { return a + this.rng() * (b - a); }
    int(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
    pick(a) { return a[Math.floor(this.rng() * a.length)]; }
    changed() { this.onChange(); }
    fx(f) { this.onFx(f); }
    say(pid, k, mood) { if (pid) this.fx({ type: 'say', pid, text: this.pick(LINES[k]), mood: mood || 'neutral' }); }
    log(t) { this.s.log.push({ t }); if (this.s.log.length > 30) this.s.log.shift(); }
    step(fn, ms) { const g = this.gen; return this.setT(() => { if (g === this.gen) fn(); }, ms); }
    setTimer(kind, sec, fn) {
      this.clearTimer();
      this.timerId++; this.timerKind = kind; this.timerTotal = sec * 1000; this.timerEnd = this.now() + sec * 1000;
      const g = this.gen;
      this.timer = this.setT(() => { if (g !== this.gen) return; this.timer = null; this.timerKind = null; fn(); }, sec * 1000);
    }
    clearTimer() { if (this.timer) this.clrT(this.timer); this.timer = null; this.timerKind = null; }
    p(id) { return this.s.players.find(x => x.id === id); }
    inGame() { return this.s.players.filter(p => p.inGame); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Cari Beza is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const used = new Set(this.s.players.map(p => p.col));
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', col: COL.find(c => !used.has(c)) || COL[0], connected: true, isBot: !!info.isBot, inGame: !late, score: 0, found: 0, miss: 0, wins: 0 };
      this.s.players.push(pl);
      this.log(pl.name + (late ? ' masuk (next game)' : ' masuk'));
      this.changed();
      return { ok: true };
    }
    addBot() {
      const used = new Set(this.s.players.map(p => p.name));
      const avatar = this.pick(AV), S = typeof root !== 'undefined' && root.SPR;
      const name = (S && S.randomName) ? S.randomName(avatar, used) : ['Uncle Lim', 'Kak Ros', 'Ah Seng', 'Muthu', 'Mei Ling'].find(n => !used.has(n)) || 'Bot';
      return this.addPlayer({ id: 'bot-' + Math.floor(this.rng() * 1e9).toString(36), name, avatar, isBot: true });
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline'); }
      this.changed();
    }
    kick(id) { if (id === this.s.hostId) return; this.s.players = this.s.players.filter(x => x.id !== id); this.changed(); }

    // ---------- the picture ----------
    makeScene() {
      const o = [];
      const add = (k, x, y, v, extra) => { const it = Object.assign({ id: 'o' + o.length, k, x: Math.round(x), y: Math.round(y) }, v != null ? { v } : {}, extra || {}); o.push(it); return it; };
      // wall: window, menu, clock, calendar, poster in shuffled slots
      const slots = [[6, 8], [46, 6], [86, 8], [124, 6]];
      for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
      add('window', slots[0][0], slots[0][1] + 2, this.pick(V.window));
      add('menu', slots[1][0], slots[1][1] + 2, null, { prices: [this.pick([150, 180, 200]), this.pick([220, 250, 300]), this.pick([350, 450, 550])] });
      add('poster', slots[2][0] + 6, slots[2][1] + 3, this.pick(V.poster));
      add('clock', slots[3][0] + 4, slots[3][1] + 2, null, { h: this.int(1, 12) });
      add('calendar', slots[3][0] + 20, slots[3][1] + 10, null, { n: this.int(1, 28) });
      add('fan', this.rnd(30, 104), 0);
      add('lamp', this.rnd(8, 148), 0, this.pick(V.lamp));
      // chairs and the table
      add('chair', this.rnd(6, 14), 56, this.pick(V.chair));
      add('chair', this.rnd(134, 142), 56, this.pick(V.chair));
      // things on the table (table top at y 62, x 34..126)
      let x = 38 + this.rnd(0, 4);
      const onTable = ['cup', 'plate', 'bottle', 'cup', 'napkin', 'plate', 'bowl', 'cup', 'bottle'];
      for (let i = onTable.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [onTable[i], onTable[j]] = [onTable[j], onTable[i]]; }
      for (const k of onTable) {
        const w = SIZE[k][0];
        if (x + w > 124) break;
        add(k, x, 62 - SIZE[k][1], this.pick(V[k]));
        x += w + this.rnd(2, 5);
      }
      // floor
      add('cat', this.rnd(24, 120), 86, this.pick(V.cat));
      add('plant', this.pick([this.rnd(2, 8), this.rnd(146, 148)]), 70, this.pick(V.plant.slice(0, 2)));
      if (this.rng() < 0.6) add('tissue', this.rnd(30, 120), 93, 'white');
      return o;
    }
    // copy the picture and change DIFFS things
    makeDiffs(a) {
      const b = a.map(o => Object.assign({}, o, o.prices ? { prices: o.prices.slice() } : {}));
      const diffs = [];
      const cand = b.filter(o => o.k !== 'tissue' || true);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      const used = new Set();
      const ovl = (p, q) => p[0] < q[0] + q[2] && p[0] + p[2] > q[0] && p[1] < q[1] + q[3] && p[1] + p[3] > q[1];
      const addDiff = (bx, what) => { diffs.push({ id: 'd' + diffs.length, box: [bx[0] - 2, bx[1] - 2, bx[2] + 4, bx[3] + 4], what }); };
      for (const o of cand) {
        if (diffs.length >= DIFFS) break;
        const bx = box(o);
        if (diffs.some(d => ovl(d.box, bx))) continue;
        const ia = a.find(q => q.id === o.id);
        const opts = [];
        if (V[o.k] && V[o.k].length > 1) opts.push('col');
        if (['cup', 'bottle', 'napkin', 'bowl', 'cat', 'plant', 'lamp', 'poster', 'tissue', 'fan'].includes(o.k)) opts.push('gone');
        if (o.k === 'clock') opts.push('clock');
        if (o.k === 'calendar') opts.push('num');
        if (o.k === 'menu') opts.push('price');
        if (o.k === 'cat' || o.k === 'chair') opts.push('move');
        if (!opts.length) continue;
        const kind = this.pick(opts);
        if (kind === 'col') { const vs = V[o.k].filter(v => v !== o.v); o.v = this.pick(vs); }
        else if (kind === 'gone') o.gone = true;
        else if (kind === 'clock') o.h = (o.h + this.int(3, 8) - 1) % 12 + 1;
        else if (kind === 'num') o.n = o.n + (o.n > 20 ? -this.int(3, 9) : this.int(3, 9));
        else if (kind === 'price') { const i = this.int(0, 2); o.prices[i] += this.pick([-50, 50, 100]); if (o.prices[i] < 100) o.prices[i] = 400; }
        else if (kind === 'move') o.x = Math.max(2, Math.min(SW - SIZE[o.k][0] - 2, o.x + this.pick([-14, -10, 10, 14])));
        const bA = box(ia), bB = box(o);
        const x0 = Math.min(bA[0], bB[0]), y0 = Math.min(bA[1], bB[1]), x1 = Math.max(bA[0] + bA[2], bB[0] + bB[2]), y1 = Math.max(bA[1] + bA[3], bB[1] + bB[3]);
        addDiff([x0, y0, x1 - x0, y1 - y0], kind + ':' + o.k);
        used.add(o.id);
      }
      // a fly that is only in one picture, if we're short
      while (diffs.length < DIFFS) {
        const f = { id: 'x' + diffs.length, k: 'fly', x: Math.round(this.rnd(40, 118)), y: Math.round(this.rnd(66, 80)) };
        const bx = box(f);
        if (diffs.some(d => ovl(d.box, [bx[0] - 3, bx[1] - 3, bx[2] + 6, bx[3] + 6]))) continue;
        (this.rng() < 0.5 ? a : b).push(f);
        addDiff(bx, 'add:fly');
      }
      return { b, diffs };
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.score = 0; p.found = 0; p.miss = 0; }
      S.round++; S.rnd = 0; S.ranking = null; S.winner = null;
      this.log('Game ' + S.round + ' · ' + S.players.length + ' players');
      this.nextRound();
    }
    nextRound() {
      const S = this.s;
      S.rnd++;
      if (S.rnd > ROUNDS) { this.finish(); return; }
      const a = this.makeScene();
      const { b, diffs } = this.makeDiffs(a);
      S.a = a; S.b = b;
      this._diffs = diffs;
      S.diffs = diffs.map(d => ({ id: d.id, by: null }));   // where they are stays secret until found
      S.phase = 'ready';
      this.fx({ type: 'banner', text: 'GAMBAR ' + S.rnd + '/' + ROUNDS, style: 'info' });
      this.setTimer('ready', 2.5, () => this.play());
      this.changed();
    }
    play() {
      const S = this.s;
      S.phase = 'play';
      this.setTimer('play', ROUND_SEC, () => this.endRound());
      for (const p of this.inGame()) if (p.isBot) this.planBot(p);
      this.changed();
    }
    tap(pid, m) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'play' || !pl || !pl.inGame) return;
      const now = this.now();
      if (pl._cool && now < pl._cool) return;
      const x = +m.x, y = +m.y; if (!isFinite(x) || !isFinite(y)) return;
      const hit = this._diffs.find((d, i) => !S.diffs[i].by && x >= d.box[0] - 3 && x <= d.box[0] + d.box[2] + 3 && y >= d.box[1] - 3 && y <= d.box[1] + d.box[3] + 3);
      if (hit) {
        const i = this._diffs.indexOf(hit);
        S.diffs[i] = { id: hit.id, by: pid, box: hit.box };
        pl.score += PTS; pl.found++;
        this.fx({ type: 'found', pid, id: hit.id, box: hit.box });
        if (this.rng() < 0.3) this.say(pid, 'found', 'happy');
        if (S.diffs.every(d => d.by)) { this.clearTimer(); this.step(() => this.endRound(), 900); }
      } else {
        // already found by someone? no penalty, just late
        const late = this._diffs.find((d, i) => S.diffs[i].by && x >= d.box[0] - 3 && x <= d.box[0] + d.box[2] + 3 && y >= d.box[1] - 3 && y <= d.box[1] + d.box[3] + 3);
        if (!late) { pl.score += MISS; pl.miss++; pl._cool = now + 900; }
        this.fx({ type: 'miss', pid, x, y, late: !!late });
      }
      this.changed();
    }
    endRound() {
      const S = this.s;
      if (S.phase !== 'play') return;
      this.clearTimer();
      S.phase = 'break';
      // show the ones nobody found
      S.diffs = this._diffs.map((d, i) => ({ id: d.id, by: S.diffs[i].by, box: d.box }));
      const left = S.diffs.filter(d => !d.by).length;
      this.fx({ type: 'roundEnd', left });
      this.log('Gambar ' + S.rnd + ' habis' + (left ? ' · ' + left + ' tak jumpa' : ' · semua jumpa!'));
      this.setTimer('break', 5, () => this.nextRound());
      this.changed();
    }
    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over';
      const r = this.inGame().slice().sort((a, b) => b.score - a.score || b.found - a.found);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, found: p.found, miss: p.miss }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.score : '-'));
      this.changed();
    }
    planBot(pl) {
      const S = this.s, rnd = S.rnd;
      const speed = this.rnd(0.7, 1.4);
      this._diffs.forEach((d, i) => {
        if (this.rng() < 0.25) return;           // some they never spot
        const at = (6 + this.rng() * 40) * speed * 1000;
        this.step(() => {
          if (S.phase !== 'play' || S.rnd !== rnd || S.diffs[i].by) return;
          if (this.rng() < 0.12) this.tap(pl.id, { x: this.rnd(5, 155), y: this.rnd(5, 95) });
          else this.tap(pl.id, { x: d.box[0] + d.box[2] / 2, y: d.box[1] + d.box[3] / 2 });
        }, at);
      });
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'tap') return this.tap(id, m);
      if (m.t === 'emote') {
        const pl = this.p(id); if (!pl) return;
        const now = this.now(); if (pl._le && now - pl._le < 1200) return; pl._le = now;
        const text = String(m.text || '').slice(0, 24); if (text) this.fx({ type: 'emote', pid: id, text });
        return;
      }
      if (id !== this.s.hostId) return;
      if (m.t === 'start' || m.t === 'newGame') return this.start();
      if (m.t === 'addBot') return this.addBot();
      if (m.t === 'kick') return this.kick(m.id);
    }
    publicState() {
      const out = JSON.parse(JSON.stringify(this.s, (k, v) => (k.startsWith('_') ? undefined : v)));
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
  }

  const api = { Table, SW, SH, SIZE, box, ROUNDS, DIFFS, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BEZA = api;
})(this);
