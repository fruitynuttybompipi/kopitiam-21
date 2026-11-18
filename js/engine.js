/* Kopitiam 21 — game engine. Runs only on the host (table owner).
   The host is the single source of truth; everyone else gets publicState(). */
(function (root) {
  'use strict';

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];
  const MAX_PLAYERS = 6;

  const DEFAULTS = {
    startChips: 1000, minBet: 10, maxBet: 500, decks: 6,
    betTime: 30, turnTime: 30, insTime: 10, openTime: 15, settleTime: 7,
  };

  const LINES = {
    bj: ['HUAT AH!!', 'Blackjack lah! Steady!', 'Wah, ong ah!', 'Ngam ngam 21!'],
    win: ['Can lah!', 'Win liao!', 'Steady bom bom!', 'Makan Tauke!', 'Heng ah!'],
    lose: ['Sien...', 'Kena again...', 'Aiyo...', 'Rugi lah', 'Haiz...'],
    bust: ['Bust liao lah...', 'Alamak!', 'Pecah!', 'Wah lau eh!', 'Over liao!'],
    push: ['Seri lah', 'Same same', 'Draw only', 'Ok lah, balik modal'],
    double: ['Double! Berani mati!', 'Double up lah!', 'Double! Huat or pokai!'],
    split: ['Split! Two kopi!', 'Pecah dua!', 'Split, double luck!'],
    hit: ['Hit me!', 'Tambah satu!', 'One more lah', 'Again!'],
    stand: ['Cukup, stand.', 'Stop lah.', 'Enough liao', 'Steady, stand'],
    open: ['Open liao!', 'Tengok tengok...', 'Buka kad!', 'Tauke open ah!'],
    taukeBust: ['Tauke pecah! Everybody makan!', 'Aiyo tauke bust!', 'Tauke kena! Free kopi!'],
    taukeBJ: ['Tauke huat! Sorry ah!', 'Blackjack! Tauke makan all!'],
    taukeSweep: ['Tauke sapu bersih!', 'Thank you ah, come again!'],
    taukeNoBJ: ['No blackjack lah, continue!', 'Safe! Continue main.'],
    noBet: ['Nobody bet ah? Cepat lah!', 'Wei, bet lah!'],
    broke: ['Duit habis... tapau balik rumah', 'Lingkup liao...', 'Pokai!'],
    shuffle: ['Shuffle kad, tunggu ah...'],
    newTauke: ['Saya Tauke sekarang!', 'Ok, I jaga kedai!', 'Tauke here, bet lah!'],
  };

  const BOT_NAMES = ['Uncle Lim', 'Auntie Mary', 'Ah Seng', 'Kak Ros', 'Muthu', 'Ah Kow', 'Mei Mei', 'Pak Abu'];
  const AVATAR_IDS = ['ahpek', 'auntie', 'ahboy', 'makcik', 'anneh', 'officegirl', 'rider', 'kucing'];
  const DRINK_IDS = ['tehtarik', 'kopio', 'miloais', 'bandung', 'limauais'];

  // ---------- pure helpers (shared with the client) ----------
  function val(r) { if (r === 'A') return 11; if (r === 'J' || r === 'Q' || r === 'K') return 10; return +r; }
  function total(cards) {
    let t = 0, a = 0;
    for (const c of cards) { if (!c || c.hidden) continue; t += val(c.r); if (c.r === 'A') a++; }
    while (t > 21 && a) { t -= 10; a--; }
    return { t, soft: a > 0 };
  }
  function isBJ(hand) { return !hand.fromSplit && hand.cards.length === 2 && total(hand.cards).t === 21; }
  function canDouble(p, hand) {
    return !!hand && !hand.done && hand.cards.length === 2 && !hand.splitAces && p.chips >= hand.bet;
  }
  function canSplit(p, hand) {
    return !!hand && !hand.done && hand.cards.length === 2 && !hand.splitAces &&
      val(hand.cards[0].r) === val(hand.cards[1].r) && p.hands.length < 4 && p.chips >= hand.bet;
  }

  class Table {
    constructor(o) {
      o = o || {};
      this.rng = o.rng || Math.random;
      this.now = o.now || (() => Date.now());
      this.setT = o.setTimeout || ((f, ms) => setTimeout(f, ms));
      this.clrT = o.clearTimeout || (t => clearTimeout(t));
      this.onChange = o.onChange || (() => {});
      this.onFx = o.onFx || (() => {});
      this.pace = o.pace == null ? 1 : o.pace;
      this.gen = 0;
      this.timer = null; this.timerEnd = 0; this.timerTotal = 0; this.timerKind = null;
      this.shoe = []; this.cardSeq = 0;
      this.s = {
        code: o.code || '', phase: 'lobby', round: 0, players: [],
        taukeId: null, nextTaukeId: null,
        dealer: { cards: [], revealed: false },
        turn: null, settings: Object.assign({}, DEFAULTS, o.settings || {}),
        log: [], shoeLeft: 0, shoeTotal: 0, hostId: o.hostId || null, ranking: null,
      };
    }

    // ---------- infra ----------
    pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
    changed() { this.onChange(); }
    fx(f) { this.onFx(f); }
    say(pid, kind, mood) { if (pid) this.fx({ type: 'say', pid, text: this.pick(LINES[kind]), mood: mood || 'neutral' }); }
    log(t) { this.s.log.push({ t, r: this.s.round }); if (this.s.log.length > 40) this.s.log.shift(); }
    step(fn, ms) {
      const g = this.gen;
      return this.setT(() => { if (g === this.gen) fn(); }, Math.round(ms * this.pace));
    }
    setTimer(kind, sec, fn) {
      this.clearTimer();
      const ms = sec * 1000;
      this.timerId = (this.timerId || 0) + 1;
      this.timerKind = kind; this.timerTotal = ms; this.timerEnd = this.now() + ms * this.pace;
      const g = this.gen;
      this.timer = this.setT(() => { if (g !== this.gen) return; this.timer = null; this.timerKind = null; fn(); }, ms * this.pace);
    }
    clearTimer() { if (this.timer) this.clrT(this.timer); this.timer = null; this.timerKind = null; }

    p(id) { return this.s.players.find(x => x.id === id); }
    tauke() { return this.p(this.s.taukeId); }
    inRound() { return this.s.players.filter(x => x.inRound); }
    hasMoney(p) { return p.chips >= this.s.settings.minBet; }
    candidates() { return this.s.players.filter(x => x.connected && this.hasMoney(x)); }

    buildShoe() {
      const shoe = [];
      for (let d = 0; d < this.s.settings.decks; d++)
        for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
      for (let i = shoe.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));[shoe[i], shoe[j]] = [shoe[j], shoe[i]];
      }
      this.shoe = shoe;
      this.s.shoeTotal = shoe.length; this.s.shoeLeft = shoe.length;
    }
    draw() {
      if (!this.shoe.length) this.buildShoe();
      const c = this.shoe.pop();
      this.s.shoeLeft = this.shoe.length;
      return { id: 'c' + (++this.cardSeq), r: c.r, s: c.s };
    }

    // ---------- players ----------
    addPlayer(info) {
      const ex = this.p(info.id);
      if (ex) {
        ex.connected = true;
        if (info.name) ex.name = clean(info.name);
        if (info.avatar) ex.avatar = info.avatar;
        if (info.drink) ex.drink = info.drink;
        this.log(ex.name + ' balik meja');
        this.changed();
        return { ok: true, rejoin: true };
      }
      if (this.s.players.length >= MAX_PLAYERS) return { ok: false, reason: 'Meja penuh lah — table full (max ' + MAX_PLAYERS + ')' };
      const pl = {
        id: info.id, name: clean(info.name) || 'Player', avatar: AVATAR_IDS.includes(info.avatar) ? info.avatar : 'ahpek',
        drink: DRINK_IDS.includes(info.drink) ? info.drink : 'tehtarik',
        chips: this.s.settings.startChips, connected: true, isBot: !!info.isBot,
        hands: [], bet: 0, locked: false, inRound: false, insurance: 0, insDecided: false,
        result: null, out: false, outAnnounced: false,
      };
      this.s.players.push(pl);
      this.log(pl.name + ' duduk (joined)');
      this.changed();
      return { ok: true };
    }
    addBot() {
      const used = new Set(this.s.players.map(x => x.name));
      const avatar = this.pick(AVATAR_IDS);
      const S = typeof root !== 'undefined' && root.SPR;
      const name = (S && S.randomName) ? S.randomName(avatar, used) : (BOT_NAMES.find(n => !used.has(n)) || 'Bot ' + this.s.players.length);
      return this.addPlayer({
        id: 'bot-' + Math.floor(this.rng() * 1e9).toString(36), name,
        avatar, drink: this.pick(DRINK_IDS), isBot: true,
      });
    }
    removePlayer(id) {
      const pl = this.p(id); if (!pl) return;
      if (this.s.phase === 'lobby' || this.s.phase === 'gameover') {
        this.s.players = this.s.players.filter(x => x.id !== id);
        if (this.s.nextTaukeId === id) this.s.nextTaukeId = null;
        this.log(pl.name + ' left');
        this.changed();
        return;
      }
      this.disconnect(id);
    }
    disconnect(id) {
      const pl = this.p(id); if (!pl || !pl.connected) return;
      pl.connected = false;
      this.log(pl.name + ' offline');
      const ph = this.s.phase;
      if (ph === 'lobby' || ph === 'gameover') { this.removePlayer(id); return; }
      if (ph === 'betting') this.checkAllBets();
      if (ph === 'insurance' && !pl.insDecided) this.setInsurance(id, false);
      if (ph === 'playing' && this.s.turn && this.s.turn.pid === id) this.act(id, 'stand');
      this.changed();
    }
    kick(id) {
      const pl = this.p(id); if (!pl) return;
      this.disconnect(id);
      if (this.s.phase === 'lobby' || this.s.phase === 'gameover') return;
      if (!pl.inRound && this.s.taukeId !== id) this.s.players = this.s.players.filter(x => x.id !== id);
      this.changed();
    }

    // Host chooses who will be Tauke from next round. null/'random' = random pick.
    setTauke(id) {
      this.s.nextTaukeId = id && this.p(id) ? id : 'random';
      const n = this.p(id);
      this.log(n ? 'Next Tauke: ' + n.name : 'Next Tauke: random 🎲');
      this.changed();
    }

    // ---------- flow ----------
    start() {
      if (this.s.phase !== 'lobby') return { ok: false };
      if (this.candidates().length < 2) return { ok: false, reason: 'Need at least 2 players' };
      this.newRound();
      return { ok: true };
    }

    newRound() {
      const S = this.s;
      this.clearTimer();
      S.turn = null; S.ranking = null;
      S.dealer = { cards: [], revealed: false };
      for (const pl of S.players) {
        pl.hands = []; pl.bet = 0; pl.locked = false; pl.inRound = false;
        pl.insurance = 0; pl.insDecided = false; pl.result = null;
        pl.out = !this.hasMoney(pl);
        if (pl.out && !pl.outAnnounced) { pl.outAnnounced = true; this.say(pl.id, 'broke', 'sad'); this.log(pl.name + ' pokai — out (no credit)'); }
      }
      const cands = this.candidates();
      if (cands.length < 2) { this.gameOver(); return; }

      // pick Tauke
      const prev = S.taukeId;
      let chosen = null, random = false;
      const want = S.nextTaukeId;
      if (want && want !== 'random' && cands.some(c => c.id === want)) chosen = want;
      else if (want !== 'random' && cands.some(c => c.id === prev)) chosen = prev;
      else { chosen = this.pick(cands).id; random = true; }
      S.nextTaukeId = null;
      S.taukeId = chosen;
      S.round++;
      S.phase = 'betting';
      if (chosen !== prev || S.round === 1) {
        this.fx({ type: 'taukePick', id: chosen, random, candidates: cands.map(c => c.id) });
        this.log('Tauke: ' + this.tauke().name + (random ? ' (random 🎲)' : ''));
        this.step(() => this.say(chosen, 'newTauke', 'happy'), 2600);
      }
      this.fx({ type: 'banner', text: 'ROUND ' + S.round, style: 'info' });
      this.setTimer('bet', S.settings.betTime + (chosen !== prev ? 3 : 0), () => this.betTimeout());
      for (const pl of this.bettors()) if (pl.isBot) this.step(() => this.botBet(pl.id), 1500 + this.rng() * 2500);
      this.changed();
    }

    bettors() {
      return this.s.players.filter(x => x.id !== this.s.taukeId && x.connected && !x.out);
    }

    placeBet(id, amount) {
      const S = this.s, pl = this.p(id);
      if (S.phase !== 'betting' || !pl || pl.locked || pl.out || id === S.taukeId || !pl.connected) return false;
      amount = Math.floor(+amount);
      const max = Math.min(S.settings.maxBet, pl.chips);
      if (!(amount >= S.settings.minBet && amount <= max && amount % 5 === 0)) return false;
      pl.bet = amount; pl.locked = true; pl.chips -= amount;
      this.fx({ type: 'bet', pid: id, amount });
      this.log(pl.name + ' bet ' + amount);
      this.checkAllBets();
      this.changed();
      return true;
    }
    checkAllBets() {
      if (this.s.phase !== 'betting') return;
      const b = this.bettors();
      if (b.length && b.every(x => x.locked)) { this.clearTimer(); this.step(() => this.deal(), 800); this.s.phase = 'dealing'; }
    }
    dealNow(id) {
      const S = this.s;
      if (S.phase !== 'betting') return;
      if (id !== S.taukeId && id !== S.hostId) return;
      if (!S.players.some(x => x.locked)) return;
      this.clearTimer(); S.phase = 'dealing'; this.changed();
      this.step(() => this.deal(), 300);
    }
    betTimeout() {
      const S = this.s;
      if (S.phase !== 'betting') return;
      if (!S.players.some(x => x.locked)) {
        this.say(S.taukeId, 'noBet');
        this.setTimer('bet', S.settings.betTime, () => this.betTimeout());
        this.changed();
        return;
      }
      S.phase = 'dealing';
      this.deal();
    }

    deal() {
      const S = this.s;
      if (S.phase !== 'dealing' && S.phase !== 'betting') return;
      S.phase = 'dealing';
      this.clearTimer();
      const players = S.players.filter(x => x.locked && x.id !== S.taukeId);
      for (const pl of players) {
        pl.inRound = true;
        pl.hands = [{ cards: [], bet: pl.bet, done: false, doubled: false, bust: false, fromSplit: false, splitAces: false, result: null }];
      }
      for (const pl of S.players) if (!pl.inRound && pl.id !== S.taukeId && !pl.out) pl.sitOut = true; else pl.sitOut = false;

      let delay = 0;
      if (!this.shoe.length || this.shoe.length < this.s.shoeTotal * 0.25) {
        this.buildShoe();
        this.fx({ type: 'shuffle' });
        this.say(S.taukeId, 'shuffle');
        delay = 1600;
      }
      const seq = [];
      for (let r = 0; r < 2; r++) { for (const pl of players) seq.push(pl.id); seq.push('D'); }
      let i = 0;
      const next = () => {
        if (i >= seq.length) { this.step(() => this.afterDeal(), 450); return; }
        const who = seq[i++];
        const c = this.draw();
        if (who === 'D') S.dealer.cards.push(c); else this.p(who).hands[0].cards.push(c);
        this.changed();
        this.step(next, 330);
      };
      this.changed();
      this.step(next, delay + 200);
    }

    afterDeal() {
      const S = this.s;
      const up = S.dealer.cards[0];
      const insurable = this.inRound().filter(pl => pl.chips >= Math.ceil(pl.hands[0].bet / 2) && pl.connected);
      if (up.r === 'A' && insurable.length) {
        S.phase = 'insurance';
        for (const pl of this.inRound()) if (!insurable.includes(pl)) pl.insDecided = true;
        this.fx({ type: 'banner', text: 'INSURANCE?', style: 'info' });
        this.setTimer('ins', S.settings.insTime, () => {
          for (const pl of this.inRound()) if (!pl.insDecided) pl.insDecided = true;
          this.peek();
        });
        for (const pl of insurable) if (pl.isBot) this.step(() => this.setInsurance(pl.id, false), 900 + this.rng() * 1200);
        this.changed();
        return;
      }
      this.peek();
    }

    setInsurance(id, yes) {
      const S = this.s, pl = this.p(id);
      if (S.phase !== 'insurance' || !pl || !pl.inRound || pl.insDecided) return;
      pl.insDecided = true;
      const amt = Math.ceil(pl.hands[0].bet / 2);
      if (yes && pl.chips >= amt) { pl.insurance = amt; pl.chips -= amt; this.log(pl.name + ' insurance ' + amt); this.fx({ type: 'bet', pid: id, amount: amt }); }
      if (this.inRound().every(x => x.insDecided)) { this.clearTimer(); this.step(() => this.peek(), 400); }
      this.changed();
    }

    peek() {
      const S = this.s;
      if (S.phase !== 'insurance' && S.phase !== 'dealing') return;
      this.clearTimer();
      const up = S.dealer.cards[0];
      if (up.r === 'A' || val(up.r) === 10) {
        if (total(S.dealer.cards).t === 21) {
          S.dealer.revealed = true;
          S.phase = 'dealer';
          this.fx({ type: 'flip' });
          this.fx({ type: 'banner', text: 'TAUKE BLACKJACK!', style: 'bust' });
          this.say(S.taukeId, 'taukeBJ', 'happy');
          this.changed();
          this.step(() => this.settle(), 1600);
          return;
        }
        this.fx({ type: 'peek' });
        if (up.r === 'A') this.say(S.taukeId, 'taukeNoBJ');
      }
      this.startPlay();
    }

    startPlay() {
      const S = this.s;
      S.phase = 'playing';
      for (const pl of this.inRound()) {
        const h = pl.hands[0];
        if (isBJ(h)) { h.done = true; this.fx({ type: 'bj', pid: pl.id }); this.say(pl.id, 'bj', 'happy'); this.log(pl.name + ' BLACKJACK!'); }
      }
      this.changed();
      this.step(() => this.nextTurn(), 500);
    }

    nextTurn() {
      const S = this.s;
      if (S.phase !== 'playing') return;
      for (const pl of this.inRound()) {
        const hi = pl.hands.findIndex(h => !h.done);
        if (hi < 0) continue;
        const h = pl.hands[hi];
        if (h.cards.length < 2) {
          // second card for a split hand
          S.turn = null;
          h.cards.push(this.draw());
          if (h.splitAces || total(h.cards).t === 21) h.done = true;
          this.changed();
          this.step(() => this.nextTurn(), 450);
          return;
        }
        if (!pl.connected) { h.done = true; continue; }
        S.turn = { pid: pl.id, hand: hi };
        this.fx({ type: 'turn', pid: pl.id });
        this.setTimer('turn', S.settings.turnTime, () => this.act(pl.id, 'stand', true));
        if (pl.isBot) this.step(() => this.botAct(pl.id), 1000 + this.rng() * 900);
        this.changed();
        return;
      }
      S.turn = null;
      this.dealerPhase();
    }

    act(id, a, auto) {
      const S = this.s, pl = this.p(id);
      if (S.phase !== 'playing' || !S.turn || S.turn.pid !== id || !pl) return false;
      const h = pl.hands[S.turn.hand];
      if (!h || h.done) return false;
      if (a === 'hit') {
        h.cards.push(this.draw());
        this.fx({ type: 'act', pid: id, a });
        const t = total(h.cards).t;
        if (t > 21) { h.bust = true; h.done = true; this.fx({ type: 'bust', pid: id }); this.say(id, 'bust', 'sad'); this.log(pl.name + ' bust (' + t + ')'); }
        else if (t === 21) h.done = true;
        else if (this.rng() < 0.35) this.say(id, 'hit');
        if (h.done) this.advance();
        else {
          this.setTimer('turn', S.settings.turnTime, () => this.act(id, 'stand', true));
          if (pl.isBot) this.step(() => this.botAct(id), 900 + this.rng() * 700);
        }
      } else if (a === 'stand') {
        h.done = true;
        this.fx({ type: 'act', pid: id, a });
        if (auto) this.log(pl.name + ' auto-stand (timeout)'); else if (this.rng() < 0.4) this.say(id, 'stand');
        this.advance();
      } else if (a === 'double') {
        if (!canDouble(pl, h)) return false;
        pl.chips -= h.bet; h.bet *= 2; h.doubled = true;
        this.fx({ type: 'bet', pid: id, amount: h.bet / 2 });
        this.fx({ type: 'act', pid: id, a });
        this.say(id, 'double', 'happy');
        h.cards.push(this.draw());
        const t = total(h.cards).t;
        if (t > 21) { h.bust = true; this.fx({ type: 'bust', pid: id }); this.step(() => this.say(id, 'bust', 'sad'), 600); }
        h.done = true;
        this.log(pl.name + ' double → ' + t);
        this.advance(700);
      } else if (a === 'split') {
        if (!canSplit(pl, h)) return false;
        pl.chips -= h.bet;
        const c2 = h.cards.pop();
        const aces = h.cards[0].r === 'A';
        h.fromSplit = true; h.splitAces = aces;
        const nh = { cards: [c2], bet: h.bet, done: false, doubled: false, bust: false, fromSplit: true, splitAces: aces, result: null };
        pl.hands.splice(S.turn.hand + 1, 0, nh);
        this.fx({ type: 'bet', pid: id, amount: h.bet });
        this.fx({ type: 'act', pid: id, a });
        this.say(id, 'split', 'happy');
        this.log(pl.name + ' split');
        this.clearTimer();
        const hi = S.turn.hand;
        S.turn = null;
        this.changed();
        this.step(() => {
          h.cards.push(this.draw());
          if (aces || total(h.cards).t === 21) h.done = true;
          if (h.done) { this.changed(); this.step(() => this.nextTurn(), 450); return; }
          S.turn = { pid: id, hand: hi };
          this.setTimer('turn', S.settings.turnTime, () => this.act(id, 'stand', true));
          if (pl.isBot) this.step(() => this.botAct(id), 1000);
          this.changed();
        }, 450);
        return true;
      } else return false;
      this.changed();
      return true;
    }
    advance(ms) {
      this.clearTimer();
      this.s.turn = null;
      this.step(() => this.nextTurn(), ms || 450);
    }

    dealerPhase() {
      const S = this.s;
      S.phase = 'dealer';
      S.turn = null;
      const live = this.inRound().some(pl => pl.hands.some(h => !h.bust && !isBJ(h)));
      if (!live) {
        S.dealer.revealed = true;
        this.fx({ type: 'flip' });
        this.changed();
        this.step(() => this.settle(), 1100);
        return;
      }
      const tk = this.tauke();
      this.fx({ type: 'banner', text: 'TAUKE OPEN!', style: 'info' });
      this.setTimer('open', S.settings.openTime, () => this.open());
      if (!tk || tk.isBot || !tk.connected) this.step(() => this.open(), 1500);
      this.changed();
    }

    open(id) {
      const S = this.s;
      if (S.phase !== 'dealer' || S.dealer.revealed) return;
      if (id && id !== S.taukeId) return;
      this.clearTimer();
      S.dealer.revealed = true;
      this.fx({ type: 'flip' });
      this.say(S.taukeId, 'open');
      this.changed();
      const drawLoop = () => {
        const t = total(S.dealer.cards);
        if (t.t < 17) {
          S.dealer.cards.push(this.draw());
          this.changed();
          this.step(drawLoop, 800);
        } else {
          if (t.t > 21) { this.fx({ type: 'banner', text: 'TAUKE BUST!', style: 'win' }); this.say(S.taukeId, 'taukeBust', 'sad'); }
          this.step(() => this.settle(), 900);
        }
      };
      this.step(drawLoop, 900);
    }

    settle() {
      const S = this.s;
      if (S.phase === 'settle') return;
      S.phase = 'settle';
      this.clearTimer();
      const tk = this.tauke();
      const d = total(S.dealer.cards).t;
      const dBJ = S.dealer.cards.length === 2 && d === 21;
      const dBust = d > 21;
      const rows = [];
      let totalLost = 0, totalWin = 0;
      for (const pl of this.inRound()) {
        let staked = 0, back = 0, win = 0, lost = 0;
        for (const h of pl.hands) {
          staked += h.bet;
          const t = total(h.cards).t;
          const bj = isBJ(h);
          if (h.bust) { h.result = 'BUST'; lost += h.bet; }
          else if (bj && !dBJ) { h.result = 'BLACKJACK'; back += h.bet; win += Math.floor(h.bet * 1.5); }
          else if (bj && dBJ) { h.result = 'PUSH'; back += h.bet; }
          else if (dBJ) { h.result = 'LOSE'; lost += h.bet; }
          else if (dBust || t > d) { h.result = 'WIN'; back += h.bet; win += h.bet; }
          else if (t === d) { h.result = 'PUSH'; back += h.bet; }
          else { h.result = 'LOSE'; lost += h.bet; }
        }
        if (pl.insurance) {
          staked += pl.insurance;
          if (dBJ) { back += pl.insurance; win += pl.insurance * 2; } else lost += pl.insurance;
        }
        totalLost += lost; totalWin += win;
        rows.push({ pl, staked, back, win, lost });
      }
      const before = tk ? tk.chips : 0;
      const pool = before + totalLost;
      let paid = 0, short = false;
      for (const r of rows) {
        let w = r.win;
        if (pool < totalWin) { w = Math.floor(r.win * pool / totalWin); short = true; }
        paid += w;
        r.pl.chips += r.back + w;
        r.delta = r.back + w - r.staked;
      }
      if (tk) tk.chips = pool - paid;
      const taukeDelta = tk ? tk.chips - before : 0;

      for (const r of rows) {
        const pl = r.pl;
        const labels = pl.hands.map(h => h.result);
        const best = ['BLACKJACK', 'WIN', 'PUSH', 'LOSE', 'BUST'].find(x => labels.includes(x));
        const label = pl.hands.length > 1 ? (r.delta > 0 ? 'WIN' : r.delta < 0 ? 'LOSE' : 'PUSH') : best;
        pl.result = { delta: r.delta, label };
        this.fx({ type: 'result', pid: pl.id, delta: r.delta, label });
        this.log(pl.name + ' ' + label + ' ' + (r.delta >= 0 ? '+' : '') + r.delta);
      }
      if (tk) {
        tk.result = { delta: taukeDelta, label: 'TAUKE' };
        this.fx({ type: 'result', pid: tk.id, delta: taukeDelta, label: 'TAUKE' });
        this.log('Tauke ' + tk.name + ' ' + (taukeDelta >= 0 ? '+' : '') + taukeDelta);
      }
      // reactions
      const reacts = rows.map(r => ({ id: r.pl.id, label: r.pl.result.label }));
      const sweep = tk && rows.length && rows.every(r => r.delta < 0) ? tk.id : null;
      const round = S.round;
      this.step(() => {
        if (S.round !== round) return;
        for (const r of reacts) {
          const l = r.label;
          if (l === 'BLACKJACK' || (l === 'WIN' && !dBust)) this.say(r.id, l === 'BLACKJACK' ? 'bj' : 'win', 'happy');
          else if (l === 'LOSE') this.say(r.id, 'lose', 'sad');
          else if (l === 'PUSH') this.say(r.id, 'push');
        }
        if (sweep) this.say(sweep, 'taukeSweep', 'happy');
      }, 500);
      if (short && tk) {
        this.fx({ type: 'banner', text: 'TAUKE LINGKUP!', style: 'bust' });
        this.log('Tauke ' + tk.name + ' bankrupt — paid what he could');
      }
      const next = this.candidates().length < 2 ? () => this.gameOver() : () => this.newRound();
      this.setTimer('settle', S.settings.settleTime, next);
      this.changed();
    }

    nextRound(id) {
      const S = this.s;
      if (S.phase !== 'settle') return;
      if (id !== S.taukeId && id !== S.hostId) return;
      this.clearTimer();
      if (this.candidates().length < 2) this.gameOver(); else this.newRound();
    }

    gameOver() {
      const S = this.s;
      this.clearTimer();
      S.phase = 'gameover';
      S.turn = null;
      S.ranking = S.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, chips: p.chips }));
      this.fx({ type: 'banner', text: 'GAME OVER', style: 'info' });
      this.fx({ type: 'gameover', winner: S.ranking[0] && S.ranking[0].id });
      this.log('Game over! Winner: ' + (S.ranking[0] ? S.ranking[0].name : '-'));
      this.changed();
    }

    newGame() {
      this.gen++;
      this.clearTimer();
      const S = this.s;
      S.players = S.players.filter(p => p.connected);
      for (const pl of S.players) {
        Object.assign(pl, { chips: S.settings.startChips, hands: [], bet: 0, locked: false, inRound: false, insurance: 0, insDecided: false, result: null, out: false, outAnnounced: false, sitOut: false });
      }
      S.phase = 'lobby'; S.round = 0; S.taukeId = null; S.nextTaukeId = null; S.turn = null; S.ranking = null;
      S.dealer = { cards: [], revealed: false };
      this.shoe = [];
      this.log('New game! Everyone 1000 chips');
      this.changed();
    }

    // ---------- bots ----------
    botBet(id) {
      const pl = this.p(id); if (!pl || this.s.phase !== 'betting' || pl.locked) return;
      const opts = [20, 30, 50, 50, 100, 100, 150, 200].filter(x => x <= Math.min(pl.chips, this.s.settings.maxBet));
      this.placeBet(id, opts.length ? this.pick(opts) : Math.min(pl.chips, this.s.settings.maxBet) - (Math.min(pl.chips, this.s.settings.maxBet) % 5));
    }
    botAct(id) {
      const S = this.s, pl = this.p(id);
      if (!pl || S.phase !== 'playing' || !S.turn || S.turn.pid !== id) return;
      const h = pl.hands[S.turn.hand];
      const up = val(S.dealer.cards[0].r);
      const { t, soft } = total(h.cards);
      let a = 'stand';
      if (canSplit(pl, h) && (h.cards[0].r === 'A' || h.cards[0].r === '8')) a = 'split';
      else if (canDouble(pl, h) && !soft && (t === 11 || (t === 10 && up < 10))) a = 'double';
      else if (soft) a = t <= 17 ? 'hit' : 'stand';
      else if (t <= 11) a = 'hit';
      else if (t >= 17) a = 'stand';
      else a = up >= 7 ? 'hit' : (t === 12 && up < 4 ? 'hit' : 'stand');
      this.act(id, a);
    }

    // ---------- intents from the network ----------
    handle(id, m) {
      if (!m || typeof m !== 'object') return;
      switch (m.t) {
        case 'bet': return this.placeBet(id, m.amount);
        case 'act': return this.act(id, m.a);
        case 'ins': return this.setInsurance(id, !!m.yes);
        case 'open': return this.open(id);
        case 'deal': return this.dealNow(id);
        case 'next': return this.nextRound(id);
        case 'emote': {
          const pl = this.p(id); if (!pl) return;
          const now = this.now();
          if (pl._lastEmote && now - pl._lastEmote < 1200) return;
          pl._lastEmote = now;
          const text = String(m.text || '').slice(0, 24);
          if (text) this.fx({ type: 'emote', pid: id, text });
          return;
        }
      }
      if (id !== this.s.hostId) return;
      switch (m.t) {
        case 'start': return this.start();
        case 'tauke': return this.setTauke(m.id);
        case 'addBot': return this.addBot();
        case 'kick': return this.kick(m.id);
        case 'newGame': return this.newGame();
      }
    }

    publicState() {
      const S = this.s;
      const out = JSON.parse(JSON.stringify(S, (k, v) => (k.startsWith('_') ? undefined : v)));
      if (!S.dealer.revealed && out.dealer.cards.length >= 2) out.dealer.cards[1] = { id: out.dealer.cards[1].id, hidden: true };
      out.timer = this.timer && this.timerKind ? { id: this.timerId, kind: this.timerKind, left: Math.max(0, this.timerEnd - this.now()), total: this.timerTotal * this.pace } : null;
      return out;
    }
  }

  function clean(s) { return String(s || '').replace(/[<>]/g, '').trim().slice(0, 14); }

  const api = { Table, total, isBJ, canDouble, canSplit, val, LINES, MAX_PLAYERS, DEFAULTS, AVATAR_IDS, DRINK_IDS, clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BJ = api;
})(this);
