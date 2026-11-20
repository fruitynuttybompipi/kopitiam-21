/* Kopitiam 21 — Mamak Mahjong: a mahjong-lite with kopitiam tiles. 12 kinds × 4 copies.
   Hold 7 tiles. Draw one; win with 2 sets of three-of-a-kind + 1 pair (MAKAN!). Otherwise buang (discard).
   Anyone holding a pair can CHOP a discard to make an open set, and anyone it completes can MAKAN it.
   Host engine. Hands are private: each player only gets their own tiles (privateFor). */
(function (root) {
  'use strict';

  const KINDS = [
    { id: 'kopi', label: 'KOPI', icon: 'kopi:panas' },
    { id: 'teh', label: 'TEH', icon: 'teh:panas' },
    { id: 'tehtarik', label: 'TARIK', icon: 'tehtarik:panas' },
    { id: 'milo', label: 'MILO', icon: 'milo:ais' },
    { id: 'bandung', label: 'SIRAP', icon: 'bandung:ais' },
    { id: 'limau', label: 'LIMAU', icon: 'limau:ais' },
    { id: 'nasilemak', label: 'LEMAK', icon: 'nasilemak' },
    { id: 'roticanai', label: 'ROTI', icon: 'roticanai' },
    { id: 'ckt', label: 'CKT', icon: 'ckt' },
    { id: 'wantanmee', label: 'MEE', icon: 'wantanmee' },
    { id: 'rojak', label: 'ROJAK', icon: 'rojak' },
    { id: 'telur', label: 'TELUR', icon: 'telur' },
  ];
  const kindOf = n => Math.floor(n / 4);
  const HAND = 7, SETS = 2, HANDS = 4, MAX = 4, MIN = 2;
  const TURN_SEC = 20, CLAIM_SEC = 5;
  const PTS = { win: 10, self: 5, closed: 5, feed: -5 };

  // kinds (numbers 0-11) + how many open sets already -> is it 2 sets + 1 pair?
  function isWin(kinds, exposed) {
    const need = SETS - (exposed || 0);
    if (kinds.length !== need * 3 + 2) return false;
    const c = new Array(KINDS.length).fill(0);
    for (const k of kinds) c[k]++;
    for (let p = 0; p < c.length; p++) {
      if (c[p] < 2) continue;
      c[p] -= 2;
      const ok = c.every(x => x % 3 === 0);
      c[p] += 2;
      if (ok) return true;
    }
    return false;
  }
  // which kinds would finish this hand (for the "TUNGGU" hint)
  function waits(kinds, exposed) {
    const out = [];
    for (let k = 0; k < KINDS.length; k++) if (isWin(kinds.concat([k]), exposed)) out.push(k);
    return out;
  }

  const LINES = {
    chop: ['CHOP!', 'Saya punya!', 'Eh, bagi sini!'],
    makan: ['MAKAN!', 'Terima kasih ya!', 'Sedap!'],
    self: ['MAKAN SENDIRI!', 'Tarik sendiri, makan sendiri!', 'Huat ah!'],
    fed: ['Alamak, saya bagi makan...', 'Aiyo, salah buang!', 'Kenapa saya buang tu...'],
    slow: ['Cepat lah buang!', 'Fikir lama sangat...'],
    draw: ['Seri lah...', 'Tembok habis!'],
    win: ['Raja Mamak!', 'Tauke mahjong!', 'Kopi semua saya belanja!'],
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
      this.hands = {};     // pid -> [tile numbers]  (private)
      this.wall = [];
      this.s = {
        game: 'mamak', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], seats: [], hand: 0, hands: HANDS, round: 0, dealer: 0, cur: null, wallLeft: 0,
        discards: [], last: null, claimFrom: null, result: null, ranking: null, winner: null, log: [],
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
    kinds(pid) { return (this.hands[pid] || []).map(kindOf); }
    sortHand(pid) { const h = this.hands[pid]; if (h) h.sort((a, b) => a - b); }
    syncCounts() { for (const p of this.s.players) p.count = (this.hands[p.id] || []).length; this.s.wallLeft = this.wall.length; }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= MAX) return { ok: false, reason: 'Mamak Mahjong is max ' + MAX + ' players — meja penuh!' };
      const late = this.s.phase !== 'lobby' && this.s.phase !== 'over';
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', connected: true, isBot: !!info.isBot, inGame: !late, score: 0, wins: 0, count: 0, exposed: [] };
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
      else {
        pl.connected = false; this.log(pl.name + ' offline — auto play');
        if (this.s.phase === 'turn' && this.s.cur === id) this.step(() => this.autoTurn(id), 1500);
        if (this.s.phase === 'claim') this.claim(id, { what: 'pass' });
      }
      this.changed();
    }
    kick(id) {
      if (id === this.s.hostId) return;
      const mid = this.s.phase !== 'lobby' && this.s.phase !== 'over' && this.s.seats.includes(id);
      this.s.players = this.s.players.filter(x => x.id !== id);
      if (mid) { this.log('Hand dibatalkan'); this.s.seats = this.s.seats.filter(x => x !== id); this.endHand(null); }
      this.changed();
    }

    // ---------- flow ----------
    start() {
      const S = this.s;
      if (S.players.length < MIN || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) { p.inGame = true; p.score = 0; p.exposed = []; p.count = 0; }
      S.seats = S.players.map(p => p.id);
      for (let i = S.seats.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.seats[i], S.seats[j]] = [S.seats[j], S.seats[i]]; }
      S.round++; S.hand = 0; S.dealer = 0; S.ranking = null; S.winner = null;
      this.log('Game ' + S.round + ' · ' + S.seats.length + ' players · ' + HANDS + ' hands');
      this.startHand();
    }
    startHand() {
      const S = this.s;
      S.hand++;
      if (S.hand > HANDS) { this.finish(); return; }
      this.wall = Array.from({ length: KINDS.length * 4 }, (_, i) => i);
      for (let i = this.wall.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.wall[i], this.wall[j]] = [this.wall[j], this.wall[i]]; }
      this.hands = {};
      for (const id of S.seats) { this.hands[id] = this.wall.splice(0, HAND); this.sortHand(id); const p = this.p(id); if (p) p.exposed = []; }
      S.discards = []; S.last = null; S.result = null; S.claimFrom = null;
      S.dealer = (S.hand - 1) % S.seats.length;
      this.syncCounts();
      const d = this.p(S.seats[S.dealer]);
      this.fx({ type: 'banner', text: 'HAND ' + S.hand + '/' + HANDS, style: 'info' });
      this.fx({ type: 'deal' });
      this.log('Hand ' + S.hand + ' · dealer ' + (d ? d.name : '?'));
      S.phase = 'deal';
      this.changed();
      this.step(() => this.beginTurn(S.dealer, true), 1600);
    }
    beginTurn(idx, draw) {
      const S = this.s;
      const pid = S.seats[idx];
      S.cur = pid; S.last = null; S.claimFrom = null; this.claims = null;
      this.drawn = null;
      if (draw) {
        if (!this.wall.length) { this.endHand(null); return; }
        const t = this.wall.pop();
        this.hands[pid].push(t); this.drawn = t;
        this.fx({ type: 'draw', pid });
      }
      S.phase = 'turn';
      this.syncCounts();
      const pl = this.p(pid);
      this.setTimer('turn', TURN_SEC, () => { this.say(pid, 'slow'); this.autoTurn(pid); });
      if (pl && (pl.isBot || !pl.connected)) this.step(() => this.botTurn(pid), pl.isBot ? 900 + this.rng() * 900 : 1200);
      this.changed();
    }
    canSelfWin(pid) { const p = this.p(pid); return isWin(this.kinds(pid), p ? p.exposed.length : 0); }

    discard(pid, n) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid) return;
      const h = this.hands[pid], i = h.indexOf(n);
      if (i < 0) return;
      this.clearTimer();
      h.splice(i, 1); this.sortHand(pid); this.drawn = null;
      const k = kindOf(n);
      S.discards.push({ n, k, by: pid });
      S.last = { n, k, by: pid };
      this.fx({ type: 'discard', pid, k });
      this.syncCounts();
      // who can take it?
      const from = S.seats.indexOf(pid);
      const order = S.seats.map((_, j) => S.seats[(from + 1 + j) % S.seats.length]).filter(id => id !== pid);
      this.claims = { order, can: {}, said: {} };
      for (const id of order) {
        const p = this.p(id), ks = this.kinds(id);
        const makan = isWin(ks.concat([k]), p.exposed.length);
        const chop = ks.filter(x => x === k).length >= 2;
        if (makan || chop) this.claims.can[id] = { makan, chop };
      }
      const who = Object.keys(this.claims.can);
      if (!who.length) { S.phase = 'pass'; this.changed(); this.step(() => this.beginTurn((from + 1) % S.seats.length, true), 700); return; }
      S.phase = 'claim'; S.claimFrom = pid;
      this.setTimer('claim', CLAIM_SEC, () => this.resolveClaims());
      for (const id of who) { const p = this.p(id); if (p.isBot || !p.connected) this.step(() => this.botClaim(id), p.isBot ? 500 + this.rng() * 900 : 300); }
      this.changed();
    }
    claim(pid, m) {
      const S = this.s, c = this.claims;
      if (S.phase !== 'claim' || !c || !c.can[pid] || c.said[pid]) return;
      const what = m.what === 'makan' && c.can[pid].makan ? 'makan' : m.what === 'chop' && c.can[pid].chop ? 'chop' : 'pass';
      c.said[pid] = what;
      // a MAKAN from the next player in line can't be beaten: settle now
      if (Object.keys(c.can).every(id => c.said[id]) || (what === 'makan' && c.order.filter(id => c.can[id] && c.can[id].makan).find(id => !c.said[id] || c.said[id] === 'makan') === pid)) this.resolveClaims();
      else this.changed();
    }
    resolveClaims() {
      const S = this.s, c = this.claims;
      if (S.phase !== 'claim' || !c) return;
      this.clearTimer();
      const last = S.last;
      const winner = c.order.find(id => c.said[id] === 'makan');
      if (winner) {
        this.hands[winner].push(last.n); this.sortHand(winner);
        S.discards.pop();
        this.endHand(winner, last.by);
        return;
      }
      const chopper = c.order.find(id => c.said[id] === 'chop');
      if (chopper) {
        const h = this.hands[chopper];
        let took = 0;
        for (let i = h.length - 1; i >= 0 && took < 2; i--) if (kindOf(h[i]) === last.k) { h.splice(i, 1); took++; }
        const p = this.p(chopper);
        p.exposed.push(last.k);
        S.discards.pop();
        this.fx({ type: 'chop', pid: chopper, k: last.k, from: last.by });
        this.fx({ type: 'banner', text: 'CHOP!', style: 'info' });
        this.say(chopper, 'chop', 'happy');
        this.log(p.name + ' chop ' + KINDS[last.k].label);
        this.syncCounts();
        this.beginTurn(S.seats.indexOf(chopper), false);
        return;
      }
      const from = S.seats.indexOf(last.by);
      this.beginTurn((from + 1) % S.seats.length, true);
    }

    selfWin(pid) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid || !this.canSelfWin(pid)) return;
      this.clearTimer();
      this.endHand(pid, null);
    }

    endHand(winner, fedBy) {
      const S = this.s;
      this.clearTimer();
      S.phase = 'result'; S.last = null; S.claimFrom = null; this.claims = null;
      if (!winner) {
        S.result = { draw: true };
        this.fx({ type: 'banner', text: 'SERI · TEMBOK HABIS', style: 'info' });
        this.say(S.seats[0], 'draw');
        this.log('Hand ' + S.hand + ' seri');
      } else {
        const p = this.p(winner), self = !fedBy, closed = !p.exposed.length;
        let pts = PTS.win + (self ? PTS.self : 0) + (closed ? PTS.closed : 0);
        p.score += pts;
        const feeder = fedBy && this.p(fedBy);
        if (feeder) feeder.score += PTS.feed;
        S.result = { winner, self, closed, pts, fedBy: fedBy || null, feed: feeder ? PTS.feed : 0, tiles: this.kinds(winner), exposed: p.exposed.slice() };
        this.fx({ type: 'makan', pid: winner, self, from: fedBy || null });
        this.fx({ type: 'banner', text: self ? 'MAKAN SENDIRI!' : 'MAKAN!', style: 'win' });
        this.say(winner, self ? 'self' : 'makan', 'happy');
        if (feeder) this.step(() => this.say(feeder.id, 'fed', 'sad'), 900);
        this.log(p.name + (self ? ' makan sendiri' : ' makan dari ' + feeder.name) + ' · +' + pts);
      }
      this.syncCounts();
      this.changed();
      this.setTimer('result', 7, () => this.startHand());
    }
    next() { if (this.s.phase === 'result') { this.clearTimer(); this.startHand(); } }

    finish() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'over'; S.cur = null; S.result = null;
      const r = this.seated().sort((a, b) => b.score - a.score);
      S.ranking = r.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score }));
      const w = r[0]; S.winner = w ? w.id : null;
      if (w) w.wins++;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: S.winner });
      if (w) this.say(w.id, 'win', 'happy');
      this.log('Winner: ' + (w ? w.name + ' · ' + w.score : '-'));
      this.changed();
    }

    // ---------- bots (and auto-play for offline/slow players) ----------
    pickDiscard(pid) {
      const h = this.hands[pid], ks = h.map(kindOf);
      const cnt = k => ks.filter(x => x === k).length;
      const seen = k => this.s.discards.filter(d => d.k === k).length;
      let best = null, bs = 1e9;
      for (const n of h) {
        const k = kindOf(n);
        // keep sets and pairs; throw singles, preferring ones whose copies are already gone
        const sc = cnt(k) * 10 - seen(k) * 3 + this.rng() * 2;
        if (sc < bs) { bs = sc; best = n; }
      }
      return best;
    }
    autoTurn(pid) {
      const S = this.s;
      if (S.phase !== 'turn' || S.cur !== pid) return;
      if (this.canSelfWin(pid)) { this.selfWin(pid); return; }
      const h = this.hands[pid];
      const p = this.p(pid);
      this.discard(pid, p && p.isBot ? this.pickDiscard(pid) : (this.drawn != null && h.includes(this.drawn) ? this.drawn : this.pickDiscard(pid)));
    }
    botTurn(pid) { this.autoTurn(pid); }
    botClaim(pid) {
      const c = this.claims; if (!c || !c.can[pid]) return;
      const p = this.p(pid);
      if (c.can[pid].makan) return this.claim(pid, { what: 'makan' });
      if (c.can[pid].chop && p.isBot && this.rng() < 0.75) return this.claim(pid, { what: 'chop' });
      this.claim(pid, { what: 'pass' });
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'discard') return this.discard(id, m.n | 0);
      if (m.t === 'selfwin') return this.selfWin(id);
      if (m.t === 'claim') return this.claim(id, m);
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
      if (this.claims && this.s.phase === 'claim') out.claimSaid = Object.keys(this.claims.said);
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal } : null;
      return out;
    }
    // what only this player may see
    privateFor(pid) {
      const h = this.hands[pid];
      if (!h) return null;
      const S = this.s, p = this.p(pid);
      const c = this.claims && S.phase === 'claim' ? this.claims.can[pid] : null;
      const myTurn = S.phase === 'turn' && S.cur === pid;
      return {
        key: S.round + ':' + S.hand,
        hand: h.slice(),
        drawn: myTurn ? this.drawn : null,
        canWin: myTurn && this.canSelfWin(pid),
        claim: c && !this.claims.said[pid] ? { makan: c.makan, chop: c.chop } : null,
        waits: !myTurn && h.length === HAND - 3 * (p ? p.exposed.length : 0) ? waits(h.map(kindOf), p ? p.exposed.length : 0) : [],
      };
    }
  }

  const api = { Table, KINDS, kindOf, isWin, waits, HAND, HANDS, MAX, MIN, PTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MAMAK = api;
})(this);
