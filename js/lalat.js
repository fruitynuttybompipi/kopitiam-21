/* Kopitiam 21 — Lalat Hunt: flies land on the kopitiam table, everyone races to swat them with a selipar.
   Don't hit the plates or the cat. 3 rounds of 30 s. Host engine.
   The host plans every fly's whole path at the start of a round and publishes it; every browser plays the
   same paths against the host clock, and the host checks each swat against the plan. */
(function (root) {
  'use strict';

  const TW = 1.6, TH = 1;                 // table size (long side x)
  const ROUND_MS = 30000, ROUNDS = 3, MAX = 6;
  const KIND = {
    fly: { pts: 10, r: 0.05, speed: 0.55, land: [1100, 1700] },
    langau: { pts: 25, r: 0.06, speed: 0.38, land: [800, 1200] },
    gold: { pts: 50, r: 0.05, speed: 1.0, land: [550, 800] },
  };
  const OOPS = { plate: -15, cup: -15, cat: -30 };
  const GRACE = 450;                       // ms after take-off a swat still counts (network lag)

  // shared helpers (view + host)
  function flyPos(f, t) {
    if (t < f.ts || t > f.te) return null;
    for (const g of f.legs) {
      if (t < g.t0 || t > g.t1) continue;
      if (g.a === 'l') return { x: g.x, y: g.y, landed: true, leg: g };
      const u = (t - g.t0) / (g.t1 - g.t0);
      const dx = g.x1 - g.x0, dy = g.y1 - g.y0, len = Math.hypot(dx, dy) || 1;
      const amp = Math.sin(u * Math.PI) * g.w * Math.sin(u * Math.PI * g.k + g.p);
      return { x: g.x0 + dx * u - dy / len * amp, y: g.y0 + dy * u + dx / len * amp, landed: false, ang: Math.atan2(dy, dx), leg: g };
    }
    return null;
  }
  // the cat: sits in a corner, or (round 3) strolls across the table and back
  function catPos(lay, t) {
    const c = lay.cat; if (!c) return null;
    if (!c.walk) return { x: c.x, y: c.y };
    const per = c.walk, k = ((t % per) + per) % per / per;
    const u = k < 0.5 ? k * 2 : 2 - k * 2;               // there and back
    const e = u < 0.15 ? 0 : u > 0.85 ? 1 : (u - 0.15) / 0.7; // pauses at each end
    return { x: c.x + (c.x2 - c.x) * e, y: c.y + (c.y2 - c.y) * e + Math.sin(e * Math.PI) * 0.12 };
  }
  // what is under (x, y) at time t: a landed fly first, then the cat, plates and cups
  function hitTest(s, x, y, t, slack) {
    slack = slack || 0;
    let best = null, bd = 1e9;
    for (const f of s.flies || []) {
      if (s.dead && s.dead[f.id]) continue;
      const p = flyPos(f, t); if (!p || !p.landed) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < KIND[f.k].r + slack && d < bd) { bd = d; best = { tgt: 'fly', fid: f.id }; }
    }
    if (best) return best;
    const lay = s.layout; if (!lay) return { tgt: 'none' };
    const c = catPos(lay, t);
    if (c && Math.hypot(c.x - x, c.y - y) < 0.085) return { tgt: 'cat' };
    for (const p of lay.plates) if (Math.hypot(p.x - x, p.y - y) < p.r) return { tgt: p.cup ? 'cup' : 'plate', id: p.id };
    return { tgt: 'none' };
  }

  const LINES = {
    kill: ['Mampus!', 'Kena!', 'Pap!', 'Rasakan selipar ni!', 'Satu lagi!'],
    gold: ['LALAT EMAS!', 'Jackpot!', 'Huat ah!'],
    plate: ['Pecah pinggan!', 'Alamak nasi lemak!', 'Aiyo, tumpah kuah!'],
    cup: ['Kopi tumpah!', 'Habis kopi aku!'],
    cat: ['MEOWRR!', 'Sorry kucing!', 'Ouch, cakar!'],
    win: ['Raja Lalat!', 'Selipar sakti!', 'Pembunuh lalat no. 1!'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const COL = ['#e74c3c', '#3d6fd1', '#3fae6a', '#f6c744', '#b45ad1', '#f08a3a'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);

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
        game: 'lalat', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], rnd: 0, rounds: ROUNDS, round: 0, t0: 0, dur: ROUND_MS, flies: [], dead: {}, layout: null,
        ranking: null, winner: null, log: [],
      };
    }
    rnd(a, b) { return a + this.rng() * (b - a); }
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
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Lalat Hunt is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const used = new Set(this.s.players.map(p => p.col));
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', col: COL.find(c => !used.has(c)) || COL[0], connected: true, isBot: !!info.isBot, inGame: !late, score: 0, kills: 0, oops: 0, wins: 0 };
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

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.score = 0; p.kills = 0; p.oops = 0; p.roundKills = 0; }
      S.round++; S.rnd = 0; S.ranking = null; S.winner = null;
      this.log('Game ' + S.round + ' · ' + S.players.length + ' players');
      this.nextRound();
    }
    nextRound() {
      const S = this.s;
      S.rnd++;
      if (S.rnd > ROUNDS) { this.finish(); return; }
      S.layout = this.makeLayout(S.rnd);
      S.flies = []; S.dead = {};
      for (const p of S.players) p.roundKills = 0;
      S.phase = 'ready';
      S.t0 = this.now() + 3000;
      this.fx({ type: 'banner', text: 'ROUND ' + S.rnd + '/' + ROUNDS, style: 'info' });
      this.setTimer('ready', 3, () => this.play());
      this.changed();
    }
    play() {
      const S = this.s;
      S.phase = 'play';
      S.t0 = this.now();
      S.flies = this.makeFlies(S.rnd, S.layout);
      S.fkey = S.round + ':' + S.rnd;
      this.fx({ type: 'banner', text: S.rnd === 3 ? 'SWARM!' : 'PAP!', style: 'win' });
      this.setTimer('play', ROUND_MS / 1000, () => this.endRound());
      for (const p of this.inGame()) if (p.isBot) this.planBot(p);
      this.changed();
    }
    endRound() {
      const S = this.s;
      S.phase = 'break';
      const best = this.inGame().slice().sort((a, b) => b.roundKills - a.roundKills)[0];
      this.fx({ type: 'roundEnd', rnd: S.rnd, best: best && best.roundKills ? best.id : null });
      this.log('Round ' + S.rnd + ' habis' + (best && best.roundKills ? ' · ' + best.name + ' ' + best.roundKills + ' lalat' : ''));
      this.setTimer('break', 4, () => this.nextRound());
      this.changed();
    }
    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.flies = []; S.dead = {};
      const r = this.inGame().slice().sort((a, b) => b.score - a.score || b.kills - a.kills);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, kills: p.kills, oops: p.oops }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' RAJA LALAT!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.score : '-'));
      this.changed();
    }

    // ---------- the table: plates, cups and the cat ----------
    makeLayout(rnd) {
      const plates = [];
      const n = rnd === 1 ? 3 : 4, cups = rnd === 1 ? 2 : 3;
      const foods = ['nasilemak', 'roticanai', 'ckt', 'mee', 'rojak'];
      const place = (r, tries) => {
        for (let i = 0; i < (tries || 60); i++) {
          const x = this.rnd(0.12 + r, TW - 0.12 - r), y = this.rnd(0.1 + r, TH - 0.1 - r);
          if (plates.every(p => Math.hypot(p.x - x, p.y - y) > p.r + r + 0.05)) return { x, y };
        }
        return null;
      };
      for (let i = 0; i < n; i++) { const r = this.rnd(0.1, 0.12), at = place(r); if (at) plates.push({ id: 'p' + i, x: at.x, y: at.y, r, food: this.pick(foods) }); }
      for (let i = 0; i < cups; i++) { const r = 0.055, at = place(r); if (at) plates.push({ id: 'c' + i, x: at.x, y: at.y, r, cup: true, drink: this.pick(['kopi', 'teh', 'milo']) }); }
      let cat;
      if (rnd === 3) cat = { x: 0.15, y: 0.25, x2: TW - 0.15, y2: 0.75, walk: 14000 };
      else { const corner = this.pick([[0.14, 0.16], [TW - 0.14, 0.16], [0.14, TH - 0.16], [TW - 0.14, TH - 0.16]]); cat = { x: corner[0], y: corner[1] }; }
      return { plates, cat };
    }

    // plan every fly for the round
    makeFlies(rnd, lay) {
      const flies = [];
      const count = rnd === 1 ? 11 : rnd === 2 ? 17 : 28;
      const span = ROUND_MS - 2500;
      for (let i = 0; i < count; i++) {
        const r = this.rng();
        const k = r < (rnd === 1 ? 0.06 : 0.09) ? 'gold' : r < (rnd === 1 ? 0.25 : 0.33) ? 'langau' : 'fly';
        const K = KIND[k];
        const ts = Math.round(400 + (i / count) * span * 0.9 + this.rnd(0, span * 0.1));
        const edge = () => { const s = Math.floor(this.rng() * 4); return s === 0 ? [-0.08, this.rnd(0, TH)] : s === 1 ? [TW + 0.08, this.rnd(0, TH)] : s === 2 ? [this.rnd(0, TW), -0.08] : [this.rnd(0, TW), TH + 0.08]; };
        let [x, y] = edge(), t = ts;
        const legs = [];
        const stops = 1 + Math.floor(this.rng() * (rnd === 1 ? 2 : 3));
        for (let j = 0; j < stops; j++) {
          // where to land: on food, next to the cat, or anywhere
          let lx, ly;
          const q = this.rng();
          if (q < 0.45 && lay.plates.length) { const p = this.pick(lay.plates); const a = this.rnd(0, Math.PI * 2), d = this.rnd(0, p.r * 0.7); lx = p.x + Math.cos(a) * d; ly = p.y + Math.sin(a) * d; }
          else if (q < 0.62) { const c = catPos(lay, t + 1500) || { x: 0.8, y: 0.5 }; const a = this.rnd(0, Math.PI * 2); lx = c.x + Math.cos(a) * 0.13; ly = c.y + Math.sin(a) * 0.13; }
          else { lx = this.rnd(0.08, TW - 0.08); ly = this.rnd(0.08, TH - 0.08); }
          lx = Math.max(0.05, Math.min(TW - 0.05, lx)); ly = Math.max(0.05, Math.min(TH - 0.05, ly));
          const dist = Math.hypot(lx - x, ly - y);
          const ft = Math.round(dist / K.speed * 1000 * this.rnd(0.9, 1.25) + 250);
          legs.push({ a: 'f', t0: t, t1: t + ft, x0: x, y0: y, x1: lx, y1: ly, w: this.rnd(0.03, k === 'langau' ? 0.12 : 0.08), k: Math.round(this.rnd(2, 5)), p: this.rnd(0, 6) });
          t += ft;
          const shrink = rnd === 3 ? 0.85 : 1;
          const lt = Math.round(this.rnd(K.land[0], K.land[1]) * shrink);
          legs.push({ a: 'l', t0: t, t1: t + lt, x: lx, y: ly });
          t += lt; x = lx; y = ly;
        }
        const [ex, ey] = edge();
        const ft = Math.round(Math.hypot(ex - x, ey - y) / K.speed * 1000 * 0.9 + 150);
        legs.push({ a: 'f', t0: t, t1: t + ft, x0: x, y0: y, x1: ex, y1: ey, w: 0.06, k: 3, p: this.rnd(0, 6) });
        t += ft;
        flies.push({ id: 'f' + rnd + '-' + i, k, ts, te: t, legs: legs.map(g => { const o = {}; for (const key in g) o[key] = typeof g[key] === 'number' && !Number.isInteger(g[key]) ? Math.round(g[key] * 1000) / 1000 : g[key]; return o; }) });
      }
      return flies;
    }

    // ---------- swats ----------
    swat(pid, m) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'play' || !pl || !pl.inGame) return;
      const now = this.now(), t = now - S.t0;
      if (pl._stun && now < pl._stun) return;
      if (pl._last && now - pl._last < 150) return;
      pl._last = now;
      const x = +m.x, y = +m.y; if (!isFinite(x) || !isFinite(y)) return;
      if (m.tgt === 'fly') {
        const f = S.flies.find(q => q.id === m.fid);
        if (f && !S.dead[f.id]) {
          // was it sitting there just now (allowing for lag)?
          const ok = f.legs.some(g => g.a === 'l' && t >= g.t0 - 150 && t <= g.t1 + GRACE && Math.hypot(g.x - x, g.y - y) < KIND[f.k].r * 2.2);
          if (ok) {
            const pts = KIND[f.k].pts;
            S.dead[f.id] = pid; pl.score += pts; pl.kills++; pl.roundKills++;
            const g = f.legs.find(q => q.a === 'l' && t >= q.t0 - 150 && t <= q.t1 + GRACE);
            this.fx({ type: 'kill', pid, fid: f.id, k: f.k, pts, x: g.x, y: g.y });
            if (f.k === 'gold') this.say(pid, 'gold', 'happy'); else if (this.rng() < 0.15) this.say(pid, 'kill', 'happy');
            this.changed();
            return;
          }
        }
        this.fx({ type: 'slap', pid, x, y, late: !!(f && S.dead[f.id]) });
        return;
      }
      const real = hitTest(S, x, y, t, 0.01);
      const tgt = m.tgt === 'cat' || m.tgt === 'plate' || m.tgt === 'cup' ? m.tgt : real.tgt === 'fly' ? 'none' : real.tgt;
      if (tgt === 'cat' || tgt === 'plate' || tgt === 'cup') {
        const pts = OOPS[tgt];
        pl.score += pts; pl.oops++;
        if (tgt === 'cat') pl._stun = now + 1000;
        this.fx({ type: 'oops', pid, tgt, pts, x, y, id: m.id || real.id });
        this.say(pid, tgt, 'sad');
        this.changed();
        return;
      }
      this.fx({ type: 'slap', pid, x, y });
    }

    // bots go for some of the landings, a bit slower than a sharp human
    planBot(pl) {
      const S = this.s, rnd = S.rnd, skill = this.rnd(0.35, 0.6);
      for (const f of S.flies) for (const g of f.legs) {
        if (g.a !== 'l' || this.rng() > skill) continue;
        const at = g.t0 + this.rnd(350, 1100);
        this.step(() => {
          if (S.phase !== 'play' || S.rnd !== rnd || S.dead[f.id]) return;
          const t = this.now() - S.t0;
          if (t > g.t1) { this.swat(pl.id, { x: g.x + this.rnd(-0.03, 0.03), y: g.y + this.rnd(-0.03, 0.03), tgt: 'none' }); return; }
          if (this.rng() < 0.06) { const hit = hitTest(S, g.x, g.y, t); if (hit.tgt === 'fly') this.swat(pl.id, { x: g.x, y: g.y, tgt: 'plate' }); return; }
          this.swat(pl.id, { x: g.x, y: g.y, tgt: 'fly', fid: f.id });
        }, Math.max(0, S.t0 + at - this.now()));
      }
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'swat') return this.swat(id, m);
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
      out.clock = this.now();
      // the fly plan is big and never changes during a round: send it now and then, browsers keep it by fkey
      if (out.flies && out.flies.length) {
        if (this._fk === out.fkey && out.clock - this._fsent < 2500) delete out.flies;
        else { this._fk = out.fkey; this._fsent = out.clock; }
      }
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
  }

  const api = { Table, KIND, OOPS, TW, TH, ROUNDS, MAX, flyPos, catPos, hitTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LALAT = api;
})(this);
