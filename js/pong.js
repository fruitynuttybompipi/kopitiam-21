/* Kopitiam 21 — Telur Pong: throw eggs into the other player's kopi cups.
   Physics + host engine. The host simulates every throw and sends the egg's path to everyone. */
(function (root) {
  'use strict';

  // ---------- world (metres). Seat 0 stands at y<0 throwing toward +y; seat 1 at y>L. ----------
  const C = {
    L: 1.9, W: 0.8,          // table length / width
    cupR: 0.055, cupH: 0.11, // kopi cup rim radius / height
    cap: 0.05,               // egg drops in if centre passes within this of a cup centre
    rim: 0.074,              // ...bounces off the rim within this
    h0: 0.42, y0: -0.06,     // release height / position (behind own cups)
    angle: 48 * Math.PI / 180,
    yaw: 0.28,               // max left/right aim (radians)
    wind: 0.35,              // max sideways push from the ceiling fan (m/s²)
    g: 9.8, dt: 1 / 240, sample: 1 / 30,
  };
  const RACK = [[-0.12, 0.09], [0, 0.09], [0.12, 0.09], [-0.06, 0.194], [0.06, 0.194], [0, 0.298]]; // [x, y] from own edge

  // cup centre in world coordinates for the rack belonging to `seat`
  function cupPos(seat, i) {
    const [x, y] = RACK[i];
    return seat === 0 ? [x, y] : [-x, C.L - y];
  }
  // world <-> thrower frame (thrower at y<0 facing +y)
  const toFrame = (seat, x, y) => seat === 0 ? [x, y] : [-x, C.L - y];
  const fromFrame = toFrame; // same mirror both ways

  function launch(p, a) {
    const R = 1.0 + 1.1 * p;                      // swipe power (0..1) -> intended distance (m)
    const A = C.angle, c = Math.cos(A);
    const k = C.h0 - C.cupH + Math.tan(A) * R;
    const v = Math.sqrt(C.g * R * R / (2 * c * c * Math.max(0.05, k)));
    const yaw = a * C.yaw;
    const vh = v * c;
    return { vx: vh * Math.sin(yaw), vy: vh * Math.cos(yaw), vz: v * Math.sin(A) };
  }

  /* Simulate a throw.
     p: power 0..1, a: aim -1..1, wind: -1..1 (world x), seat: thrower seat,
     targets: [{i, x, y}] standing cups of the opponent (world coords).
     Returns { outcome: 'hit'|'splat'|'floor', cup, pos:[x,y], path:[[x,y,z]...], rims:[pathIndex] } in world coords. */
  function simulate(p, a, wind, seat, targets, opts) {
    opts = opts || {};
    const v = launch(p, a);
    const ax = (seat === 0 ? wind : -wind) * C.wind;
    const tg = targets.map(t => { const [x, y] = toFrame(seat, t.x, t.y); return { i: t.i, x, y }; });
    let x = 0, y = C.y0, z = C.h0, vx = v.vx, vy = v.vy, vz = v.vz;
    const path = [], rims = [];
    let t = 0, nextS = 0, rimN = 0, out = null;
    const push = () => { const [wx, wy] = fromFrame(seat, x, y); path.push([+wx.toFixed(3), +wy.toFixed(3), +z.toFixed(3)]); };
    push();
    while (t < 3) {
      const pz = z;
      vx += ax * C.dt; vz -= C.g * C.dt;
      x += vx * C.dt; y += vy * C.dt; z += vz * C.dt; t += C.dt;
      if (opts.crossOnly && pz > C.cupH && z <= C.cupH && vz < 0) return { x, y };
      if (!opts.crossOnly && pz > C.cupH && z <= C.cupH && vz < 0) {
        let best = null, bd = 9;
        for (const c of tg) { const d = Math.hypot(x - c.x, y - c.y); if (d < bd) { bd = d; best = c; } }
        if (best && bd <= C.cap) {
          // drop into the cup
          push();
          x = best.x; y = best.y; z = C.cupH * 0.6; push();
          const [wx, wy] = fromFrame(seat, best.x, best.y);
          out = { outcome: 'hit', cup: best.i, pos: [wx, wy] };
          break;
        }
        if (best && bd <= C.rim && rimN < 2) {
          // clink off the rim
          rimN++;
          const nx = (x - best.x) / bd, ny = (y - best.y) / bd;
          const dot = vx * nx + vy * ny;
          vx = (vx - 2 * dot * nx) * 0.45 + nx * 0.35; vy = (vy - 2 * dot * ny) * 0.45 + ny * 0.35; vz = 1.05;
          z = C.cupH + 0.002;
          push(); rims.push(path.length - 1);
          continue;
        }
      }
      if (z <= 0 && pz > 0) {
        const onTable = Math.abs(x) <= C.W / 2 && y >= -0.02 && y <= C.L + 0.02;
        if (onTable) { z = 0; push(); const [wx, wy] = fromFrame(seat, x, y); out = { outcome: 'splat', pos: [wx, wy] }; break; }
      }
      if (z <= -0.75) { z = -0.75; push(); const [wx, wy] = fromFrame(seat, x, y); out = { outcome: 'floor', pos: [wx, wy] }; break; }
      if (t >= nextS) { push(); nextS += C.sample; }
    }
    if (!out) { const [wx, wy] = fromFrame(seat, x, y); out = { outcome: 'floor', pos: [wx, wy] }; }
    out.path = path; out.rims = rims; out.dt = C.sample;
    return out;
  }

  // ---------- host engine ----------
  const LINES = {
    hit: ['Masuk!', 'Telur masuk kopi!', 'Steady bom!', 'Kopi telur special!', 'Ngam!'],
    sunk: ['Alamak, cawan aku!', 'Aiyo, kopi I!', 'Wah lau...', 'Kena lagi...'],
    splat: ['Pecah telur!', 'Alamak, tersasar!', 'Aiyo, membazir', 'Haiya, angin lah!'],
    rim: ['Nyaris!', 'Hampir-hampir!', 'Ting! Kena rim'],
    floor: ['Jatuh lantai!', 'Kucing makan dia', 'Terlebih kuat!'],
    drop: ['Takut ke? Throw lah!', 'Tidur ke?'],
    back: ['Telur balik! Again!', 'Dua-dua masuk! Bonus!'],
    win: ['Juara Telur Pong!', 'Champion kopitiam!', 'Huat ah! Menang!'],
    lose: ['Next time lah...', 'Rematch! Rematch!'],
  };
  const BOT_NAMES = ['Uncle Lim', 'Auntie Mary', 'Ah Seng', 'Kak Ros', 'Muthu'];
  const AV = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DR = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];
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
        game: 'pong', code: o.code || '', hostId: o.hostId || null, phase: 'lobby',
        players: [], seats: [], cups: {}, turn: null, wind: 0, round: 0, winner: null, starter: null,
        splats: [], stats: {}, log: [], settings: { aimTime: 25, throws: 2 },
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
    seatOf(id) { return this.s.seats.indexOf(id); }
    opp(id) { return this.s.seats.find(x => x !== id); }

    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) { ex.connected = true; if (info.name) ex.name = clean(info.name); if (info.avatar) ex.avatar = info.avatar; if (info.drink) ex.drink = info.drink; this.log(ex.name + ' balik'); this.changed(); return { ok: true }; }
      if (this.s.players.length >= 2) return { ok: false, reason: 'Telur Pong is 2 players only — meja penuh!' };
      const pl = { id: info.id, name: clean(info.name) || 'Player', avatar: AV.includes(info.avatar) ? info.avatar : 'ahpek', drink: DR.includes(info.drink) ? info.drink : 'kopio', connected: true, isBot: !!info.isBot, wins: 0 };
      this.s.players.push(pl);
      this.log(pl.name + ' masuk');
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
      if (this.s.phase === 'lobby' || this.s.phase === 'over') {
        this.s.players = this.s.players.filter(x => x.id !== id);
        this.log(pl.name + ' keluar');
      } else {
        pl.connected = false; this.log(pl.name + ' offline');
      }
      this.changed();
    }
    kick(id) { if (id === this.s.hostId) return; this.s.players = this.s.players.filter(x => x.id !== id); if (this.s.phase !== 'lobby') this.toLobby(); this.changed(); }

    start() {
      const S = this.s;
      if (S.players.length !== 2 || (S.phase !== 'lobby' && S.phase !== 'over')) return;
      this.gen++;
      S.seats = S.players.map(p => p.id);
      S.cups = {}; for (const id of S.seats) S.cups[id] = [true, true, true, true, true, true];
      S.stats = {}; for (const id of S.seats) S.stats[id] = { throws: 0, hits: 0 };
      S.splats = []; S.winner = null; S.round++;
      // loser of the last game starts; first game: coin toss
      let first = S.starter && S.seats.includes(S.starter) ? S.starter : this.pick(S.seats);
      S.starter = null;
      S.phase = 'coin';
      this.fx({ type: 'pick', id: first, candidates: S.seats.slice(), title: 'SIAPA MULA?', label: 'MULA' });
      this.log('Game ' + S.round + ': ' + this.p(first).name + ' throws first');
      this.changed();
      this.step(() => this.beginTurn(first), 3400);
    }
    beginTurn(pid) {
      const S = this.s;
      S.phase = 'aim';
      S.wind = Math.round((this.rng() * 2 - 1) * 10) / 10;
      S.turn = { pid, left: S.settings.throws, hits: 0 };
      this.fx({ type: 'turn', pid, wind: S.wind });
      this.armThrow();
      this.changed();
    }
    armThrow() {
      const S = this.s, pid = S.turn.pid;
      this.setTimer('aim', S.settings.aimTime, () => this.doThrow(pid, null));
      const pl = this.p(pid);
      if (pl && (pl.isBot || !pl.connected)) this.step(() => pl.isBot ? this.botThrow(pid) : this.doThrow(pid, null), pl.isBot ? 1600 + this.rng() * 1200 : 4000);
    }
    targets(pid) {
      const o = this.opp(pid), seat = this.seatOf(o);
      return this.s.cups[o].map((up, i) => up ? (() => { const [x, y] = cupPos(seat, i); return { i, x, y }; })() : null).filter(Boolean);
    }
    doThrow(pid, inp) {
      const S = this.s;
      if (S.phase !== 'aim' || !S.turn || S.turn.pid !== pid) return false;
      this.clearTimer();
      const pl = this.p(pid);
      S.stats[pid].throws++;
      let res;
      if (!inp) {
        // timed out: egg slips out of the hand
        res = { outcome: 'drop', pos: null, path: [], rims: [], dt: C.sample };
        this.say(pid, 'drop', 'sad');
      } else {
        const p = Math.max(0, Math.min(1, +inp.p || 0)), a = Math.max(-1, Math.min(1, +inp.a || 0));
        res = simulate(p, a, S.wind, this.seatOf(pid), this.targets(pid));
      }
      S.phase = 'flying';
      this.fx({ type: 'throw', pid, path: res.path, rims: res.rims, dt: res.dt, outcome: res.outcome });
      this.changed();
      const flight = res.path.length * res.dt * 1000;
      this.step(() => this.land(pid, res), Math.max(200, flight));
      return true;
    }
    land(pid, res) {
      const S = this.s, o = this.opp(pid);
      let cup = null;
      if (res.outcome === 'hit') {
        S.cups[o][res.cup] = false; S.turn.hits++; S.stats[pid].hits++;
        cup = { pid: o, i: res.cup };
        this.say(pid, 'hit', 'happy');
        this.step(() => this.say(o, 'sunk', 'sad'), 700);
        this.log(this.p(pid).name + ' masuk! (' + S.cups[o].filter(Boolean).length + ' left)');
      } else if (res.outcome === 'splat') {
        S.splats.push([+res.pos[0].toFixed(3), +res.pos[1].toFixed(3)]); if (S.splats.length > 12) S.splats.shift();
        this.say(pid, res.rims.length ? 'rim' : 'splat', 'sad');
        this.log(this.p(pid).name + ' pecah telur');
      } else if (res.outcome === 'floor') {
        this.say(pid, 'floor', 'sad');
        this.log(this.p(pid).name + ' jatuh lantai');
      } else this.log(this.p(pid).name + ' tak baling (timeout)');
      S.turn.left--;
      S.phase = 'landed';
      this.fx({ type: 'land', pid, outcome: res.outcome, cup, pos: res.pos });
      this.changed();
      if (!S.cups[o].some(Boolean)) { this.step(() => this.finish(pid), 1100); return; }
      this.step(() => this.afterThrow(), 1100);
    }
    afterThrow() {
      const S = this.s, pid = S.turn.pid;
      if (S.turn.left > 0) { S.phase = 'aim'; this.armThrow(); this.changed(); return; }
      if (S.turn.hits >= S.settings.throws) {
        S.turn = { pid, left: S.settings.throws, hits: 0 };
        S.phase = 'aim';
        this.fx({ type: 'banner', text: 'TELUR BALIK!', style: 'bj' });
        this.say(pid, 'back', 'happy');
        this.log(this.p(pid).name + ' balls back!');
        this.armThrow(); this.changed();
        return;
      }
      this.beginTurn(this.opp(pid));
    }
    finish(pid) {
      const S = this.s, o = this.opp(pid);
      this.clearTimer();
      S.phase = 'over'; S.winner = pid; S.turn = null;
      const w = this.p(pid); if (w) w.wins++;
      S.starter = o;
      this.fx({ type: 'banner', text: (w ? w.name.toUpperCase() : '') + ' MENANG!', style: 'win' });
      this.fx({ type: 'gameover', winner: pid });
      this.say(pid, 'win', 'happy');
      this.step(() => this.say(o, 'lose', 'sad'), 900);
      this.log('Winner: ' + (w ? w.name : '?'));
      this.changed();
    }
    toLobby() { this.gen++; this.clearTimer(); Object.assign(this.s, { phase: 'lobby', turn: null, winner: null, seats: [], cups: {}, splats: [] }); }

    // aim at a random standing cup, with some human-ish wobble
    botThrow(pid) {
      const S = this.s;
      if (S.phase !== 'aim' || !S.turn || S.turn.pid !== pid) return;
      const tg = this.targets(pid); if (!tg.length) return;
      const target = this.pick(tg), seat = this.seatOf(pid);
      let best = null, bd = 9;
      for (let a = -1; a <= 1.0001; a += 0.05) for (let p = 0; p <= 1.0001; p += 0.008) {
        const r = simulate(p, a, S.wind, seat, [], { crossOnly: true });
        if (!r || r.x == null) continue;
        const [wx, wy] = fromFrame(seat, r.x, r.y);
        const d = Math.hypot(wx - target.x, wy - target.y);
        if (d < bd) { bd = d; best = { p, a }; }
      }
      const n = () => (this.rng() + this.rng() + this.rng() - 1.5) * 0.9;
      this.doThrow(pid, { p: best.p + n() * 0.15, a: best.a + n() * 0.35 });
    }

    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'throw') return this.doThrow(id, { p: m.p, a: m.a });
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

  const api = { C, RACK, cupPos, simulate, launch, Table, LINES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PONG = api;
})(this);
