/* Kopitiam 21 — Kira Duit: cashier rush at the BAYAR SINI counter. A customer pays, everyone races
   to give the right baki (change) at the same time. Fastest correct change scores most.
   Host engine; all money is in sen (integers). */
(function (root) {
  'use strict';

  // menu prices match the menu board on the wall
  const MENU = [
    { id: 'kopi', name: 'Kopi', sen: 180, drink: true },
    { id: 'kopio', name: 'Kopi-O', sen: 150, drink: true },
    { id: 'teh', name: 'Teh', sen: 200, drink: true },
    { id: 'tehtarik', name: 'Teh Tarik', sen: 220, drink: true },
    { id: 'milo', name: 'Milo', sen: 300, drink: true },
    { id: 'bandung', name: 'Sirap Bandung', sen: 250, drink: true },
    { id: 'limau', name: 'Limau', sen: 200, drink: true },
    { id: 'roticanai', name: 'Roti Canai', sen: 250 },
    { id: 'telur', name: 'Telur Separuh Masak', sen: 220 },
    { id: 'rotibakar', name: 'Roti Bakar', sen: 350 },
    { id: 'nasilemak', name: 'Nasi Lemak', sen: 550 },
    { id: 'rojak', name: 'Rojak', sen: 600 },
    { id: 'wantanmee', name: 'Wantan Mee', sen: 800 },
    { id: 'ckt', name: 'Char Kuey Teow', sen: 900 },
  ];
  // money: notes and coins, biggest first
  const MONEY = [
    { id: 'n50', sen: 5000, note: true }, { id: 'n20', sen: 2000, note: true }, { id: 'n10', sen: 1000, note: true },
    { id: 'n5', sen: 500, note: true }, { id: 'n1', sen: 100, note: true },
    { id: 'c50', sen: 50 }, { id: 'c20', sen: 20 }, { id: 'c10', sen: 10 },
  ];
  const GIVE = ['n20', 'n10', 'n5', 'n1', 'c50', 'c20', 'c10'];   // what the cashier can hand back
  const val = id => (MONEY.find(m => m.id === id) || { sen: 0 }).sen;
  const sum = coins => Object.keys(coins || {}).reduce((a, k) => a + val(k) * Math.max(0, Math.min(20, coins[k] | 0)), 0);
  const pieces = coins => Object.keys(coins || {}).reduce((a, k) => a + Math.max(0, coins[k] | 0), 0);
  // fewest pieces for an amount (MYR is canonical, so greedy is optimal)
  function best(sen) { const out = {}; for (const id of GIVE) { const n = Math.floor(sen / val(id)); if (n) { out[id] = n; sen -= n * val(id); } } return out; }
  const rm = sen => 'RM' + (sen / 100).toFixed(2);

  const ROUNDS = 10, MAX = 6;
  const PTS = [100, 75, 60, 50, 45, 40];   // by finishing order among correct answers
  const NEAT = 10;                          // bonus for the fewest pieces possible
  const LINES = {
    cust: ['Kira, boss!', 'Berapa semua?', 'Cepat sikit ya', 'Bayar sini ah?', 'Ada baki tak?', 'Tolong kira ya'],
    tricky: ['Saya bagi syiling sekali, senang baki', 'Ambik ni, bagi baki cantik sikit'],
    right: ['Betul!', 'Terima kasih!', 'Laju gila!', 'Cun!'],
    wrong: ['Eh, tak cukup ni!', 'Salah kira lah!', 'Baki tak betul!', 'Aiyo, kira balik!'],
    slow: ['Lambat nya...', 'Saya tunggu lama ni', 'Bas dah lepas!'],
    win: ['Juruwang terbaik!', 'Kalkulator manusia!', 'Huat ah!'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DR = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];
  const CUST = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider'];
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
        game: 'duit', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], order: [], rnd: 0, rounds: ROUNDS, round: 0, cust: null, gave: {}, results: null,
        ranking: null, winner: null, log: [],
      };
    }
    pick(a) { return a[Math.floor(this.rng() * a.length)]; }
    int(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
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
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Kira Duit is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', drink: DR.includes(info.drink) ? info.drink : 'tehtarik', connected: true, isBot: !!info.isBot, inGame: !late, score: 0, right: 0, fastest: 0, wins: 0 };
      this.s.players.push(pl);
      this.log(pl.name + (late ? ' masuk (next game)' : ' masuk'));
      this.changed();
      return { ok: true };
    }
    addBot() {
      const used = new Set(this.s.players.map(p => p.name));
      const avatar = this.pick(AV), S = typeof root !== 'undefined' && root.SPR;
      const name = (S && S.randomName) ? S.randomName(avatar, used) : ['Uncle Lim', 'Kak Ros', 'Ah Seng', 'Muthu', 'Mei Ling', 'Auntie Mary'].find(n => !used.has(n)) || 'Bot';
      return this.addPlayer({ id: 'bot-' + Math.floor(this.rng() * 1e9).toString(36), name, avatar, isBot: true });
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline'); this.checkAll(); }
      this.changed();
    }
    kick(id) {
      if (id === this.s.hostId) return;
      this.s.players = this.s.players.filter(x => x.id !== id);
      delete this.s.gave[id];
      this.checkAll();
      this.changed();
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.score = 0; p.right = 0; p.fastest = 0; }
      S.round++; S.rnd = 0; S.ranking = null; S.winner = null; S.results = null;
      this.log('Game ' + S.round + ' · ' + S.players.length + ' cashier' + (S.players.length > 1 ? 's' : '') + ' · ' + ROUNDS + ' customers');
      this.fx({ type: 'banner', text: 'KAUNTER BUKA!', style: 'info' });
      this.nextCustomer(1200);
    }

    // build a customer: what they ate, what they pay with, and the baki
    makeCustomer(n) {
      const lvl = n <= 3 ? 1 : n <= 7 ? 2 : 3;
      const count = lvl === 1 ? this.int(1, 2) : lvl === 2 ? this.int(2, 3) : this.int(3, 4);
      const items = [];
      for (let i = 0; i < count; i++) {
        const m = this.pick(i === 0 || this.rng() < 0.5 ? MENU.filter(x => x.drink) : MENU.filter(x => !x.drink));
        const ex = items.find(x => x.id === m.id);
        if (ex) ex.qty++; else items.push({ id: m.id, name: m.name, sen: m.sen, qty: 1 });
      }
      const total = items.reduce((a, x) => a + x.sen * x.qty, 0);
      // smallest note that covers it, sometimes one bigger
      const notes = [500, 1000, 2000, 5000].filter(v => v > total);
      let note = notes[0] || 5000;
      if (lvl >= 2 && notes.length > 1 && this.rng() < 0.4) note = notes[1];
      const paid = { ['n' + note / 100]: 1 };
      // tricky: hand over some coins too, so the baki comes out neat
      let tricky = false;
      const cents = total % 100;
      if (lvl === 3 && cents && this.rng() < 0.6) {
        const add = cents <= 50 ? cents : null;
        const opts = { 10: { c10: 1 }, 20: { c20: 1 }, 30: { c20: 1, c10: 1 }, 40: { c20: 2 }, 50: { c50: 1 } };
        if (add && opts[add]) { Object.assign(paid, opts[add]); tricky = true; }
      }
      const paidSen = sum(paid);
      const baki = paidSen - total;
      if (baki <= 0) return this.makeCustomer(n);
      return { n, lvl, av: this.pick(CUST), items, total, paid, paidSen, baki, tricky };
    }

    nextCustomer(delay) {
      const S = this.s;
      S.phase = 'next'; S.cust = null; S.gave = {}; S.results = null;
      this.changed();
      this.step(() => {
        S.rnd++;
        if (S.rnd > ROUNDS) { this.finish(); return; }
        S.cust = this.makeCustomer(S.rnd);
        S.phase = 'count';
        S.firstAt = this.now();
        const sec = S.cust.lvl === 1 ? 25 : S.cust.lvl === 2 ? 25 : 30;
        this.fx({ type: 'customer', n: S.rnd, text: S.cust.tricky ? this.pick(LINES.tricky) : this.pick(LINES.cust) });
        this.setTimer('count', sec, () => this.reveal());
        for (const p of this.inGame()) if (p.isBot) this.botGive(p.id, S.rnd);
        this.changed();
      }, delay || 900);
    }

    give(pid, m) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'count' || !pl || !pl.inGame || S.gave[pid] || !S.cust || m.r !== S.rnd) return;
      const coins = {};
      for (const k of GIVE) { const n = Math.max(0, Math.min(20, (m.coins && m.coins[k]) | 0)); if (n) coins[k] = n; }
      const amt = sum(coins);
      const ok = amt === S.cust.baki;
      const rank = ok ? Object.values(S.gave).filter(g => g.ok).length : -1;
      S.gave[pid] = { amt, coins, ok, rank, at: this.now() - S.firstAt, neat: ok && pieces(coins) === pieces(best(S.cust.baki)) };
      this.fx({ type: 'gave', pid });
      this.log(pl.name + ' bagi baki');
      this.checkAll();
      this.changed();
    }
    checkAll() {
      const S = this.s;
      if (S.phase !== 'count') return;
      const left = this.inGame().filter(p => p.connected && !S.gave[p.id]);
      if (!left.length) { this.clearTimer(); this.step(() => this.reveal(), 500); }
    }

    reveal() {
      const S = this.s, c = S.cust;
      if (S.phase !== 'count' || !c) return;
      this.clearTimer();
      S.phase = 'reveal';
      const res = [];
      for (const p of this.inGame()) {
        const g = S.gave[p.id];
        let pts = 0;
        if (g && g.ok) { pts = PTS[Math.min(PTS.length - 1, g.rank)] + (g.neat ? NEAT : 0); p.right++; if (g.rank === 0) p.fastest++; }
        p.score += pts;
        res.push({ id: p.id, gave: !!g, ok: !!(g && g.ok), amt: g ? g.amt : null, rank: g ? g.rank : -1, at: g ? g.at : null, neat: !!(g && g.neat), pts });
      }
      S.results = res;
      const first = res.find(r => r.ok && r.rank === 0);
      const anyRight = res.some(r => r.ok);
      this.fx({ type: 'reveal', baki: c.baki, best: best(c.baki), first: first ? first.id : null });
      this.fx({ type: 'say', cust: true, text: anyRight ? this.pick(LINES.right) : res.some(r => r.gave) ? this.pick(LINES.wrong) : this.pick(LINES.slow) });
      for (const r of res) {
        if (r.ok && r.rank === 0 && this.inGame().length > 1) this.say(r.id, 'win', 'happy');
        else if (r.gave && !r.ok) this.fx({ type: 'say', pid: r.id, text: 'Alamak salah kira...', mood: 'sad' });
      }
      this.log('Baki ' + rm(c.baki) + (first ? ' · ' + this.p(first.id).name + ' paling laju' : ''));
      this.changed();
      this.step(() => this.nextCustomer(300), 4200);
    }

    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.cust = null; S.gave = {};
      const r = this.inGame().slice().sort((a, b) => b.score - a.score || b.right - a.right || b.fastest - a.fastest);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, right: p.right, fastest: p.fastest }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.score : '-'));
      this.changed();
    }

    botGive(pid, rnd) {
      const S = this.s;
      const c = S.cust;
      const think = (2.5 + c.lvl * 2.2 + this.rng() * 7) * 1000;
      this.step(() => {
        if (S.phase !== 'count' || S.rnd !== rnd) return;
        let amt = c.baki;
        if (this.rng() < 0.15) amt = Math.max(10, amt + this.pick([-100, -50, -10, 10, 50, 100]));
        const coins = this.rng() < 0.6 ? best(amt) : (() => { const o = best(amt); if (o.c50) { o.c50--; o.c20 = (o.c20 || 0) + 2; o.c10 = (o.c10 || 0) + 1; } return o; })();
        this.give(pid, { r: rnd, coins });
      }, think);
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'give') return this.give(id, m);
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
      // nobody sees the answer, or what others gave, until the reveal
      if (out.cust && out.phase === 'count') delete out.cust.baki;
      if (out.phase === 'count') for (const k of Object.keys(out.gave)) out.gave[k] = { done: true };
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
  }

  const api = { Table, MENU, MONEY, GIVE, val, sum, best, rm, ROUNDS, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DUIT = api;
})(this);
