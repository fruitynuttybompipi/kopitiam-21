/* Kopitiam 21 — Roti Flip: everyone flips their own roti canai dough at the same time.
   Tap to fling the dough, tap again as it lands. Good timing stretches it bigger and thinner;
   bad timing tears it. LETAK (bank) whenever you like — tear it before that and the round is 0.
   Each browser runs its own dough and reports flips; the host keeps time, checks and scores. */
(function (root) {
  'use strict';

  const R = {
    air(n) { return Math.max(0.5, 1.15 - n * 0.055); },        // seconds in the air, faster each flip
    win(n) { return Math.max(0.055, 0.15 - n * 0.008); },      // ± seconds for a PERFECT catch
    grow: { perfect: n => 0.32 + n * 0.02, ok: () => 0.14, miss: () => 0.04 },
    tear: { perfect: 0, ok: 0.12, miss: 0.38 },
    pts(size, n, telur) { return (Math.round(size * 10) + (n >= 10 ? 20 : 0)) * (telur ? 2 : 1); },
    maxSize(n) { let s = 1; for (let i = 0; i < n; i++) s += R.grow.perfect(i); return s + 0.001; },
    TISU: 10,
  };
  const ROUND_MS = 30000, ROUNDS = 3, MAX = 6;
  const LINES = {
    perfect: ['Wah, pro!', 'Nipis lagi!', 'Macam abang mamak!', 'Cantik!'],
    koyak: ['AIYO KOYAK!', 'Habis bocor!', 'Uli balik lah!', 'Koyak rabak!'],
    letak: ['Letak!', 'Safe!', 'Cukup lah ni'],
    tisu: ['ROTI TISU POWER!', 'Tinggi gila tisu ni!'],
    laugh: ['Hahaha koyak!', 'Kesian...', 'Roti kosong je lah!'],
    win: ['Raja Roti!', 'Abang mamak no. 1!', 'Teh tarik satu untuk saya!'],
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
      this.s = {
        game: 'roti', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], rnd: 0, rounds: ROUNDS, round: 0, telur: false, dough: {}, ranking: null, winner: null, log: [],
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
    inGame() { return this.s.players.filter(p => p.inGame); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Roti Flip is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', connected: true, isBot: !!info.isBot, inGame: !late, score: 0, rounds: [], best: 0, koyak: 0, tisu: 0, wins: 0 };
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
      else { pl.connected = false; this.log(pl.name + ' offline'); this.checkAll(); }
      this.changed();
    }
    kick(id) { if (id === this.s.hostId) return; this.s.players = this.s.players.filter(x => x.id !== id); delete this.s.dough[id]; this.checkAll(); this.changed(); }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.score = 0; p.rounds = []; p.best = 0; p.koyak = 0; p.tisu = 0; }
      S.round++; S.rnd = 0; S.ranking = null; S.winner = null;
      this.log('Game ' + S.round + ' · ' + S.players.length + ' players');
      this.nextRound();
    }
    nextRound() {
      const S = this.s;
      S.rnd++;
      if (S.rnd > ROUNDS) { this.finish(); return; }
      S.telur = S.rnd === ROUNDS;            // last round is Roti Telur: double points
      S.dough = {};
      for (const p of this.inGame()) S.dough[p.id] = { n: 0, size: 1, tear: 0, st: 'ball', pts: 0 };
      S.phase = 'ready';
      this.fx({ type: 'banner', text: S.telur ? 'ROTI TELUR · X2!' : 'ROUND ' + S.rnd + '/' + ROUNDS, style: S.telur ? 'win' : 'info' });
      this.setTimer('ready', 3, () => this.play());
      this.changed();
    }
    play() {
      const S = this.s;
      S.phase = 'play';
      this.fx({ type: 'banner', text: 'FLIP!', style: 'win' });
      this.setTimer('play', ROUND_MS / 1000, () => this.endRound());
      for (const p of this.inGame()) if (p.isBot) this.botRun(p.id, S.rnd);
      this.changed();
    }

    // a flip report from a player's browser
    report(pid, m) {
      const S = this.s, d = S.dough[pid], pl = this.p(pid);
      if (S.phase !== 'play' || !d || !pl || m.r !== S.rnd || d.st === 'banked' || d.st === 'koyak') return;
      const n = Math.max(d.n, Math.min(60, m.n | 0));
      const size = Math.max(1, Math.min(R.maxSize(n), +m.size || 1));
      const tear = Math.max(0, Math.min(1, +m.tear || 0));
      d.n = n; d.size = Math.round(size * 100) / 100; d.tear = Math.round(tear * 100) / 100;
      if (m.ev === 'perfect' && this.rng() < 0.25) this.say(pid, 'perfect', 'happy');
      if (m.st === 'koyak' || tear >= 1) {
        d.st = 'koyak'; d.pts = 0;
        this.fx({ type: 'koyak', pid });
        this.say(pid, 'koyak', 'sad');
        this.step(() => { const o = this.inGame().filter(p => p.id !== pid && this.rng() < 0.4); if (o[0]) this.say(o[0].id, 'laugh', 'happy'); }, 700);
        this.log(pl.name + ' KOYAK!');
        this.checkAll();
      } else if (m.st === 'banked') this.bank(pid);
      else { d.st = m.st === 'air' ? 'air' : 'ball'; }
      this.changed();
    }
    bank(pid, auto) {
      const S = this.s, d = S.dough[pid], pl = this.p(pid);
      if (!d || d.st === 'banked' || d.st === 'koyak') return;
      d.st = 'banked';
      d.pts = R.pts(d.size, d.n, S.telur);
      const tisu = d.n >= R.TISU;
      this.fx({ type: 'letak', pid, pts: d.pts, tisu, auto: !!auto });
      if (tisu) this.say(pid, 'tisu', 'happy'); else if (!auto) this.say(pid, 'letak');
      this.log(pl.name + (auto ? ' (masa habis)' : ' letak') + ' · ' + d.n + ' flip · ' + d.pts);
      if (!auto) this.checkAll();
    }
    checkAll() {
      const S = this.s;
      if (S.phase !== 'play') return;
      const open = this.inGame().filter(p => p.connected && S.dough[p.id] && S.dough[p.id].st !== 'banked' && S.dough[p.id].st !== 'koyak');
      if (!open.length) { this.clearTimer(); this.step(() => this.endRound(), 800); }
    }
    endRound() {
      const S = this.s;
      if (S.phase !== 'play') return;
      this.clearTimer();
      // time up: whatever is still whole goes on the griddle as it is
      for (const p of this.inGame()) { const d = S.dough[p.id]; if (d && d.st !== 'banked' && d.st !== 'koyak') this.bank(p.id, true); }
      for (const p of this.inGame()) {
        const d = S.dough[p.id] || { pts: 0, st: 'koyak' };
        p.rounds.push(d.pts); p.score += d.pts; p.best = Math.max(p.best, d.pts);
        if (d.st === 'koyak') p.koyak++;
        if (d.st === 'banked' && d.n >= R.TISU) p.tisu++;
      }
      S.phase = 'break';
      const best = this.inGame().slice().sort((a, b) => (S.dough[b.id] ? S.dough[b.id].pts : 0) - (S.dough[a.id] ? S.dough[a.id].pts : 0))[0];
      this.fx({ type: 'roundEnd', rnd: S.rnd, best: best && S.dough[best.id] && S.dough[best.id].pts ? best.id : null });
      this.setTimer('break', 4.5, () => this.nextRound());
      this.changed();
    }
    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over';
      const r = this.inGame().slice().sort((a, b) => b.score - a.score || b.best - a.best);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, rounds: p.rounds.slice(), koyak: p.koyak, tisu: p.tisu }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' RAJA ROTI!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.score : '-'));
      this.changed();
    }

    // bots: flip with a wobbly hand, stop when the tear meter looks scary
    botRun(pid, rnd) {
      const S = this.s;
      const skill = 0.5 + this.rng() * 0.35, nerve = 0.35 + this.rng() * 0.4;
      let n = 0, size = 1, tear = 0;
      const flip = () => {
        if (S.phase !== 'play' || S.rnd !== rnd) return;
        const d = S.dough[pid]; if (!d || d.st === 'banked' || d.st === 'koyak') return;
        const hard = Math.min(0.6, n * 0.035);
        const r = this.rng();
        const ev = r < skill - hard ? 'perfect' : r < skill - hard + 0.25 ? 'ok' : 'miss';
        size += R.grow[ev](n); tear = Math.min(1, tear + R.tear[ev]); n++;
        const st = tear >= 1 ? 'koyak' : 'ball';
        this.report(pid, { r: rnd, n, size, tear, st, ev });
        if (st === 'koyak') return;
        if (tear >= nerve || n >= 9 + Math.floor(this.rng() * 5)) { this.step(() => this.report(pid, { r: rnd, n, size, tear, st: 'banked' }), 500); return; }
        this.step(flip, (R.air(n) + 0.35 + this.rng() * 0.5) * 1000);
      };
      this.step(flip, 600 + this.rng() * 800);
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'rf') return this.report(id, m);
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

  const api = { Table, R, ROUNDS, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ROTI = api;
})(this);
