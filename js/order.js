/* Kopitiam 21 — Ingat Order: customers order out loud, you key it into the tablet from memory.
   Players take turns; each turn is one table. 5 tables each, getting harder. Host engine. */
(function (root) {
  'use strict';

  const DRINKS = [
    { id: 'kopi', name: 'Kopi', col: '#a8703f' },
    { id: 'kopio', name: 'Kopi-O', col: '#3a2010' },
    { id: 'kopic', name: 'Kopi-C', col: '#c08a50' },
    { id: 'teh', name: 'Teh', col: '#c98a4a' },
    { id: 'teho', name: 'Teh-O', col: '#b8601e' },
    { id: 'tehtarik', name: 'Teh Tarik', col: '#d2a066' },
    { id: 'milo', name: 'Milo', col: '#6a4028' },
    { id: 'bandung', name: 'Sirap Bandung', col: '#f58ab0' },
    { id: 'limau', name: 'Limau', col: '#b8e05a' },
  ];
  const FOODS = [
    { id: 'nasilemak', name: 'Nasi Lemak' },
    { id: 'roticanai', name: 'Roti Canai' },
    { id: 'ckt', name: 'Char Kuey Teow' },
    { id: 'wantanmee', name: 'Wantan Mee' },
    { id: 'rojak', name: 'Rojak' },
    { id: 'rotibakar', name: 'Roti Bakar' },
    { id: 'telur', name: 'Telur Separuh Masak' },
  ];
  // item keys: drinks "kopio:ais" / "kopio:panas", food "nasilemak"
  const KEYS = [];
  for (const d of DRINKS) { KEYS.push(d.id + ':panas'); KEYS.push(d.id + ':ais'); }
  for (const f of FOODS) KEYS.push(f.id);
  function itemName(key) {
    const [id, t] = String(key).split(':');
    const d = DRINKS.find(x => x.id === id);
    if (d) return d.name + (t === 'ais' ? ' Ais' : ' Panas');
    const f = FOODS.find(x => x.id === id);
    return f ? f.name : key;
  }
  const NUM = ['', 'satu', 'dua', 'tiga', 'empat'];

  const LEVELS = [
    { cust: 1, min: 1, max: 2, dbl: 0, tambah: 0, tukar: 0 },
    { cust: 2, min: 2, max: 4, dbl: 0, tambah: 0, tukar: 0 },
    { cust: 3, min: 3, max: 6, dbl: 0.15, tambah: 0.35, tukar: 0 },
    { cust: 4, min: 5, max: 8, dbl: 0.15, tambah: 0.35, tukar: 0 },
    { cust: 4, min: 6, max: 9, dbl: 0.2, tambah: 1, tukar: 1 },
  ];
  const ANSWER_TIME = 30;

  // how long each spoken line stays up (ms) — shared by host and clients so they stay in step
  function stepMs(step) { return 1500 + 900 * step.items.length + (step.kind === 'tukar' ? 600 : 0); }
  function showMs(script) { return 1400 + script.steps.reduce((a, s) => a + stepMs(s) + 450, 0) + 600; }

  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DR = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];
  const FALLBACK = ['Ali', 'Mei', 'Raju', 'Siti', 'Ah Kow', 'Jenny', 'Hafiz', 'Lakshmi'];

  function genOrder(level, rng) {
    const cfg = LEVELS[Math.max(0, Math.min(4, level - 1))];
    const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = a => a[Math.floor(rng() * a.length)];
    const S = root.SPR;
    const n = ri(cfg.min, cfg.max);
    const c = Math.min(cfg.cust, n);
    const used = new Set();
    const customers = [];
    for (let i = 0; i < c; i++) {
      const avatar = pick(AV);
      const name = S && S.randomName ? S.randomName(avatar, used) : pick(FALLBACK);
      used.add(name);
      customers.push({ avatar, name });
    }
    const counts = customers.map(() => 1);
    for (let k = c; k < n; k++) counts[ri(0, c - 1)]++;
    const randKey = () => (rng() < 0.62 ? pick(DRINKS).id + (rng() < 0.5 ? ':ais' : ':panas') : pick(FOODS).id);
    const steps = [];
    const lines = []; // every item a customer said, so "tukar" can refer back to one
    customers.forEach((cu, i) => {
      const items = [];
      for (let k = 0; k < counts[i]; k++) {
        let key = randKey(), tries = 0;
        while (items.some(it => it.key === key) && tries++ < 10) key = randKey();
        const ex = items.find(it => it.key === key);
        if (ex) ex.qty++; else items.push({ key, qty: rng() < cfg.dbl ? 2 : 1 });
      }
      items.forEach(it => lines.push({ who: i, key: it.key }));
      steps.push({ who: i, kind: 'order', items, text: orderText(items, rng) });
    });
    // extra orders arrive after everyone has ordered
    let nT = 0;
    if (cfg.tambah >= 1) nT = ri(1, 2); else if (rng() < cfg.tambah) nT = 1;
    for (let k = 0; k < nT; k++) {
      const who = ri(0, c - 1), key = randKey();
      steps.push({ who, kind: 'tambah', items: [{ key, qty: 1 }], text: 'Eh, tambah ' + NUM[1] + ' ' + itemName(key) + '!' });
      lines.push({ who, key });
    }
    if (cfg.tukar) {
      const drinks = lines.filter(l => l.key.includes(':'));
      const from = drinks.length ? pick(drinks) : pick(lines);
      let to;
      if (from.key.includes(':')) {
        const [id, t] = from.key.split(':');
        to = rng() < 0.5 ? id + ':' + (t === 'ais' ? 'panas' : 'ais') : pick(DRINKS.filter(d => d.id !== id)).id + ':' + t;
      } else to = pick(FOODS.filter(f => f.id !== from.key)).id;
      steps.push({ who: from.who, kind: 'tukar', from: from.key, items: [{ key: to, qty: 1 }], text: 'Eh sorry, tukar ' + itemName(from.key) + ' jadi ' + itemName(to) + '!' });
    }
    // the correct order
    const expected = {};
    for (const s of steps) {
      if (s.kind === 'tukar') {
        if (expected[s.from]) { expected[s.from]--; if (!expected[s.from]) delete expected[s.from]; }
        expected[s.items[0].key] = (expected[s.items[0].key] || 0) + 1;
      } else for (const it of s.items) expected[it.key] = (expected[it.key] || 0) + it.qty;
    }
    return { customers, steps, expected };
  }
  function orderText(items, rng) {
    const pre = ['', 'Boss, ', 'Uncle, ', 'Adik, ', 'Saya nak ', 'Bagi '][Math.floor(rng() * 6)];
    const parts = items.map(it => itemName(it.key) + ' ' + NUM[it.qty]);
    const body = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' dengan ' + parts[parts.length - 1] : parts[0];
    return pre + body + '!';
  }

  function score(expected, chit) {
    const keys = new Set(Object.keys(expected).concat(Object.keys(chit)));
    const items = [];
    let correct = 0, wrong = 0, missing = 0;
    for (const key of keys) {
      const exp = expected[key] || 0, got = chit[key] || 0;
      const ok = Math.min(exp, got);
      correct += ok; wrong += Math.max(0, got - exp); missing += Math.max(0, exp - got);
      items.push({ key, exp, got });
    }
    items.sort((a, b) => (b.exp > 0) - (a.exp > 0) || KEYS.indexOf(a.key) - KEYS.indexOf(b.key));
    const perfect = wrong === 0 && missing === 0;
    const pts = Math.max(0, correct * 10 - wrong * 5) + (perfect ? 20 : 0);
    return { items, correct, wrong, missing, perfect, pts, total: Object.values(expected).reduce((a, b) => a + b, 0) };
  }

  const LINES = {
    perfect: ['Steady! Semua betul!', 'Pandai lah you!', 'Wah, ingatan gajah!'],
    ok: ['Boleh lah...', 'Hampir-hampir', 'Not bad lah'],
    bad: ['Aiyo, salah order!', 'Saya tak order ini!', 'Haiya, mana kopi saya?'],
  };
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
      this.expected = null;
      this.s = {
        game: 'order', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], order: [], level: 1, levels: LEVELS.length, turnIdx: 0, cur: null, turnNo: 0,
        script: null, chit: {}, result: null, round: 0, ranking: null, log: [],
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

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= 6) return { ok: false, reason: 'Ingat Order is max 6 players — meja penuh!' };
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', drink: DR.includes(info.drink) ? info.drink : 'kopio', connected: true, score: 0, perfect: 0, tables: 0, wins: 0 };
      this.s.players.push(pl);
      this.log(pl.name + (this.s.phase === 'lobby' || this.s.phase === 'over' ? ' masuk' : ' masuk (next game)'));
      this.changed();
      return { ok: true };
    }
    removePlayer(id) { this.disconnect(id); }
    disconnect(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'over') { this.s.players = this.s.players.filter(x => x.id !== id); this.log(pl.name + ' keluar'); }
      else { pl.connected = false; this.log(pl.name + ' offline'); }
      this.changed();
    }
    kick(id) { if (id !== this.s.hostId) { this.s.players = this.s.players.filter(x => x.id !== id); this.changed(); } }
    addBot() { /* no bots: they would remember everything */ }

    start() {
      const S = this.s;
      if (S.players.length < 1 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++; this.clearTimer();
      for (const p of S.players) Object.assign(p, { score: 0, perfect: 0, tables: 0 });
      S.order = S.players.map(p => p.id);
      for (let i = S.order.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; }
      S.level = 1; S.turnIdx = 0; S.ranking = null; S.round++;
      this.log('Game ' + S.round + ' · ' + S.order.length + ' waiter' + (S.order.length > 1 ? 's' : ''));
      this.fx({ type: 'banner', text: 'MEJA 1', style: 'info' });
      this.beginTurn();
    }
    beginTurn() {
      const S = this.s;
      const pid = S.order[S.turnIdx];
      const pl = this.p(pid);
      if (!pl) { this.next(); return; }
      S.cur = pid; S.turnNo++;
      const o = genOrder(S.level, this.rng);
      this.expected = o.expected;
      S.script = { customers: o.customers, steps: o.steps, id: S.turnNo };
      S.chit = {}; S.result = null;
      S.phase = 'show';
      const ms = showMs(S.script);
      this.fx({ type: 'show', pid, level: S.level, id: S.turnNo });
      this.log(pl.name + ' ambil order meja ' + S.level);
      this.setTimer('show', ms / 1000, () => this.toAnswer());
      this.changed();
    }
    toAnswer() {
      const S = this.s;
      S.phase = 'answer';
      this.fx({ type: 'answer', pid: S.cur });
      const pl = this.p(S.cur);
      this.setTimer('answer', pl && pl.connected ? ANSWER_TIME : 3, () => this.submit(S.cur, true));
      this.changed();
    }
    setChit(pid, items) {
      const S = this.s;
      if (S.phase !== 'answer' || pid !== S.cur || !items || typeof items !== 'object') return;
      const out = {};
      let n = 0;
      for (const k of Object.keys(items)) {
        const q = Math.floor(+items[k]);
        if (KEYS.includes(k) && q > 0 && n < 30) { out[k] = Math.min(9, q); n++; }
      }
      S.chit = out;
      this.changed();
    }
    submit(pid, auto) {
      const S = this.s;
      if (S.phase !== 'answer' || pid !== S.cur) return;
      this.clearTimer();
      const r = score(this.expected, S.chit);
      const pl = this.p(pid);
      if (pl) { pl.score += r.pts; pl.tables++; if (r.perfect) pl.perfect++; }
      S.result = Object.assign({ pid, auto: !!auto, expected: this.expected }, r);
      S.phase = 'reveal';
      this.fx({ type: 'reveal', pid, perfect: r.perfect, pts: r.pts });
      const who = S.script.customers[Math.floor(this.rng() * S.script.customers.length)];
      this.fx({ type: 'say', pid, text: this.pick(r.perfect ? LINES.perfect : r.correct >= r.total / 2 ? LINES.ok : LINES.bad), mood: r.perfect ? 'happy' : 'sad', cust: who && who.name });
      this.log(pl.name + ': ' + r.correct + '/' + r.total + (r.perfect ? ' PERFECT' : '') + ' +' + r.pts);
      this.setTimer('reveal', 8, () => this.next());
      this.changed();
    }
    next() {
      const S = this.s;
      this.clearTimer();
      S.turnIdx++;
      if (S.turnIdx >= S.order.length) {
        S.turnIdx = 0; S.level++;
        if (S.level > S.levels) { this.finish(); return; }
        this.fx({ type: 'banner', text: 'MEJA ' + S.level + (S.level === S.levels ? ' · LAST!' : ''), style: 'info' });
      }
      this.beginTurn();
    }
    skip(id) { // the waiter (or host) taps NEXT on the reveal
      if (this.s.phase === 'reveal' && (id === this.s.cur || id === this.s.hostId)) this.next();
    }
    finish() {
      const S = this.s;
      S.phase = 'over'; S.cur = null; S.script = null;
      S.ranking = S.order.map(id => this.p(id)).filter(Boolean).sort((a, b) => b.score - a.score || b.perfect - a.perfect)
        .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, perfect: p.perfect, tables: p.tables }));
      const w = S.ranking[0] && this.p(S.ranking[0].id);
      if (w && S.ranking.length > 1) w.wins++;
      this.fx({ type: 'banner', text: 'TUTUP KEDAI!', style: 'win' });
      this.fx({ type: 'gameover', winner: w && w.id });
      this.log('Winner: ' + (w ? w.name + ' ' + w.score : '-'));
      this.changed();
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'chit') return this.setChit(id, m.items);
      if (m.t === 'submit') return this.submit(id, false);
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

  const api = { Table, DRINKS, FOODS, KEYS, itemName, genOrder, score, stepMs, showMs, LEVELS, ANSWER_TIME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ORDER = api;
})(this);
