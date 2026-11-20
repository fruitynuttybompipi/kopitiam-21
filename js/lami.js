/* Kopitiam 21 — Lami (Penang / Si Rummy): 2 decks + 8 jokers, 20 cards each (25 with 3 players).
   No drawing, no discarding. Each turn you MUST meld or lay off (as many as you like), else you're DEAD.
   Your first meld (passport) must be a same-suit run. Jokers are wild and can be swapped out.
   Empty your hand = GAME! Everyone else counts what's left: A 15 · 10/J/Q/K 10 · 2-9 face · Joker 20.
   Host engine; each hand is private (privateFor). */
(function (root) {
  'use strict';

  const SUITS = 'SHDC';
  const JOKER0 = 104;                               // ids 0-103 are two packs, 104-111 jokers
  const card = id => id >= JOKER0 ? { id, j: true } : { id, s: SUITS[Math.floor((id % 52) / 13)], r: (id % 13) + 1 };
  const isJ = id => id >= JOKER0;
  const PEN = id => isJ(id) ? 20 : (c => c.r === 1 ? 15 : c.r >= 10 ? 10 : c.r)(card(id));
  const RANK = r => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));

  // ---------- meld rules ----------
  // set: 3+ cards, naturals all one rank (suits may repeat), at least 2 naturals, max 14
  function asSet(ids) {
    if (ids.length < 3 || ids.length > 14) return null;
    const nat = ids.filter(i => !isJ(i)).map(card);
    if (nat.length < 2) return null;
    const r = nat[0].r;
    if (!nat.every(c => c.r === r)) return null;
    return { type: 'set', r, cards: ids.map(i => ({ id: i, as: isJ(i) ? { r } : null })) };
  }
  // run: 3+ cards, naturals one suit, consecutive with jokers filling gaps; ace low (1) or high (14); no wrap
  function asRun(ids) {
    if (ids.length < 3 || ids.length > 14) return null;
    const nat = ids.filter(i => !isJ(i)).map(card), jk = ids.filter(isJ);
    if (nat.length < 2) return null;
    const s = nat[0].s;
    if (!nat.every(c => c.s === s)) return null;
    const tries = [];
    const aces = nat.filter(c => c.r === 1).length;
    if (aces > 2) return null;
    // ace placements: all low, all high, or (two aces) one low one high
    const opts = aces === 0 ? [[]] : aces === 1 ? [[1], [14]] : [[1, 14]];
    for (const ap of opts) {
      const ranks = nat.filter(c => c.r !== 1).map(c => c.r).concat(ap).sort((a, b) => a - b);
      if (new Set(ranks).size !== ranks.length) continue;
      const lo = ranks[0], hi = ranks[ranks.length - 1];
      const gaps = hi - lo + 1 - ranks.length;
      if (gaps > jk.length) continue;
      let extra = jk.length - gaps;
      // extra jokers extend upward first, then downward, inside 1..14
      let top = hi, bot = lo;
      while (extra > 0 && top < 14) { top++; extra--; }
      while (extra > 0 && bot > 1) { bot--; extra--; }
      if (extra > 0) continue;
      tries.push({ lo: bot, hi: top, ap });
    }
    if (!tries.length) return null;
    const t = tries[0];
    // lay out: naturals in place, jokers fill the holes
    const byRank = {};
    let aceLeft = t.ap.slice();
    for (const c of nat) { const rr = c.r === 1 ? aceLeft.shift() : c.r; byRank[rr] = c.id; }
    const js = jk.slice(), cards = [];
    for (let r = t.lo; r <= t.hi; r++) {
      if (byRank[r] != null) cards.push({ id: byRank[r], as: null });
      else cards.push({ id: js.shift(), as: { r, s } });
    }
    return { type: 'run', s, lo: t.lo, hi: t.hi, cards };
  }
  const asMeld = ids => asRun(ids) || asSet(ids);
  // add cards to an existing meld (keeps its type)
  function layOn(meld, ids) {
    const all = meld.cards.map(c => c.id).concat(ids);
    return meld.type === 'run' ? asRun(all) : asSet(all);
  }
  // swap: a natural card that matches what a joker stands for takes its place; the joker comes back
  function swapIn(meld, id) {
    if (isJ(id)) return null;
    const c = card(id);
    const i = meld.cards.findIndex(x => isJ(x.id) && x.as && (meld.type === 'set' ? c.r === x.as.r : c.s === x.as.s && (c.r === x.as.r || (c.r === 1 && x.as.r === 14))));
    if (i < 0) return null;
    const joker = meld.cards[i].id;
    const ids = meld.cards.map(x => x.id); ids[i] = id;
    const m = meld.type === 'run' ? asRun(ids) : asSet(ids);
    return m ? { meld: m, joker } : null;
  }

  // ---------- search (for bots, hints and DEAD checks) ----------
  // find one meld in a hand; runOnly for the passport
  function findMeld(hand, runOnly) {
    const nat = hand.filter(i => !isJ(i)).map(card), jk = hand.filter(isJ);
    let best = null;
    // runs: per suit, walk 1..14 using naturals, filling single gaps with jokers
    for (const s of SUITS) {
      const have = {};
      for (const c of nat) if (c.s === s) { if (have[c.r] == null) have[c.r] = c.id; if (c.r === 1 && have[14] == null) have[14] = c.id; }
      for (let lo = 1; lo <= 12; lo++) {
        if (have[lo] == null) continue;
        const used = new Set([have[lo]]), ids = [have[lo]]; let j = 0;
        for (let r = lo + 1; r <= 14; r++) {
          if (have[r] != null && !used.has(have[r])) { ids.push(have[r]); used.add(have[r]); }
          else if (j < jk.length && r < 14) { ids.push(jk[j++]); }
          else break;
          const real = ids.filter(i => !isJ(i)).length;
          if (ids.length >= 3 && real >= 2 && asRun(ids) && (!best || ids.length > best.length)) best = ids.slice();
        }
      }
    }
    if (best || runOnly) return best;
    // sets: same rank
    const byR = {};
    for (const c of nat) (byR[c.r] = byR[c.r] || []).push(c.id);
    for (const r in byR) {
      const g = byR[r];
      if (g.length >= 3) return g.slice();
      if (g.length === 2 && jk.length) return g.concat([jk[0]]);
    }
    return null;
  }
  // one legal lay-off: { mid, ids } (single card)
  function findLay(hand, melds) {
    for (const id of hand.filter(i => !isJ(i)).concat(hand.filter(isJ))) for (const m of melds) if (layOn(m, [id])) return { mid: m.id, ids: [id] };
    return null;
  }
  function canAct(hand, melds, passport) {
    if (!passport) return !!findMeld(hand, true);
    return !!(findMeld(hand) || findLay(hand, melds));
  }

  const LINES = {
    port: ['Passport!', 'Buka dulu!', 'Saya buka!'],
    dead: ['Mati lah...', 'SI!', 'Takde jalan...', 'Habis, mati.'],
    game: ['GAME!', 'Habis kad!', 'Lami!'],
    slow: ['Cepat lah...', 'Fikir lama sangat!'],
    win: ['Raja Lami!', 'Kad semua habis!', 'Huat ah!'],
  };
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14);
  const HANDS = 4, MAX = 4, MIN = 2, TURN_SEC = 60;

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
      this.hands = {};
      this.s = {
        game: 'lami', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], seats: [], hand: 0, hands: HANDS, round: 0, dealer: 0, cur: null, acted: false,
        melds: [], result: null, ranking: null, winner: null, log: [],
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
    seated() { return this.s.seats.map(id => this.p(id)).filter(Boolean); }
    syncCounts() { for (const p of this.s.players) { p.count = (this.hands[p.id] || []).length; p.pts = (this.hands[p.id] || []).reduce((a, i) => a + PEN(i), 0); } }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Lami is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', connected: true, isBot: !!info.isBot, inGame: !late, total: 0, wins: 0, count: 0, pts: 0, passport: false, dead: false, games: 0 };
      this.s.players.push(pl);
      this.log(pl.name + (late ? ' masuk (next game)' : ' masuk'));
      this.changed();
      return { ok: true };
    }
    addBot() {
      const used = new Set(this.s.players.map(p => p.name));
      const avatar = this.pick(AV), S = typeof root !== 'undefined' && root.SPR;
      const name = (S && S.randomName) ? S.randomName(avatar, used) : ['Uncle Lim', 'Kak Ros', 'Ah Seng', 'Muthu'].find(n => !used.has(n)) || 'Bot';
      return this.addPlayer({ id: 'bot-' + Math.floor(this.rng() * 1e9).toString(36), name, avatar, isBot: true });
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline — auto play'); if (this.s.phase === 'turn' && this.s.cur === id) this.step(() => this.autoTurn(id), 1500); }
      this.changed();
    }
    kick(id) {
      if (id === this.s.hostId) return;
      const mid = this.s.phase !== 'lobby' && this.s.phase !== 'over' && this.s.seats.includes(id);
      this.s.players = this.s.players.filter(x => x.id !== id);
      if (mid) { this.s.seats = this.s.seats.filter(x => x !== id); this.endHand(null); }
      this.changed();
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < MIN || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.total = 0; p.games = 0; }
      S.seats = S.players.map(p => p.id);
      for (let i = S.seats.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.seats[i], S.seats[j]] = [S.seats[j], S.seats[i]]; }
      S.round++; S.hand = 0; S.ranking = null; S.winner = null;
      this.log('Game ' + S.round + ' · ' + S.seats.length + ' players · ' + HANDS + ' hands');
      this.startHand();
    }
    startHand() {
      const S = this.s;
      S.hand++;
      if (S.hand > HANDS) { this.finish(); return; }
      const deck = Array.from({ length: 112 }, (_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      const per = S.seats.length === 3 ? 25 : 20;
      this.hands = {};
      for (const id of S.seats) { this.hands[id] = deck.splice(0, per); const p = this.p(id); p.passport = false; p.dead = false; p.out = false; }
      S.melds = []; S.result = null; this.mid = 0;
      S.dealer = (S.hand - 1) % S.seats.length;
      this.syncCounts();
      this.fx({ type: 'banner', text: 'HAND ' + S.hand + '/' + HANDS, style: 'info' });
      this.fx({ type: 'deal' });
      S.phase = 'deal';
      this.changed();
      this.step(() => this.beginTurn((S.dealer + 1) % S.seats.length), 1600);
    }
    live() { return this.seated().filter(p => !p.dead && !p.out); }
    beginTurn(idx) {
      const S = this.s;
      if (!this.live().length) { this.endHand(null); return; }
      // skip the dead
      for (let k = 0; k < S.seats.length; k++) { const p = this.p(S.seats[(idx + k) % S.seats.length]); if (p && !p.dead && !p.out) { idx = (idx + k) % S.seats.length; break; } }
      const pid = S.seats[idx], pl = this.p(pid);
      S.cur = pid; S.acted = false; S.phase = 'turn';
      // can't do anything at all? dead (or no passport = dead)
      if (!canAct(this.hands[pid], S.melds, pl.passport)) { this.die(pid, !pl.passport); return; }
      this.fx({ type: 'turn', pid });
      this.setTimer('turn', TURN_SEC, () => { this.say(pid, 'slow'); this.autoTurn(pid, true); });
      if (pl.isBot || !pl.connected) this.step(() => this.botTurn(pid), pl.isBot ? 900 + this.rng() * 900 : 1000);
      this.syncCounts();
      this.changed();
    }
    die(pid, noPort) {
      const S = this.s, pl = this.p(pid);
      pl.dead = true;
      this.fx({ type: 'dead', pid, noPort: !!noPort });
      this.say(pid, 'dead', 'sad');
      this.log(pl.name + (noPort ? ' takde passport — MATI' : ' MATI') + ' · ' + this.hands[pid].reduce((a, i) => a + PEN(i), 0) + ' pts');
      this.syncCounts();
      this.changed();
      const idx = S.seats.indexOf(pid);
      this.step(() => { if (this.live().length) this.beginTurn((idx + 1) % S.seats.length); else this.endHand(null); }, 1200);
    }
    take(pid, ids) { const h = this.hands[pid]; for (const i of ids) h.splice(h.indexOf(i), 1); }
    has(pid, ids) { const h = this.hands[pid]; return ids.length && new Set(ids).size === ids.length && ids.every(i => h.includes(i)); }

    meld(pid, ids) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'turn' || S.cur !== pid || !this.has(pid, ids)) return false;
      const m = pl.passport ? asMeld(ids) : asRun(ids);
      if (!m) { this.fx({ type: 'nope', pid, why: pl.passport ? 'bad' : 'port' }); return false; }
      this.take(pid, ids);
      m.id = ++this.mid; m.owner = pid;
      S.melds.push(m);
      const first = !pl.passport;
      pl.passport = true; S.acted = true;
      this.fx({ type: 'meld', pid, mid: m.id, first });
      if (first) this.say(pid, 'port', 'happy');
      this.afterAction(pid);
      return true;
    }
    lay(pid, mid, ids) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'turn' || S.cur !== pid || !pl.passport || !this.has(pid, ids)) return false;
      const i = S.melds.findIndex(m => m.id === mid); if (i < 0) return false;
      const m = layOn(S.melds[i], ids);
      if (!m) { this.fx({ type: 'nope', pid, why: 'bad' }); return false; }
      this.take(pid, ids);
      m.id = S.melds[i].id; m.owner = S.melds[i].owner;
      S.melds[i] = m; S.acted = true;
      this.fx({ type: 'lay', pid, mid });
      this.afterAction(pid);
      return true;
    }
    swap(pid, mid, id) {
      const S = this.s, pl = this.p(pid);
      if (S.phase !== 'turn' || S.cur !== pid || !pl.passport || !this.has(pid, [id])) return false;
      const i = S.melds.findIndex(m => m.id === mid); if (i < 0) return false;
      const r = swapIn(S.melds[i], id);
      if (!r) { this.fx({ type: 'nope', pid, why: 'swap' }); return false; }
      this.take(pid, [id]); this.hands[pid].push(r.joker);
      r.meld.id = S.melds[i].id; r.meld.owner = S.melds[i].owner;
      S.melds[i] = r.meld;
      this.fx({ type: 'swap', pid, mid });
      this.syncCounts(); this.changed();
      return true;
    }
    afterAction(pid) {
      this.syncCounts();
      if (!this.hands[pid].length) { this.endHand(pid); return; }
      this.changed();
    }
    endTurn(pid) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid || !S.acted) return;
      this.clearTimer();
      this.beginTurn((S.seats.indexOf(pid) + 1) % S.seats.length);
    }

    endHand(winner) {
      const S = this.s;
      this.clearTimer();
      S.phase = 'result'; S.cur = null;
      this.syncCounts();
      const rows = this.seated().map(p => ({ id: p.id, pts: p.id === winner ? 0 : p.pts, left: (this.hands[p.id] || []).slice(), dead: p.dead }));
      rows.sort((a, b) => a.pts - b.pts);
      for (const r of rows) { const p = this.p(r.id); p.total += r.pts; }
      const top = winner || (rows[0] && rows[0].id);
      if (top) this.p(top).games++;
      S.result = { winner: winner || null, best: top, rows };
      if (winner) { const p = this.p(winner); p.out = true; this.fx({ type: 'game', pid: winner }); this.fx({ type: 'banner', text: 'GAME!', style: 'win' }); this.say(winner, 'game', 'happy'); this.log(p.name + ' GAME! habis kad'); }
      else { this.fx({ type: 'banner', text: 'SEMUA MATI', style: 'info' }); this.log('Semua mati · ' + (top ? this.p(top).name + ' paling sikit' : '')); }
      this.changed();
      this.setTimer('result', 9, () => this.startHand());
    }
    next() { if (this.s.phase === 'result') { this.clearTimer(); this.startHand(); } }
    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.cur = null;
      const r = this.seated().sort((a, b) => a.total - b.total);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, total: p.total, games: p.games }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.total + ' pts' : '-'));
      this.changed();
    }

    // ---------- bots / auto play: do one action at a time, a bit apart ----------
    botStep(pid) {
      const S = this.s, pl = this.p(pid), h = this.hands[pid];
      if (!pl.passport) { const m = findMeld(h, true); return m ? this.meld(pid, m) : false; }
      // swap jokers back first (free), then melds, then lay-offs
      for (const m of S.melds) for (const id of h) if (!isJ(id) && swapIn(m, id)) return this.swap(pid, m.id, id);
      const m = findMeld(h); if (m) return this.meld(pid, m);
      const l = findLay(h, S.melds); if (l) return this.lay(pid, l.mid, l.ids);
      return false;
    }
    botTurn(pid) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid) return;
      const did = this.botStep(pid);
      if (S.phase !== 'turn' || S.cur !== pid) return;
      if (did) this.step(() => this.botTurn(pid), 500 + this.rng() * 400);
      else this.endTurn(pid);
    }
    autoTurn(pid) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid) return;
      if (!S.acted && !this.botStep(pid)) { this.die(pid); return; }
      if (S.phase === 'turn' && S.cur === pid) this.endTurn(pid);
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      const ids = Array.isArray(m.ids) ? m.ids.map(x => x | 0).slice(0, 25) : [];
      if (m.t === 'meld') return void this.meld(id, ids);
      if (m.t === 'lay') return void this.lay(id, m.mid | 0, ids);
      if (m.t === 'swap') return void this.swap(id, m.mid | 0, m.id | 0);
      if (m.t === 'endTurn') return this.endTurn(id);
      if (m.t === 'emote') {
        const pl = this.p(id); if (!pl) return;
        const now = this.now(); if (pl._le && now - pl._le < 1200) return; pl._le = now;
        const text = String(m.text || '').slice(0, 24); if (text) this.fx({ type: 'emote', pid: id, text });
        return;
      }
      if (id !== this.s.hostId) return;
      if (m.t === 'start' || m.t === 'newGame') return this.start();
      if (m.t === 'next') return this.next();
      if (m.t === 'addBot') return this.addBot();
      if (m.t === 'kick') return this.kick(m.id);
    }
    publicState() {
      const out = JSON.parse(JSON.stringify(this.s, (k, v) => (k.startsWith('_') ? undefined : v)));
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
    privateFor(pid) {
      const h = this.hands[pid];
      if (!h) return null;
      return { key: this.s.round + ':' + this.s.hand, hand: h.slice() };
    }
  }

  const api = { Table, card, isJ, PEN, RANK, SUITS, asSet, asRun, asMeld, layOn, swapIn, findMeld, findLay, canAct, HANDS, MAX, MIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LAMI = api;
})(this);
