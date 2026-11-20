/* Kopitiam 21 — Ais Kacang Tower: take turns dropping toppings on a mountain of shaved ice.
   The topping swings across the top; tap to drop it. Lean too far and the tower tumbles —
   whoever makes it runtuh is out. Last one standing wins (alone: build as high as you can).
   Host engine. The swing is a fixed formula from the turn start, so every browser sees the same swing. */
(function (root) {
  'use strict';

  // width / height in bowl units (the bowl is 1.0 wide)
  const KINDS = {
    kacang: { w: 0.5, h: 0.075, label: 'KACANG MERAH' },
    jagung: { w: 0.44, h: 0.07, label: 'JAGUNG' },
    cendol: { w: 0.4, h: 0.08, label: 'CENDOL' },
    jelly: { w: 0.34, h: 0.09, label: 'JELLY' },
    atapchee: { w: 0.3, h: 0.08, label: 'ATAP CHEE' },
    aiskrim: { w: 0.27, h: 0.12, label: 'AISKRIM' },
  };
  const BASE = { w: 0.86, h: 0.16 };            // the shaved-ice mountain
  const SWING = 0.42;                            // topping swings ±SWING across the top
  const omega = n => 1.7 + n * 0.13;             // faster as the tower grows
  const swingX = (n, phase, t) => SWING * Math.sin(omega(n) * t / 1000 + phase);
  const SLIP = 0.03;                             // a little give: syrup is sticky

  // will this stack stand? returns { ok, fall: 'slide'|'topple', level, lean }
  function check(stack) {
    // stack[0] is the ice; stack[i] = { k, x }
    const W = i => (i === 0 ? BASE.w : KINDS[stack[i].k].w);
    const M = i => (i === 0 ? 99 : KINDS[stack[i].k].w * KINDS[stack[i].k].h);
    const top = stack.length - 1;
    if (top >= 1 && Math.abs(stack[top].x - stack[top - 1].x) > W(top - 1) / 2 + SLIP) return { ok: false, fall: 'slide', level: top, lean: 1 };
    let lean = 0;
    for (let j = top; j >= 1; j--) {
      let m = 0, mx = 0;
      for (let i = j; i <= top; i++) { m += M(i); mx += M(i) * stack[i].x; }
      const com = mx / m, half = W(j - 1) / 2 + SLIP;
      const r = Math.abs(com - stack[j - 1].x) / half;
      if (r > 1) return { ok: false, fall: 'topple', level: j, lean: 1, dir: Math.sign(com - stack[j - 1].x) };
      lean = Math.max(lean, r);
    }
    return { ok: true, lean };
  }

  const LINES = {
    good: ['Cun!', 'Steady!', 'Tangan tukang!', 'Lurus!'],
    risky: ['Eh, senget tu!', 'Hati-hati...', 'Goyang goyang...', 'Alamak, nak jatuh!'],
    fall: ['RUNTUH!', 'Habis ais kacang!', 'Aiyo, mangkuk tumpah!', 'Belanja ABC satu!'],
    laugh: ['Hahaha!', 'Lap meja!', 'Siapa nak makan ni?'],
    slow: ['Cepat lah!', 'Ais dah cair!'],
    win: ['Raja ABC!', 'Tukang ais kacang no. 1!', 'Huat ah!'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);
  const MAX = 6, TURN_SEC = 10;

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
        game: 'kacang', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], order: [], round: 0, bowl: 0, stack: [], turn: null, last: null, outOrder: [], solo: false,
        ranking: null, winner: null, best: 0, log: [],
      };
    }
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
    alive() { return this.s.order.map(id => this.p(id)).filter(p => p && !p.out); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Ais Kacang Tower is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', connected: true, isBot: !!info.isBot, inGame: !late, out: false, placed: 0, wins: 0 };
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
      else {
        pl.connected = false; this.log(pl.name + ' offline');
        const tr = this.s.turn;
        if (this.s.phase === 'turn' && tr && tr.pid === id) this.step(() => { if (this.s.turn === tr && this.s.phase === 'turn') this.autoDrop(); }, 1500);
      }
      this.changed();
    }
    kick(id) {
      if (id === this.s.hostId) return;
      const tr = this.s.turn, mid = this.s.phase === 'turn' && tr && tr.pid === id;
      this.s.players = this.s.players.filter(x => x.id !== id);
      this.s.order = this.s.order.filter(x => x !== id);
      if (mid) { this.clearTimer(); this.nextTurn(); }
      this.changed();
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.out = false; p.placed = 0; }
      S.order = S.players.map(p => p.id);
      for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; }
      S.round++; S.bowl = 0; S.outOrder = []; S.ranking = null; S.winner = null; S.solo = S.order.length === 1; S.best = 0;
      S.idx = 0;
      this.log('Game ' + S.round + ' · ' + S.order.length + ' players');
      if (!S.solo) {
        S.phase = 'pick';
        this.fx({ type: 'pick', id: S.order[0], candidates: S.order.slice(), title: 'SIAPA LETAK DULU?', label: 'MULA' });
        this.changed();
        this.step(() => this.newBowl(), 3400);
      } else this.newBowl();
    }
    newBowl() {
      const S = this.s;
      S.bowl++;
      S.stack = [{ k: 'ice', x: 0 }];
      S.last = null;
      this.fx({ type: 'banner', text: S.bowl === 1 ? 'AIS KACANG!' : 'MANGKUK BARU!', style: 'info' });
      this.beginTurn();
    }
    nextKind(n) {
      // the higher it gets, the more small and tricky toppings show up
      const pool = n < 3 ? ['kacang', 'jagung', 'cendol', 'kacang', 'jagung'] : n < 7 ? ['kacang', 'jagung', 'cendol', 'jelly', 'atapchee'] : ['jagung', 'cendol', 'jelly', 'atapchee', 'aiskrim', 'aiskrim'];
      return this.pick(pool);
    }
    beginTurn() {
      const S = this.s;
      const al = this.alive();
      if (!al.length) { this.finish(); return; }
      S.idx = S.idx % S.order.length;
      while (this.p(S.order[S.idx]) && this.p(S.order[S.idx]).out) S.idx = (S.idx + 1) % S.order.length;
      const pid = S.order[S.idx];
      const pl = this.p(pid);
      if (!pl) { S.idx++; this.beginTurn(); return; }
      const n = S.stack.length - 1;
      S.turn = { id: (S.turn ? S.turn.id : 0) + 1, pid, k: this.nextKind(n), n, phase: Math.round(this.rng() * 628) / 100, t0: this.now() + 400 };
      S.phase = 'turn';
      this.fx({ type: 'turn', pid });
      this.setTimer('turn', TURN_SEC, () => { this.say(pid, 'slow', 'sad'); this.autoDrop(); });
      if (pl.isBot) this.botAim(pid);
      else if (!pl.connected) this.step(() => this.autoDrop(), 1500);
      this.changed();
    }
    autoDrop() {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'turn' || !tr) return;
      this.drop(tr.pid, { id: tr.id, x: swingX(tr.n, tr.phase, this.now() - tr.t0) });
    }
    drop(pid, m) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'turn' || !tr || tr.pid !== pid || m.id !== tr.id) return;
      this.clearTimer();
      const x = Math.max(-SWING, Math.min(SWING, +m.x || 0));
      S.stack.push({ k: tr.k, x: Math.round(x * 1000) / 1000 });
      const res = check(S.stack);
      const pl = this.p(pid);
      S.last = { pid, x, ok: res.ok, fall: res.fall || null, level: res.level || 0, dir: res.dir || Math.sign(x - S.stack[S.stack.length - 2].x) || 1, lean: Math.round(res.lean * 100) / 100 };
      S.phase = 'drop';
      this.fx({ type: 'drop', pid, ok: res.ok, lean: res.lean });
      if (res.ok) {
        pl.placed++;
        S.best = Math.max(S.best, S.stack.length - 1);
        if (res.lean > 0.75) this.say(this.other(pid) || pid, 'risky');
        else if (this.rng() < 0.2) this.say(pid, 'good', 'happy');
        S.idx = (S.idx + 1) % S.order.length;
        this.changed();
        this.step(() => this.beginTurn(), 900);
        return;
      }
      // runtuh!
      this.fx({ type: 'runtuh', pid, fall: res.fall, level: res.level });
      this.fx({ type: 'banner', text: 'RUNTUH!', style: 'bust' });
      this.say(pid, 'fall', 'sad');
      this.step(() => { const o = this.alive().filter(p => p.id !== pid); if (o.length) this.say(this.pick(o).id, 'laugh', 'happy'); }, 900);
      this.log(pl.name + ' runtuh! · ' + (S.stack.length - 2) + ' tingkat');
      if (S.solo) { this.changed(); this.step(() => this.finish(), 2600); return; }
      pl.out = true; S.outOrder.push(pid);
      S.idx = (S.idx + 1) % S.order.length;
      this.changed();
      this.step(() => { if (this.alive().length <= 1) this.finish(); else this.newBowl(); }, 2800);
    }
    other(pid) { const o = this.alive().filter(p => p.id !== pid); return o.length ? this.pick(o).id : null; }

    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.turn = null;
      if (S.solo) {
        const p = this.p(S.order[0]);
        S.ranking = p ? [{ id: p.id, name: p.name, avatar: p.avatar, placed: p.placed }] : [];
        S.winner = p ? p.id : null;
        this.fx({ type: 'banner', text: S.best + ' TINGKAT!', style: 'win' });
      } else {
        const alive = this.alive();
        const order = alive.map(p => p.id).concat(S.outOrder.slice().reverse());
        S.ranking = order.map(id => this.p(id)).filter(Boolean).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, placed: p.placed }));
        const w = alive[0];
        S.winner = w ? w.id : null;
        if (w) { w.wins++; this.say(w.id, 'win', 'happy'); }
        this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      }
      this.fx({ type: 'gameover', winner: S.winner });
      this.log('Game habis · tower paling tinggi ' + S.best);
      this.changed();
    }

    // bots pick a spot that keeps the tower balanced, then drop when the swing passes it
    botAim(pid) {
      const S = this.s, tr = S.turn;
      const skill = 0.55 + this.rng() * 0.35;
      // best x: try candidates, keep the one with the lowest lean
      let best = 0, bl = 9;
      for (let x = -SWING; x <= SWING; x += 0.02) { const r = check(S.stack.concat([{ k: tr.k, x }])); if (r.ok && r.lean < bl) { bl = r.lean; best = x; } }
      const err = (this.rng() - 0.5) * (0.34 - skill * 0.22) * (1 + tr.n * 0.14);
      const target = Math.max(-SWING, Math.min(SWING, best + err));
      const t0 = tr.t0, from = Math.max(this.now(), t0) + 900 + this.rng() * 1200;
      let at = from;
      for (let t = from; t < from + 6000; t += 10) { if (Math.abs(swingX(tr.n, tr.phase, t - t0) - target) < 0.012) { at = t; break; } }
      this.step(() => { if (S.phase === 'turn' && S.turn === tr) this.drop(pid, { id: tr.id, x: swingX(tr.n, tr.phase, this.now() - t0) }); }, Math.max(0, at - this.now()));
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'drop') return this.drop(id, m);
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
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
  }

  const api = { Table, KINDS, BASE, SWING, swingX, check, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KACANG = api;
})(this);
