/* Kopitiam 21 — Tarik Teh: take turns pulling teh tarik. Hold to pour from the top mug; the higher
   the pull, the more buih (froth) — but the stream sways more. Slide the bottom mug to catch it.
   Host engine. The puller's own browser runs the pour smoothly and streams frames + the result;
   bots are simulated here. 3 rounds, highest total buih wins. */
(function (root) {
  'use strict';

  // shared pour physics (view + bots)
  const P = {
    RISE: 0.182,       // height per second while holding (0 = mugs touching, 1 = arm fully up)
    DRAIN: 0.18,      // tea per second out of the top mug (starts at 1)
    MUG: 0.24,        // half-width of the bottom mug (normalised, mug moves in -1..1)
    TUMPAH: 0.3,     // spilled this much tea = tumpah, no buih for this pull
    PERFECT: 25,      // bonus for pouring the whole mug without (much) spill
    MAXPTS: 160,
    // buih per second while the stream lands in the mug
    rate(h) { return 5 + 42 * Math.pow(h, 1.5); },
    // where the stream lands (-1..1) at time t into the pull, for height h; seed varies the dance
    land(t, h, seed) {
      const A = 0.05 + 0.66 * h;
      const w = 1.4 + 2.4 * h;
      const ph = t * w * (1 + 0.25 * Math.sin(t * 0.9 + seed * 7));
      return A * (0.72 * Math.sin(ph + seed * 11) + 0.28 * Math.sin(ph * 1.73 + seed * 3));
    },
  };

  const LINES = {
    start: ['Tarik!', 'Jom tarik!', 'Tengok ni!', 'Tarik sampai langit!'],
    high: ['Tinggi lagi!', 'Wah, tinggi gila!', 'Pro level!', 'Buih tebal!'],
    safe: ['Cukup lah', 'Safe safe...', 'Sikit pun ok'],
    tumpah: ['ALAMAK TUMPAH!', 'Basah baju!', 'Aiyo, lantai basah!', 'Habis teh!'],
    laugh: ['Hahaha!', 'Lap meja lah!', 'Kain buruk mana?', 'Teh O ais je lah!'],
    perfect: ['SEMPURNA!', 'Macam mamak pro!', 'Buih power!'],
    slow: ['Cepat lah!', 'Tidur ke?'],
    win: ['Raja Teh Tarik!', 'Tarik sampai juara!', 'Huat ah!'],
  };
  const BOT_NAMES = ['Uncle Lim', 'Auntie Mary', 'Ah Seng', 'Kak Ros', 'Muthu', 'Mei Ling'];
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DR = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);
  const MAX = 6, ROUNDS = 3;

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
        game: 'tarik', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], order: [], turn: null, live: null, last: null, rnd: 0, rounds: ROUNDS, round: 0,
        ranking: null, winner: null, log: [], settings: { turnTime: 12 },
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
    inGame() { return this.s.order.map(id => this.p(id)).filter(Boolean); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; if (info.drink) ex.drink = info.drink; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Tarik Teh is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', drink: DR.includes(info.drink) ? info.drink : 'tehtarik', connected: true, isBot: !!info.isBot, inGame: !late, total: 0, pulls: [], best: 0, tumpah: 0, wins: 0 };
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
      else {
        pl.connected = false; this.log(pl.name + ' offline');
        const tr = this.s.turn;
        if (this.s.phase === 'tarik' && tr && tr.pid === id) this.step(() => { if (this.s.turn === tr && this.s.phase === 'tarik') this.endTurn(id, 0, false, false, 'off'); }, 1500);
      }
      this.changed();
    }
    kick(id) {
      if (id === this.s.hostId) return;
      this.s.players = this.s.players.filter(x => x.id !== id);
      const tr = this.s.turn, mid = this.s.phase === 'tarik' && tr && tr.pid === id;
      this.s.order = this.s.order.filter(x => x !== id);
      if (mid) { this.clearTimer(); this.s.phase = 'result'; this.step(() => this.next(), 600); }
      this.changed();
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.total = 0; p.pulls = []; p.best = 0; p.tumpah = 0; }
      S.order = S.players.map(p => p.id);
      for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; }
      S.rnd = 1; S.round++; S.ranking = null; S.winner = null; S.last = null; S.live = null; S.turn = null;
      S.idx = 0;
      this.log('Game ' + S.round + ' · ' + S.order.length + ' players · ' + ROUNDS + ' rounds');
      if (S.order.length > 1) {
        S.phase = 'pick';
        this.fx({ type: 'pick', id: S.order[0], candidates: S.order.slice(), title: 'SIAPA TARIK DULU?', label: 'MULA' });
        this.changed();
        this.step(() => this.beginTurn(), 3400);
      } else { this.changed(); this.beginTurn(); }
    }
    beginTurn() {
      const S = this.s;
      const pid = S.order[S.idx];
      const pl = this.p(pid);
      if (!pl) { this.next(); return; }
      S.phase = 'tarik';
      S.turn = { id: (S.turn ? S.turn.id : 0) + 1, pid, started: false, seed: Math.floor(this.rng() * 1000) / 1000 };
      S.live = null; S.last = null;
      this.fx({ type: 'turn', pid, rnd: S.rnd });
      this.setTimer('tarik', S.settings.turnTime, () => this.timeout());
      if (pl.isBot) this.step(() => this.botPull(pid), 1100 + this.rng() * 1200);
      else if (!pl.connected) this.step(() => this.endTurn(pid, 0, false, false, 'off'), 2000);
      this.changed();
    }
    next() {
      const S = this.s;
      S.idx++;
      if (S.idx >= S.order.length) {
        S.idx = 0; S.rnd++;
        if (S.rnd > ROUNDS || !S.order.length) { this.finish(); return; }
        this.fx({ type: 'banner', text: 'ROUND ' + S.rnd + '/' + ROUNDS, style: 'info' });
      }
      if (!S.order.length) { this.finish(); return; }
      this.beginTurn();
    }

    // live frames + the result from the puller's browser
    frame(pid, m) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'tarik' || !tr || tr.pid !== pid || m.id !== tr.id) return;
      const num = (v, lo, hi) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
      if (!tr.started) { tr.started = true; this.say(pid, 'start', 'happy'); this.setTimer('tarik', 10, () => this.timeout()); }
      S.live = { id: tr.id, tm: num(m.tm, 0, 30), h: num(m.h, 0, 1), m: num(m.m, -1, 1), l: num(m.l, -1.2, 1.2), tea: num(m.tea, 0, 1), fr: Math.round(num(m.fr, 0, P.MAXPTS)), sp: num(m.sp, 0, 1), a: !!m.a, miss: !!m.miss };
      if (!tr.hi && S.live.h > 0.75) { tr.hi = true; this.fx({ type: 'say', pid: this.other(pid), text: this.pick(LINES.high), mood: 'happy' }); }
      if (m.done) {
        const tumpah = !!m.tumpah || S.live.sp >= P.TUMPAH;
        const perfect = !tumpah && !!m.perfect && S.live.tea <= 0.02 && S.live.sp < 0.05;
        this.endTurn(pid, tumpah ? 0 : S.live.fr, tumpah, perfect);
        return;
      }
      this.changed();
    }
    other(pid) { const o = this.inGame().filter(p => p.id !== pid); return o.length ? this.pick(o).id : null; }

    endTurn(pid, pts, tumpah, perfect, why) {
      const S = this.s, pl = this.p(pid), tr = S.turn;
      if (S.phase !== 'tarik') return;
      this.clearTimer();
      pts = Math.max(0, Math.min(P.MAXPTS, Math.round(pts || 0))) + (perfect ? P.PERFECT : 0);
      if (pl) { pl.pulls.push(pts); pl.total += pts; pl.best = Math.max(pl.best, pts); if (tumpah) pl.tumpah++; }
      S.phase = 'result';
      S.last = { pid, pts, tumpah: !!tumpah, perfect: !!perfect, h: S.live ? S.live.h : 0, why: why || null };
      if (S.live) { S.live.a = false; S.live.done = true; }
      const nm = pl ? pl.name : '?';
      if (tumpah) {
        this.fx({ type: 'tumpah', pid });
        this.fx({ type: 'banner', text: 'TUMPAH!', style: 'bust' });
        this.say(pid, 'tumpah', 'sad');
        this.step(() => { for (const p of this.inGame()) if (p.id !== pid && this.rng() < 0.5) this.say(p.id, 'laugh', 'happy'); }, 800);
        this.log(nm + ' TUMPAH! 0 buih');
      } else if (why) {
        this.log(nm + (why === 'off' ? ' offline · 0' : ' tak tarik · 0'));
      } else {
        this.fx({ type: 'score', pid, pts, perfect: !!perfect });
        if (perfect) { this.fx({ type: 'banner', text: 'SEMPURNA! +' + P.PERFECT, style: 'win' }); this.say(pid, 'perfect', 'happy'); }
        else if (pts >= 80) this.say(pid, 'high', 'happy');
        else if (pts < 25) this.say(pid, 'safe');
        this.log(nm + ' tarik · ' + pts + ' buih');
      }
      tr.done = true;
      this.changed();
      this.step(() => this.next(), tumpah ? 2600 : 1900);
    }

    timeout() {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'tarik' || !tr) return;
      if (tr.started && S.live) { const t = S.live.sp >= P.TUMPAH; this.endTurn(tr.pid, t ? 0 : S.live.fr, t, false); return; }
      this.say(tr.pid, 'slow', 'sad');
      this.endTurn(tr.pid, 0, false, false, 'slow');
    }

    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.turn = null; S.live = null;
      const r = this.inGame().slice().sort((a, b) => b.total - a.total || b.best - a.best);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, total: p.total, best: p.best, pulls: p.pulls.slice(), tumpah: p.tumpah }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.total + ' buih' : '-'));
      this.changed();
    }

    // bot: decide how long to hold, run the physics with a wobbly hand, stream frames
    botPull(pid) {
      const S = this.s, tr = S.turn;
      if (S.phase !== 'tarik' || !tr || tr.pid !== pid) return;
      this.clearTimer();
      const skill = 0.55 + this.rng() * 0.4;
      const hold = 1.5 + this.rng() * 4.4;       // seconds; 5.6+ pours the whole mug
      let t = 0, h = 0, tea = 1, fr = 0, sp = 0, m = 0, l = 0;
      const dt = 0.05;
      const tick = () => {
        if (S.phase !== 'tarik' || S.turn !== tr) return;
        for (let i = 0; i < 2; i++) {
          t += dt; h = Math.min(1, h + P.RISE * dt); tea = Math.max(0, tea - P.DRAIN * dt);
          l = P.land(t, h, tr.seed);
          // a bot's hand trails the stream; worse bots trail more
          const lagT = Math.max(0, t - (0.06 + (1 - skill) * 0.22));
          const want = P.land(lagT, h, tr.seed) + (this.rng() - 0.5) * (1 - skill) * 0.3;
          m += (want - m) * Math.min(1, dt * 18);
          const miss = Math.abs(l - m) > P.MUG;
          if (miss) sp += P.DRAIN * dt; else fr += P.rate(h) * dt;
        }
        const done = t >= hold || tea <= 0 || sp >= P.TUMPAH;
        this.frame(pid, { id: tr.id, tm: t, h, m, l, tea, fr, sp, a: !done, done, tumpah: sp >= P.TUMPAH, perfect: tea <= 0 && sp < 0.05 });
        if (!done) this.step(tick, 100);
      };
      this.step(tick, 100);
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'tt') return this.frame(id, m);
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

  const api = { Table, P, LINES, MAX, ROUNDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TARIK = api;
})(this);
