/* Kopitiam 21 — Cari Telur: an egg goes under a bowl, the bowls shuffle, everyone guesses at once.
   Host engine. The host writes the shuffle script; every screen plays the same script. */
(function (root) {
  'use strict';

  const LEVELS = [
    { n: 3, swaps: 4, ms: 700 }, { n: 3, swaps: 6, ms: 520 }, { n: 3, swaps: 8, ms: 420 },
    { n: 4, swaps: 8, ms: 400 }, { n: 4, swaps: 10, ms: 340 },
    { n: 5, swaps: 10, ms: 320, tricks: true }, { n: 5, swaps: 12, ms: 280, tricks: true },
    { n: 6, swaps: 12, ms: 260, tricks: true }, { n: 6, swaps: 14, ms: 230, tricks: true }, { n: 6, swaps: 16, ms: 200, tricks: true },
  ];
  const PICK_TIME = 10, PLACE_MS = 2600, REVEAL_TIME = 3.5;

  // Build a shuffle. Steps: {k:'swap', a, b, ms, arc} swaps the bowls in slots a and b;
  // {k:'fake', a, b, ms} starts a swap and backs off; {k:'pause', ms} holds still.
  function makeScript(level, rng) {
    const L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
    const ri = n => Math.floor(rng() * n);
    const start = ri(L.n);
    let egg = start; // slot the egg is in right now
    const steps = [];
    for (let i = 0; i < L.swaps; i++) {
      let a, b;
      if (rng() < 0.55) { a = egg; do { b = ri(L.n); } while (b === a); } else { a = ri(L.n); do { b = ri(L.n); } while (b === a); }
      if (L.tricks && i > 1 && rng() < 0.18) steps.push({ k: rng() < 0.5 ? 'fake' : 'pause', a, b, ms: rng() < 0.5 ? L.ms : 420 });
      const arc = L.tricks && rng() < 0.3;
      steps.push({ k: 'swap', a, b, ms: L.ms, arc });
      if (egg === a) egg = b; else if (egg === b) egg = a;
    }
    return { n: L.n, start, steps, end: egg };
  }
  function scriptMs(sc) { return sc.steps.reduce((t, s) => t + s.ms + 40, 0); }

  const LINES = {
    right: ['JUMPA!', 'Mata helang!', 'Steady!', 'Ada telur!'],
    wrong: ['Kosong lah!', 'Alamak, tertipu!', 'Mana telur?!', 'Aiyo...'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
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
      this.picks = {}; this.pickAt = {}; this.pickStart = 0;
      this.s = {
        game: 'egg', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], level: 0, levels: LEVELS.length, script: null, picked: [], result: null, round: 0, ranking: null, log: [],
      };
    }
    pick(a) { return a[Math.floor(this.rng() * a.length)]; }
    changed() { this.onChange(); }
    fx(f) { this.onFx(f); }
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
    active() { return this.s.players.filter(p => p.connected && p.inGame); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= 6) return { ok: false, reason: 'Cari Telur is max 6 players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', connected: true, score: 0, correct: 0, wins: 0, inGame: !late };
      this.s.players.push(pl);
      this.log(pl.name + (late ? ' masuk (next game)' : ' masuk'));
      this.changed();
      return { ok: true };
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline'); if (this.s.phase === 'pick') this.checkAll(); }
      this.changed();
    }
    kick(id) { if (id !== this.s.hostId) { this.s.players = this.s.players.filter(x => x.id !== id); this.changed(); } }
    addBot() {}

    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) Object.assign(p, { score: 0, correct: 0, inGame: true });
      S.level = 0; S.round++; S.ranking = null;
      this.log('Game ' + S.round + ' · ' + S.players.length + ' player' + (S.players.length > 1 ? 's' : ''));
      this.nextLevel();
    }
    nextLevel() {
      const S = this.s;
      this.clearTimer();
      S.level++;
      if (S.level > S.levels) { this.finish(); return; }
      const sc = makeScript(S.level, this.rng);
      this.end = sc.end;
      S.script = { id: S.round * 100 + S.level, n: sc.n, start: sc.start, steps: sc.steps };
      S.picked = []; S.result = null;
      this.picks = {}; this.pickAt = {};
      S.phase = 'place';
      this.fx({ type: 'banner', text: 'LEVEL ' + S.level + ' · ' + sc.n + ' MANGKUK', style: 'info' });
      this.changed();
      this.step(() => {
        S.phase = 'shuffle';
        this.fx({ type: 'shuffle', id: S.script.id });
        this.changed();
        this.step(() => this.toPick(), scriptMs(S.script) + 350);
      }, PLACE_MS);
    }
    toPick() {
      const S = this.s;
      S.phase = 'pick';
      this.pickStart = this.now();
      this.setTimer('pick', PICK_TIME, () => this.reveal());
      this.changed();
    }
    choose(id, slot) {
      const S = this.s, pl = this.p(id);
      if (S.phase !== 'pick' || !pl || !pl.inGame || this.picks[id] != null) return;
      slot = Math.floor(+slot);
      if (!(slot >= 0 && slot < S.script.n)) return;
      this.picks[id] = slot; this.pickAt[id] = this.now() - this.pickStart;
      S.picked.push(id);
      this.fx({ type: 'picked', pid: id });
      this.checkAll();
      this.changed();
    }
    checkAll() {
      const act = this.active();
      if (this.s.phase === 'pick' && act.length && act.every(p => this.picks[p.id] != null)) { this.clearTimer(); this.step(() => this.reveal(), 400); }
    }
    reveal() {
      const S = this.s;
      if (S.phase !== 'pick') return;
      this.clearTimer();
      const gains = {};
      for (const p of S.players.filter(x => x.inGame)) {
        const pk = this.picks[p.id];
        let g = 0;
        if (pk === this.end) {
          const speed = Math.max(0, 1 - (this.pickAt[p.id] || 0) / (PICK_TIME * 1000));
          g = 100 + Math.round(speed * 50);
          p.correct++;
        }
        p.score += g; gains[p.id] = g;
      }
      S.result = { slot: this.end, picks: Object.assign({}, this.picks), gains };
      S.phase = 'reveal';
      const right = S.players.filter(p => gains[p.id] > 0).length;
      this.fx({ type: 'reveal', slot: this.end });
      for (const p of S.players.filter(x => x.inGame)) this.fx({ type: 'say', pid: p.id, text: this.pick(gains[p.id] ? LINES.right : LINES.wrong), mood: gains[p.id] ? 'happy' : 'sad' });
      this.log('Level ' + S.level + ': ' + right + '/' + S.players.filter(x => x.inGame).length + ' jumpa telur');
      this.setTimer('reveal', REVEAL_TIME, () => this.nextLevel());
      this.changed();
    }
    skip(id) { if (this.s.phase === 'reveal' && id === this.s.hostId) this.nextLevel(); }
    finish() {
      const S = this.s;
      S.phase = 'over'; S.script = null;
      S.ranking = S.players.filter(p => p.inGame).sort((a, b) => b.score - a.score || b.correct - a.correct)
        .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, correct: p.correct }));
      const w = S.ranking[0] && this.p(S.ranking[0].id);
      if (w && S.ranking.length > 1) w.wins++;
      this.fx({ type: 'banner', text: 'HABIS!', style: 'win' });
      this.fx({ type: 'gameover', winner: w && w.id });
      this.log('Winner: ' + (w ? w.name + ' ' + w.score : '-'));
      this.changed();
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'pick') return this.choose(id, m.slot);
      if (m.t === 'next') return this.skip(id);
      if (m.t === 'emote') {
        const pl = this.p(id); if (!pl) return;
        const now = this.now(); if (pl._le && now - pl._le < 1200) return; pl._le = now;
        const text = String(m.text || '').slice(0, 24); if (text) this.fx({ type: 'emote', pid: id, text });
        return;
      }
      if (id !== this.s.hostId) return;
      if (m.t === 'start' || m.t === 'newGame') return this.start();
      if (m.t === 'kick') return this.kick(m.id);
    }
    publicState() {
      const out = JSON.parse(JSON.stringify(this.s, (k, v) => (k.startsWith('_') ? undefined : v)));
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
  }

  const api = { Table, LEVELS, makeScript, scriptMs, PICK_TIME, PLACE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EGG = api;
})(this);
