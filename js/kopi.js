/* Kopitiam 21 — Kopi Tumpah: take turns pouring kopi into one cup. Whoever makes it overflow is out.
   Host engine. The pourer's own browser runs the pour smoothly and reports the level;
   the host keeps the secret spill point and decides who tumpah. */
(function (root) {
  'use strict';

  // pour speed (cup per second) after holding for t seconds: the kettle tips further the longer you hold
  function rate(t) { return 0.06 + 0.32 * Math.pow(Math.min(1, t / 1.2), 2); }
  // extra kopi that still drips out after letting go
  function drip(holdT, rnd) { return rate(holdT) * 0.1 + 0.004 + rnd * 0.008; }
  // how long to hold to pour `amount` (approx, ignoring drip)
  function holdFor(amount) { let t = 0, a = 0; while (a < amount && t < 10) { a += rate(t) * 0.01; t += 0.01; } return t; }

  const LINES = {
    pourBig: ['Tuang banyak-banyak!', 'Berani mati!', 'Full power!'],
    pourSmall: ['Sikit je...', 'Slow slow...', 'Setitik je lah'],
    close: ['Cukup cukup!', 'Hati-hati!', 'Nak tumpah dah!', 'Alamak, penuh!'],
    spill: ['ALAMAK TUMPAH!', 'Aiyo, basah meja!', 'Habis lah!', 'Wah lau, tumpah!'],
    laugh: ['Hahaha belanja!', 'Belanja kopi lah!', 'Terima kasih boss!', 'Kopi O satu!'],
    win: ['Juara Kopi Tumpah!', 'Steady hand!', 'Huat ah!'],
    slow: ['Cepat lah!', 'Tidur ke?'],
  };
  const BOT_NAMES = ['Uncle Lim', 'Auntie Mary', 'Ah Seng', 'Kak Ros', 'Muthu', 'Mei Ling'];
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DR = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);
  const MAX = 6;

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
      this.T = 1.05;           // secret spill point (never sent to players)
      this.lastMsg = 0;
      this.s = {
        game: 'kopi', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], order: [], turn: null, level: 0, cupNo: 0, loser: null, winner: null, round: 0,
        log: [], settings: { turnTime: 10 },
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
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; if (info.drink) ex.drink = info.drink; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Kopi Tumpah is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', drink: DR.includes(info.drink) ? info.drink : 'kopio', connected: true, isBot: !!info.isBot, out: late, wins: 0, spills: 0 };
      this.s.players.push(pl);
      this.log(pl.name + (late ? ' masuk (next game)' : ' masuk'));
      this.changed();
      return { ok: true };
    }
    addBot() {
      const used = new Set(this.s.players.map(p => p.name));
      const avatar = this.pick(AV), S = typeof root !== 'undefined' && root.SPR;
      const name = (S && S.randomName) ? S.randomName(avatar, used) : (BOT_NAMES.find(n => !used.has(n)) || 'Uncle Bot');
      return this.addPlayer({ id: 'bot-' + Math.floor(this.rng() * 1e9).toString(36), name, avatar, drink: this.pick(DR), isBot: true });
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline'); }
      this.changed();
    }
    kick(id) { if (id === this.s.hostId) return; this.s.players = this.s.players.filter(x => x.id !== id); this.s.order = this.s.order.filter(x => x !== id); this.changed(); }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 2 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) p.out = false;
      S.order = S.players.map(p => p.id);
      for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; }
      S.winner = null; S.loser = null; S.cupNo = 0; S.round++;
      const first = this.pick(S.order);
      this.newCup();
      S.phase = 'pick';
      this.fx({ type: 'pick', id: first, candidates: S.order.slice(), title: 'SIAPA TUANG DULU?', label: 'MULA' });
      this.log('Game ' + S.round + ' · ' + S.order.length + ' players');
      this.changed();
      this.step(() => this.beginTurn(first), 3400);
    }
    newCup() {
      const S = this.s;
      S.cupNo++; S.level = 0; S.loser = null;
      this.T = 1.0 + this.rng() * 0.12; // between the brim and a fat bulge
    }
    beginTurn(pid) {
      const S = this.s;
      S.phase = 'pour';
      S.turn = { id: (S.turn ? S.turn.id : 0) + 1, pid, start: S.level, min: Math.round((0.035 + this.rng() * 0.03) * 1000) / 1000, pouring: false };
      this.fx({ type: 'turn', pid });
      this.setTimer('pour', S.settings.turnTime, () => this.timeout());
      const pl = this.p(pid);
      if (pl.isBot) this.step(() => this.botPour(pid), 900 + this.rng() * 1200);
      else if (!pl.connected) this.step(() => this.timeout(), 2500);
      this.changed();
    }
    nextAfter(pid) {
      const S = this.s, n = S.order.length;
      let i = S.order.indexOf(pid);
      for (let k = 1; k <= n; k++) { const id = S.order[(i + k) % n]; const p = this.p(id); if (p && !p.out) return id; }
      return null;
    }

    // a level report from the pourer's browser
    level(pid, m) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'pour' || !tr || tr.pid !== pid || m.id !== tr.id) return;
      let v = +m.v;
      if (!isFinite(v)) return;
      const now = this.now();
      // sanity: never down, never absurdly fast
      const maxUp = 0.45 * Math.max(0.15, (now - (this.lastMsg || now)) / 1000) + 0.06;
      this.lastMsg = now;
      v = Math.max(S.level, Math.min(v, S.level + maxUp, 1.5));
      S.level = v;
      tr.pouring = !m.done;
      if (S.level >= this.T) { this.spill(pid); return; }
      if (m.done && S.level - tr.start >= tr.min - 1e-6) { this.endTurn(pid); return; }
      if (S.level > 0.92 && !tr.warned) { tr.warned = true; this.fx({ type: 'say', pid: this.nextAfter(pid), text: this.pick(LINES.close), mood: 'sad' }); }
      this.changed();
    }

    endTurn(pid) {
      const S = this.s;
      this.clearTimer();
      const amt = S.level - S.turn.start;
      S.turn.pouring = false;
      this.log(this.p(pid).name + ' tuang ' + Math.round(amt * 100) + '%');
      if (amt > 0.15) this.say(pid, 'pourBig', 'happy');
      S.phase = 'next';
      this.changed();
      this.step(() => { const nx = this.nextAfter(pid); if (nx) this.beginTurn(nx); }, 700);
    }

    spill(pid) {
      const S = this.s, pl = this.p(pid);
      this.clearTimer();
      S.phase = 'spill'; S.loser = pid; S.turn.pouring = false;
      pl.out = true; pl.spills++;
      this.fx({ type: 'spill', pid });
      this.fx({ type: 'banner', text: 'TUMPAH!', style: 'bust' });
      this.say(pid, 'spill', 'sad');
      this.step(() => { for (const p of this.alive()) if (Math.random() < 0.6) this.say(p.id, 'laugh', 'happy'); }, 900);
      this.step(() => this.fx({ type: 'banner', text: pl.name.toUpperCase() + ' BELANJA KOPI!', style: 'info' }), 1300);
      this.log(pl.name + ' TUMPAH! Belanja kopi');
      this.changed();
      this.step(() => {
        const left = this.alive();
        if (left.length <= 1) { this.finish(left[0] && left[0].id); return; }
        this.newCup();
        this.fx({ type: 'banner', text: 'CAWAN BARU!', style: 'info' });
        const nx = this.nextAfter(pid);
        this.beginTurn(nx);
      }, 3800);
    }

    finish(pid) {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.winner = pid || null; S.turn = null;
      const w = this.p(pid); if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: pid });
      if (w) this.say(pid, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name : '-'));
      this.changed();
    }

    // run a pour on the host (bots, timeouts, dropped players), sending the level as it goes
    hostPour(pid, amount) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'pour' || !tr || tr.pid !== pid || tr.hosted) return;
      tr.hosted = true; this.clearTimer();
      const hold = holdFor(Math.max(0.005, amount));
      const dripAmt = drip(hold, this.rng());
      let t = 0;
      const tick = () => {
        if (S.phase !== 'pour' || S.turn !== tr) return;
        const dt = 0.1, nt = Math.min(hold, t + dt);
        let add = 0; for (let x = t; x < nt; x += 0.01) add += rate(x) * 0.01;
        t = nt;
        S.level += add; tr.pouring = true;
        if (S.level >= this.T) { this.spill(pid); return; }
        this.changed();
        if (t < hold) { this.step(tick, 100); return; }
        // let go, then the drips
        this.step(() => {
          if (S.phase !== 'pour' || S.turn !== tr) return;
          S.level += dripAmt; tr.pouring = false;
          if (S.level >= this.T) { this.spill(pid); return; }
          this.endTurn(pid);
        }, 300);
      };
      this.step(tick, 100);
    }
    timeout() {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'pour' || !tr) return;
      const done = S.level - tr.start;
      if (done >= tr.min) { this.endTurn(tr.pid); return; }
      this.say(tr.pid, 'slow', 'sad');
      tr.auto = true;
      this.hostPour(tr.pid, tr.min - done);
    }
    botPour(pid) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'pour' || !tr || tr.pid !== pid) return;
      const room = 1.0 - S.level;
      let amt;
      if (room > 0.35) amt = tr.min + this.rng() * 0.2;
      else if (room > 0.15) amt = tr.min + this.rng() * 0.06;
      else amt = tr.min + this.rng() * 0.01;
      this.say(pid, amt > 0.15 ? 'pourBig' : 'pourSmall');
      this.hostPour(pid, amt - 0.012);
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'lvl') return this.level(id, m);
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

  const api = { Table, rate, drip, holdFor, LINES, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KOPI = api;
})(this);
