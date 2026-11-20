/* Kopitiam 21 — UI, animation and game wiring */
(function () {
  'use strict';
  const { BJ, SPR, AU, NET, Scene } = window;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = new URLSearchParams(location.search);
  const OFFLINE = params.has('offline');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('k21:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('k21:' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------- identity (per tab, survives refresh) ----------
  let pid = null;
  try { pid = sessionStorage.getItem('k21pid'); } catch (e) {}
  if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('k21pid', pid); } catch (e) {} }
  const me = { nameAuto: store.get('nameAuto', false), mode: ['bj', 'mamak', 'kacang', 'lami'].includes(store.get('mode', 'pong')) ? 'pong' : store.get('mode', 'pong'), id: pid, name: store.get('name', ''), avatar: store.get('avatar', BJ.AVATAR_IDS[Math.floor(Math.random() * 8)]), drink: store.get('drink', 'tehtarik') };

  // ---------- generated pixel assets ----------
  function gridURL(rows, pal, scale) {
    scale = scale || 1;
    const c = document.createElement('canvas'); c.width = rows[0].length * scale; c.height = rows.length * scale;
    SPR.drawGrid(c.getContext('2d'), rows, pal, 0, 0, scale);
    return c.toDataURL();
  }
  const ICON_ROWS = {
    music: ['..kkkkkk', '..kkkkkk', '..k....k', '..k....k', '..k....k', 'kkk..kkk', 'kkk..kkk', '........'],
    sfx: ['...k....', '..kk..k.', 'kkkk.k..', 'kkkk.k.k', 'kkkk.k.k', 'kkkk.k..', '..kk..k.', '...k....'],
    gear: ['...kk...', '.kkkkkk.', '.kk..kk.', 'kk....kk', 'kk....kk', '.kk..kk.', '.kkkkkk.', '...kk...'],
    exit: ['kkkkk...', 'k...k...', 'k...k.k.', 'k.k.kkkk', 'k...k.k.', 'k...k...', 'kkkkk...', '........'],
    help: ['.kkkkk..', 'kk...kk.', '.....kk.', '...kkk..', '...kk...', '........', '...kk...', '...kk...'],
    chat: ['kkkkkkkk', 'k......k', 'k.kkkk.k', 'k......k', 'kkkkkkkk', '..kk....', '.k......', '........'],
  };
  const ICON = {};
  for (const k in ICON_ROWS) ICON[k] = gridURL(ICON_ROWS[k], { k: '#f4e4c1' });
  const CROWN = gridURL(['y....yy....y', 'yy..yyyy..yy', 'yyyyyyyyyyyy', 'ywyyyryyywyy', 'yyyyyyyyyyyy', 'kkkkkkkkkkkk'], { y: '#f6c744', r: '#d42a2a', w: '#fff3b0', k: '#b8862a' });
  const DICE = gridURL([
    '................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwddwwwwwwddwk.', '.kwddwwwwwwddwk.', '.kwwwwwwwwwwwwk.', '.kwwwwwddwwwwwk.',
    '.kwwwwwddwwwwwk.', '.kwwwwwwwwwwwwk.', '.kwddwwwwwwddwk.', '.kwddwwwwwwddwk.', '.kwwwwwwwwwwwwk.', '.kSSSSSSSSSSSSk.', '..kkkkkkkkkkkk..', '................', '................'],
  { k: '#2a1a12', w: '#fbfbf4', d: '#c0392b', S: '#d8d0bc' });
  document.documentElement.style.setProperty('--back', `url(${gridURL(['gGGg', 'GggG', 'GggG', 'gGGg'], { g: '#2f8a5f', G: '#1f5a43' })}) 0 0 / 8px 8px repeat #2f8a5f`);

  const VERSION = 'v31';
  const CUP_ICON = gridURL(['kkkkkkk', 'kdddddk', 'kwwwwwk', 'kgggggk', 'kwwwwwk', '.kkkkk.'], { k: '#2a1a12', d: '#5a3418', w: '#f6f2e6', g: '#3fae6a' });
  const EGG_ICON = gridURL(['..kkk..', '.kwwwk.', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', 'kwwwwSk', '.kSSSk.', '..kkk..'], { k: '#2a1a12', w: '#fff8ea', S: '#e8dcc0' });
  const EMOTES = ['Huat ah!', 'Alamak!', 'Steady bom!', 'Cepat lah!', 'Wah lau eh', 'Tapau!', 'Cincai lah', 'Sien...', 'Ong ah!', 'Hehe...'];

  // ---------- game session ----------
  let G = null;
  const seatEls = new Map(), cardEls = new Map();
  let firstRender = true;

  // =============== HOME ===============
  function initHome() {
    const ag = $('#avatarGrid');
    for (const id of BJ.AVATAR_IDS) {
      const b = el('button', 'pick' + (id === me.avatar ? ' sel' : ''));
      b.type = 'button'; b.title = SPR.AVATARS[id].name;
      b.innerHTML = `<span class="av" style="background-image:url(${SPR.avatarSheet(id)});animation-delay:-${(Math.random() * 4).toFixed(2)}s"></span><small>${esc(SPR.AVATARS[id].name)}</small>`;
      b.onclick = () => {
        me.avatar = id; store.set('avatar', id); $$('.pick', ag).forEach(x => x.classList.toggle('sel', x === b)); AU.unlock(); AU.play('pop');
        // a dice-made name follows the avatar (so Auntie gets an auntie name); a typed name stays
        if (me.nameAuto) { me.name = SPR.randomName(id); $('#nameIn').value = me.name; store.set('name', me.name); }
      };
      ag.appendChild(b);
    }
    const dg = $('#drinkGrid');
    if (dg) for (const id of BJ.DRINK_IDS) {
      const d = SPR.DRINKS[id];
      const b = el('button', 'pick' + (id === me.drink ? ' sel' : ''));
      b.type = 'button'; b.title = d.name;
      b.innerHTML = `<span class="drink-wrap${d.hot ? ' hot' : ''}"><span class="drink" style="background-image:url(${SPR.drink(id)})"></span></span><small>${esc(d.name)}</small>`;
      b.onclick = () => { me.drink = id; store.set('drink', id); $$('.pick', dg).forEach(x => x.classList.toggle('sel', x === b)); AU.unlock(); AU.play('chip'); };
      dg.appendChild(b);
    }
    const mg = $('#modeGrid');
    let taps = 0, tapT = null;
    $('.sign').addEventListener('click', () => {
      AU.unlock();
      const sg = $('.sign'); sg.classList.remove('tap'); void sg.offsetWidth; sg.classList.add('tap');
      clearTimeout(tapT); tapT = setTimeout(() => { taps = 0; }, 2500);
      taps++;
      if (taps < 9) { AU.play('tick'); return; }
      taps = 0;
      const b = $('.mode[data-mode="bj"]', mg);
      if (!b.classList.contains('hidden')) return;
      // both secret games come out together
      $$('.mode.secret', mg).forEach(x => x.classList.remove('hidden'));
      b.click();
      AU.play('bj'); confetti(); toast('Rahsia! Uncle Jack 21, Mamak Mahjong & Lami unlocked');
      b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $$('.mode', mg).forEach(b => {
      b.classList.toggle('sel', b.dataset.mode === me.mode);
      b.onclick = () => { me.mode = b.dataset.mode; store.set('mode', me.mode); $$('.mode', mg).forEach(x => x.classList.toggle('sel', x === b)); AU.unlock(); AU.play('pop'); };
    });
    const nameIn = $('#nameIn');
    // first visit: start with a random name that fits the avatar
    if (!me.name) { me.name = SPR.randomName(me.avatar); me.nameAuto = true; store.set('name', me.name); store.set('nameAuto', true); }
    nameIn.value = me.name;
    nameIn.oninput = () => { me.name = BJ.clean(nameIn.value); me.nameAuto = false; store.set('name', me.name); store.set('nameAuto', false); };
    const dice = $('#btnDice');
    dice.style.backgroundImage = `url(${DICE})`;
    dice.onclick = () => {
      AU.unlock(); AU.play('roll');
      dice.classList.remove('roll'); void dice.offsetWidth; dice.classList.add('roll');
      let n;
      do { n = SPR.randomName(me.avatar); } while (n === me.name && SPR.NAMES[me.avatar].length > 1);
      me.name = n; me.nameAuto = true; nameIn.value = n;
      store.set('name', n); store.set('nameAuto', true);
    };
    const codeIn = $('#codeIn');
    codeIn.oninput = () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); };
    const room = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (room) { codeIn.value = room; $('.join-row').classList.add('hl'); }
    $('#btnCreate').onclick = () => { if (checkName()) startHost(); };
    $('#btnJoin').onclick = () => {
      if (!checkName()) return;
      if (codeIn.value.length !== 4) { AU.unlock(); AU.play('deny'); toast('Masukkan 4-letter code'); codeIn.focus(); return; }
      startJoin(codeIn.value);
    };
    codeIn.onkeydown = e => { if (e.key === 'Enter') $('#btnJoin').click(); };
    $('#btnHelp').onclick = showHelp;
  }
  function checkName() {
    AU.unlock();
    if (!me.name) { AU.play('deny'); toast('Tulis nama dulu! (Enter your name)'); $('#nameIn').focus(); return false; }
    return true;
  }

  // =============== GAME SCREEN ===============
  function initGameUI() {
    $('#btnMusic').style.backgroundImage = `url(${ICON.music})`;
    $('#btnSfx').style.backgroundImage = `url(${ICON.sfx})`;
    $('#btnHost').style.backgroundImage = `url(${ICON.gear})`;
    $('#btnHelp2').style.backgroundImage = `url(${ICON.help})`;
    $('#btnLeave').style.backgroundImage = `url(${ICON.exit})`;
    $('#emoteBtn').style.backgroundImage = `url(${ICON.chat})`;
    $('.tk-who .crown').style.backgroundImage = `url(${CROWN})`;
    const sync = () => { $('#btnMusic').classList.toggle('off', !AU.musicOn); $('#btnSfx').classList.toggle('off', !AU.sfxOn); };
    sync();
    $('#btnMusic').onclick = () => { AU.unlock(); AU.toggleMusic(); if (AU.musicOn) AU.startMusic(); sync(); };
    $('#btnSfx').onclick = () => { AU.unlock(); AU.toggleSfx(); AU.play('click'); sync(); };
    $('#btnHost').onclick = () => showHostMenu();
    $('#btnHelp2').onclick = showHelp;
    $('#btnLeave').onclick = confirmLeave;
    $('#codeChip').onclick = share;
    const eb = $('#emoteBar');
    eb.innerHTML = EMOTES.map(t => `<button class="emote" data-e="${esc(t)}">${esc(t)}</button>`).join('');
    eb.onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; send({ t: 'emote', text: b.dataset.e }); eb.classList.add('hidden'); };
    $('#emoteBtn').onclick = () => { AU.play('click'); eb.classList.toggle('hidden'); };
    $('#controls').onclick = e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; doAct(b.dataset.act, b.dataset.v, b); };
    $('#overlay').onclick = e => {
      const b = e.target.closest('[data-h]');
      if (b && !b.disabled) { overlayAction(b.dataset.h, b.dataset.id); return; }
      if (e.target.id === 'overlay' && G && G.overlay !== 'roulette') closeOverlay();
    };
    if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(paintTable.t); paintTable.t = setTimeout(paintTable, 120); }).observe($('#table'));
    window.addEventListener('resize', () => { clearTimeout(paintTable.t); paintTable.t = setTimeout(paintTable, 150); });
    requestAnimationFrame(tick);
  }

  function showScreen(name) {
    $('#home').classList.toggle('hidden', name !== 'home');
    $('#game').classList.toggle('hidden', name !== 'game');
    if (name === 'game') { paintTable.key = ''; setTimeout(paintTable, 30); }
  }

  function paintTable() {
    const t = $('#table'); const r = UIZ.rect(t);
    if (!r.width || !r.height) return;
    const S = innerWidth / UIZ.z < 640 ? 3 : 4;
    const w = Math.round(r.width / S), h = Math.round(r.height / S);
    const key = w + 'x' + h;
    if (paintTable.key === key) return;
    paintTable.key = key;
    const lines = w > 150 ? ['BLACKJACK PAYS 3 TO 2', 'TAUKE STANDS ON 17', 'INSURANCE PAYS 2 TO 1'] : ['BJ PAYS 3 TO 2', 'TAUKE STANDS 17'];
    t.style.backgroundImage = `url(${Scene.table(w, h, lines)})`;
  }

  // =============== NETWORK / SESSION ===============
  function genCode() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  function newSession(mode) {
    resetBoard();
    G = { mode, code: null, table: null, net: null, state: null, fxq: [], draft: 0, ctlKey: '', timer: null, overlay: null, lastTick: -1 };
    showScreen('game');
    AU.unlock(); AU.startMusic();
    wake();
  }

  function startHost() {
    newSession('host');
    const Engine = { pong: PONG.Table, kopi: KOPI.Table, order: ORDER.Table, egg: EGG.Table, tarik: TARIK.Table, duit: DUIT.Table, lalat: LALAT.Table, mamak: MAMAK.Table, roti: ROTI.Table, lami: LAMI.Table }[me.mode] || BJ.Table;
    const table = new Engine({
      hostId: me.id,
      onChange: flush,
      onFx: f => { G.fxq.push(f); flush(); },
    });
    G.table = table;
    table.addPlayer({ id: me.id, name: me.name, avatar: me.avatar, drink: me.drink });
    if (OFFLINE) {
      G.code = 'TEST'; table.s.code = 'TEST';
      const nb = Math.min(me.mode === 'pong' ? 1 : 5, +params.get('bots') || 0);
      for (let i = 0; i < nb; i++) table.addBot();
      if (params.has('autostart')) setTimeout(() => table.start(), 400);
      table.changed();
      return;
    }
    setStatus('Buka kedai... opening table');
    G.net = NET.host(genCode(), {
      newCode: genCode,
      onReady: code => {
        G.code = code; table.s.code = code; setStatus('');
        table.changed();
        toast('Meja ' + code + ' dah buka! Share the code');
      },
      onError: e => {
        if (G && G.code) { setStatus('Signal lost — friends may not be able to join', 4000); return; }
        leaveGame(true);
        alertBox('Cannot open table', 'Cannot reach the game server. Check your internet connection and try again.');
      },
      onHello: m => {
        if (!m.pid || m.pid === me.id) return { ok: false, reason: 'Invalid player' };
        if (G.privSent) delete G.privSent[String(m.pid).slice(0, 24)];
        return table.addPlayer({ id: String(m.pid).slice(0, 24), name: m.name, avatar: m.avatar, drink: m.drink });
      },
      onJoined: () => {},
      onIntent: (p, m) => table.handle(p, m),
      onStatus: st => setStatus(st === 'reconnecting' ? 'Connection lost... reconnecting' : ''),
      onRelays: r => { if (G) { G.relays = r; G.ctlKey = ''; if (G.state) { try { onState(G.state); } catch (e) { console.error(e); } } } },
      onLeave: p => table.disconnect(p),
    });
  }

  let flushing = false;
  function flush() {
    if (flushing) return;
    flushing = true;
    Promise.resolve().then(() => {
      flushing = false;
      if (!G || !G.table) return;
      const s = G.table.publicState();
      const fx = G.fxq.splice(0);
      if (G.net) { G.net.broadcast({ t: 'state', s }); for (const f of fx) G.net.broadcast({ t: 'fx', fx: f }); }
      // games with hidden hands: each player gets their own part, only when it changes
      if (G.table.privateFor) {
        G.privSent = G.privSent || {};
        for (const p of s.players) {
          if (p.isBot) continue;
          const pv = G.table.privateFor(p.id), js = JSON.stringify(pv);
          if (G.privSent[p.id] === js) continue;
          G.privSent[p.id] = js;
          if (p.id === me.id) G.priv = pv;
          else if (G.net) G.net.send(p.id, { t: 'priv', s: pv });
        }
      }
      onState(s);
      for (const f of fx) onFx(f);
    });
  }

  function startJoin(code) {
    newSession('client');
    G.code = code;
    try { sessionStorage.setItem('k21room', code); } catch (e) {}
    $('#codeTxt').textContent = code;
    setStatus('Connecting to Meja ' + code + '...');
    G.net = NET.join(code, {
      onOpen: () => { G.net.send({ t: 'hello', v: 1, pid: me.id, name: me.name, avatar: me.avatar, drink: me.drink }); setStatus(''); },
      onMsg: m => {
        if (!m || !G) return;
        if (m.t === 'state') onState(m.s);
        else if (m.t === 'priv') { G.priv = m.s; if (G.state) onState(G.state); }
        else if (m.t === 'fx') onFx(m.fx);
        else if (m.t === 'reject') { leaveGame(true); alertBox('Tak boleh masuk', esc(m.reason)); }
        else if (m.t === 'kicked') { leaveGame(true); alertBox('Kena kick!', 'The host removed you from the table.'); }
      },
      onStatus: st => setStatus(st === 'reconnecting' ? 'Connection lost... reconnecting' : ''),
      onError: (e, reached) => {
        const via = reached && reached.length ? '<br><small>Checked relays: ' + esc(reached.join(', ')) + ' · game ' + VERSION + '</small>' : '';
        const msg = e === 'notfound' ? 'Meja <b>' + esc(code) + '</b> not found. Check the code, and make sure the host has the table open on game <b>' + VERSION + '</b> (shown at the bottom of the first screen).' + via
          : e === 'lost' ? 'Host tutup kedai — the table closed or the connection was lost.'
            : e === 'timeout' ? 'The table is open but the host is not answering. Ask the host to keep the game screen open, then try again.'
              : e === 'network' ? 'Cannot reach the game server. Check your internet connection and try again.'
              : e === 'browser' ? 'This browser cannot play online. Try Chrome or Safari.'
                : 'Connection error: ' + esc(e);
        leaveGame(true);
        alertBox('Alamak!', msg);
      },
    }, me.id);
  }

  function send(m) {
    if (!G) return;
    if (G.mode === 'host') G.table.handle(me.id, m);
    else if (G.net) G.net.send(m);
  }

  function leaveGame(silent) {
    if (G) {
      if (G.net) G.net.close();
      if (G.table) G.table.gen++;
    }
    G = null;
    try { sessionStorage.removeItem('k21room'); } catch (e) {}
    AU.stopMusic();
    resetBoard();
    closeOverlay(true);
    setStatus('');
    showScreen('home');
    if (location.search) history.replaceState(null, '', location.pathname);
    if (!silent) AU.play('click');
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
  }

  function resetBoard() {
    seatEls.forEach(e => e.remove()); seatEls.clear();
    cardEls.forEach(e => e.remove()); cardEls.clear();
    $('#dealerCards').innerHTML = '';
    $('#controls').innerHTML = '';
    $('#tableMsg').textContent = '';
    $('#ticker span').textContent = '';
    $('#timerBar').classList.remove('on');
    $('#game').classList.remove('myturn');
    $('#emoteBar').classList.add('hidden');
    setPongMode(false);
    $('#game').classList.remove('hide-emote');
    firstRender = true;
  }

  let wakeLock = null;
  async function wake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && G) wake(); });
  // close the data channel on purpose so the other side notices right away
  window.addEventListener('pagehide', () => { if (G && G.net) G.net.close(); });
  window.addEventListener('beforeunload', e => {
    if (G && G.mode === 'host' && G.state && G.state.players.filter(p => !p.isBot).length > 1) { e.preventDefault(); e.returnValue = ''; }
  });

  // =============== RENDER ===============
  function onState(s) {
    if (!G) return;
    const prev = G.state;
    G.state = s;
    if (s.code) { G.code = s.code; $('#codeTxt').textContent = s.code; }
    const meP = s.players.find(p => p.id === me.id);
    G.isHost = s.hostId === me.id;
    if (s.game === 'egg') {
      $('#btnHost').classList.add('hidden');
      setView('egg');
      EV.render(s, me.id);
      renderEggHud(s);
      renderTimer(s, meP);
      renderEggControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'pick' && !(s.picked || []).includes(me.id));
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showEggResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'order') {
      $('#btnHost').classList.add('hidden');
      setView('order');
      OV.render(s, me.id);
      renderTimer(s, meP);
      renderOrderControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'answer' && s.cur === me.id);
      $('#game').classList.toggle('hide-emote', s.phase === 'answer' && s.cur === me.id);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showOrderResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'lami') {
      $('#btnHost').classList.add('hidden');
      setView('lami');
      const pv = G.priv && G.priv.key === s.round + ':' + s.hand ? G.priv : null;
      LMV.render(s, pv, me.id);
      renderTarikHud(s, '#lamiView .oq');
      renderTimer(s, meP);
      renderLamiControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'turn' && s.cur === me.id);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showLamiResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'roti') {
      $('#btnHost').classList.add('hidden');
      setView('roti');
      RV.render(s, me.id);
      renderTarikHud(s, '#rotiView .kq');
      renderTimer(s, meP);
      renderRotiControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'play' && !!meP && meP.inGame);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showRotiResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'mamak') {
      $('#btnHost').classList.add('hidden');
      setView('mamak');
      const pv = G.priv && G.priv.key === s.round + ':' + s.hand ? G.priv : (s.phase === 'lobby' || s.phase === 'over' ? null : G.priv);
      MV.render(s, pv, me.id);
      renderTarikHud(s, '#mamakView .oq');
      renderTimer(s, meP);
      renderMamakControls(s, meP, pv);
      renderTicker(s);
      $('#game').classList.toggle('myturn', (s.phase === 'turn' && s.cur === me.id) || !!(s.phase === 'claim' && pv && pv.claim));
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showMamakResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'lalat') {
      $('#btnHost').classList.add('hidden');
      setView('lalat');
      LV.render(s, me.id);
      renderTarikHud(s, '#lalatView .kq');
      renderTimer(s, meP);
      renderLalatControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'play' && !!meP && meP.inGame);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showLalatResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'duit') {
      $('#btnHost').classList.add('hidden');
      setView('duit');
      DV.render(s, me.id);
      renderTarikHud(s, '#duitView .oq');
      renderTimer(s, meP);
      renderDuitControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'count' && !!meP && meP.inGame && !(s.gave && s.gave[me.id]));
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showDuitResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'tarik') {
      $('#btnHost').classList.add('hidden');
      setView('tarik');
      TV.render(s, me.id);
      renderTarikHud(s);
      renderTimer(s, meP);
      renderTarikControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'tarik' && !!s.turn && s.turn.pid === me.id);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showTarikResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'kopi') {
      $('#btnHost').classList.add('hidden');
      setView('kopi');
      KV.render(s, me.id);
      renderKopiHud(s);
      renderTimer(s, meP);
      renderKopiControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'pour' && !!s.turn && s.turn.pid === me.id);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showKopiResult, 1600);
      firstRender = false;
      return;
    }
    if (s.game === 'pong') {
      $('#btnHost').classList.add('hidden');
      setPongMode(true);
      PV.render(s, me.id);
      renderPongHud(s);
      renderTimer(s, meP);
      renderPongControls(s, meP);
      renderTicker(s);
      $('#game').classList.toggle('myturn', s.phase === 'aim' && !!s.turn && s.turn.pid === me.id);
      if (s.phase === 'over' && prev && prev.phase !== 'over') setTimeout(showPongResult, 1500);
      firstRender = false;
      return;
    }
    $('#btnHost').classList.toggle('hidden', !G.isHost);
    const seen = new Set();
    renderTauke(s, seen);
    renderSeats(s, seen);
    for (const [id, e] of cardEls) if (!seen.has(id)) { sweepCard(e); cardEls.delete(id); }
    renderTimer(s, meP);
    renderMsg(s);
    renderControls(s, meP);
    renderTicker(s);
    $('#shoeLeft').textContent = s.shoeLeft ? s.shoeLeft : '';
    $('#game').classList.toggle('myturn', !!(s.turn && s.turn.pid === me.id) || (s.phase === 'dealer' && s.taukeId === me.id && !s.dealer.revealed));
    if (s.phase === 'gameover' && prev && prev.phase !== 'gameover') setTimeout(showPodium, 1400);
    if (G.overlay === 'hostmenu') renderHostMenu();
    firstRender = false;
  }

  function nameOf(id) { const p = G && G.state && G.state.players.find(x => x.id === id); return p ? p.name : '?'; }

  function renderTauke(s, seen) {
    const z = $('.tk-who');
    const tk = s.players.find(p => p.id === s.taukeId);
    const next = s.nextTaukeId && s.nextTaukeId !== 'random' ? s.players.find(p => p.id === s.nextTaukeId) : null;
    const hide = G.overlay === 'roulette';
    const shown = hide ? null : tk || (s.phase === 'lobby' || s.phase === 'gameover' ? next : null);
    const av = $('.av', z);
    z.dataset.pid = tk ? tk.id : '';
    if (shown) {
      setBg(av, SPR.avatarSheet(shown.avatar));
      av.style.backgroundSize = '';
      $('.nm', z).textContent = shown.name + (shown.id === me.id ? ' (you)' : '');
      setBg($('.drink', z), SPR.drink(shown.drink));
      $('.drink-wrap', z).classList.toggle('hot', SPR.DRINKS[shown.drink].hot);
      $('.drink-wrap', z).style.visibility = '';
      setChips($('.chipsline', z), shown.chips);
    } else {
      setBg(av, DICE); av.style.backgroundSize = '100% 100%';
      $('.nm', z).textContent = 'Random';
      $('.drink-wrap', z).style.visibility = 'hidden';
      setChips($('.chipsline', z), null);
    }
    $('.crown', z).style.display = tk && !hide ? '' : 'none';
    $('.badge', z).textContent = tk ? 'TAUKE' : 'NEXT TAUKE';
    if (hide) $('.nm', z).textContent = '???';
    z.classList.toggle('me', !!tk && tk.id === me.id);
    syncCards($('#dealerCards'), s.dealer.cards, seen);
    const dt = $('#dealerTot');
    const vis = s.dealer.cards.filter(c => !c.hidden);
    if (!vis.length) { setHTML(dt, ''); dt.className = 'tot'; dt.style.visibility = 'hidden'; }
    else {
      dt.style.visibility = '';
      const t = BJ.total(vis).t, hid = vis.length < s.dealer.cards.length;
      const bj = s.dealer.revealed && s.dealer.cards.length === 2 && t === 21;
      setHTML(dt, t > 21 ? 'BUST ' + t : bj ? 'BLACKJACK' : t + (hid ? ' + ?' : ''));
      dt.className = 'tot' + (t > 21 ? ' bust' : bj ? ' bj' : t === 21 ? ' t21' : '');
    }
  }

  function renderSeats(s, seen) {
    const list = s.players.filter(p => p.id !== s.taukeId);
    const box = $('#seats');
    const ids = new Set(list.map(p => p.id));
    for (const [id, e] of seatEls) if (!ids.has(id)) { e.remove(); seatEls.delete(id); }
    list.forEach((p, i) => {
      let e = seatEls.get(p.id), fresh = false;
      if (!e) { e = makeSeat(p); seatEls.set(p.id, e); fresh = true; }
      if (box.children[i] !== e) box.insertBefore(e, box.children[i] || null);
      updateSeat(e, p, s, seen);
      if (fresh && !firstRender) { AU.play('pop'); bubble(p.id, p.id === me.id ? 'Hai semua!' : 'Hello!', 'happy'); }
    });
  }

  function makeSeat(p) {
    const e = el('div', 'seat');
    e.dataset.pid = p.id;
    e.innerHTML = `<div class="hands"></div>
      <div class="betspot none"><div class="stack"></div><span class="amt"></span></div>
      <div class="who"><div class="bubble"></div><div class="av" style="animation-delay:-${(Math.random() * 4).toFixed(2)}s"></div><div class="drink-wrap"><span class="drink"></span></div></div>
      <div class="plate"><b class="nm"></b><span class="chipsline"></span></div>
      <div class="tag"></div>`;
    return e;
  }

  function updateSeat(e, p, s, seen) {
    const ph = s.phase;
    const active = ['dealing', 'insurance', 'playing', 'dealer', 'settle'].includes(ph);
    e.classList.toggle('me', p.id === me.id);
    e.classList.toggle('turn', !!(s.turn && s.turn.pid === p.id));
    e.classList.toggle('out', !!p.out && ph !== 'lobby');
    e.classList.toggle('offline', !p.connected);
    e.classList.toggle('sitout', active && !p.inRound && !p.out);
    e.classList.toggle('win', ph === 'settle' && !!p.result && p.result.delta > 0);
    e.classList.toggle('ntauke', s.nextTaukeId === p.id);
    setBg($('.av', e), SPR.avatarSheet(p.avatar));
    setBg($('.drink', e), SPR.drink(p.drink));
    $('.drink-wrap', e).classList.toggle('hot', SPR.DRINKS[p.drink].hot);
    setText($('.nm', e), p.name);
    setChips($('.chipsline', e), p.chips);

    const hb = $('.hands', e);
    const hands = p.hands || [];
    while (hb.children.length < hands.length) hb.appendChild(el('div', 'hand', '<div class="cards"></div><div class="hinfo"></div>'));
    while (hb.children.length > hands.length) {
      const last = hb.lastElementChild;
      $$('.card', last).forEach(c => { const id = c.dataset.id; if (cardEls.get(id) === c) { cardEls.delete(id); sweepCard(c); } });
      last.remove();
    }
    hands.forEach((h, hi) => {
      const he = hb.children[hi];
      syncCards($('.cards', he), h.cards, seen);
      he.classList.toggle('active', !!(s.turn && s.turn.pid === p.id && s.turn.hand === hi && hands.length > 1));
      setHTML($('.hinfo', he), handInfo(h));
    });
    const amt = hands.length ? hands.reduce((a, h) => a + h.bet, 0) + (p.insurance || 0) : (p.locked ? p.bet : 0);
    setStack($('.betspot', e), amt);

    let tag = '', cls = '';
    if (!p.connected) { tag = 'OFFLINE'; cls = 'out'; }
    else if (ph === 'lobby') { tag = p.id === s.hostId ? 'HOST' : p.isBot ? 'BOT' : 'READY'; cls = 'ready'; }
    else if (p.out) { tag = 'POKAI · OUT'; cls = 'out'; }
    else if (ph === 'betting') { tag = p.locked ? 'BET IN' : 'BETTING...'; cls = p.locked ? 'ready' : 'wait'; }
    else if (ph === 'insurance' && p.inRound && !p.insDecided) { tag = 'INSURANCE?'; cls = 'wait'; }
    else if (ph === 'playing' && s.turn && s.turn.pid === p.id) { tag = 'THINKING...'; cls = 'wait'; }
    else if (ph === 'settle' && p.result) { tag = p.result.label + ' ' + fmtDelta(p.result.delta); cls = p.result.delta > 0 ? 'ready' : p.result.delta < 0 ? 'out' : ''; }
    else if (active && !p.inRound) tag = 'SIT OUT';
    else if (ph === 'gameover') tag = p.chips + ' CHIPS';
    const te = $('.tag', e);
    setText(te, tag); te.className = 'tag ' + cls;
  }

  function handInfo(h) {
    if (!h.cards.length) return '';
    const { t, soft } = BJ.total(h.cards);
    let txt = t, c = '';
    if (t > 21) { txt = h.result ? t : 'BUST'; c = 'bust'; }
    else if (BJ.isBJ(h)) { txt = 'BJ!'; c = 'bj'; }
    else if (t === 21) c = 't21';
    else if (soft && !h.done) txt = (t - 10) + '/' + t;
    let out = `<span class="tot ${c}">${txt}</span>`;
    if (h.doubled) out += '<span class="tot">x2</span>';
    if (h.result) out += `<span class="res ${h.result}">${h.result === 'BLACKJACK' ? 'BJ' : h.result}</span>`;
    return out;
  }

  function setBg(e, url) { if (e._bg !== url) { e._bg = url; e.style.backgroundImage = `url(${url})`; } }
  function setText(e, t) { t = String(t); if (e._t !== t) { e._t = t; e.textContent = t; } }
  function setHTML(e, h) { if (e._h !== h) { e._h = h; e.innerHTML = h; } }
  const fmtDelta = d => (d > 0 ? '+' : d === 0 ? '±' : '') + d;

  function setChips(line, v) {
    if (v == null) { setHTML(line, ''); line._v = undefined; return; }
    if (!line._init) { line._init = true; line.innerHTML = `<img src="${SPR.chip(100)}" alt=""><i></i>`; }
    const i = $('i', line);
    if (line._v === undefined || firstRender) { line._v = v; i.textContent = v; return; }
    if (line._v === v) return;
    const from = line._v, to = v, t0 = performance.now();
    line._v = v;
    line.classList.remove('up', 'down'); void line.offsetWidth; line.classList.add(to > from ? 'up' : 'down');
    const stepN = now => {
      const k = Math.min(1, (now - t0) / 600);
      i.textContent = Math.round(from + (to - from) * k);
      if (k < 1 && line._v === to) requestAnimationFrame(stepN);
    };
    requestAnimationFrame(stepN);
  }

  function chipBreak(amt) {
    const out = [];
    for (const v of [500, 100, 50, 10]) while (amt >= v && out.length < 7) { out.push(v); amt -= v; }
    if (amt > 0 && out.length < 7) out.push(10);
    return out;
  }
  function setStack(spot, amt) {
    if (spot._amt === amt) return;
    spot._amt = amt;
    spot.classList.toggle('none', !amt);
    if (!amt) return;
    $('.stack', spot).innerHTML = chipBreak(amt).reverse().map((v, i) => `<img src="${SPR.chip(v)}" alt="" style="bottom:${i * 3}px">`).join('');
    $('.amt', spot).textContent = amt;
  }

  // ---------- cards ----------
  function makeCard(c) {
    const e = el('div', 'card down', '<div class="inner"><div class="face front"></div><div class="face back"></div></div>');
    e.dataset.id = c.id;
    if (!c.hidden) setFace(e, c);
    return e;
  }
  function setFace(e, c) {
    const red = c.s === 'H' || c.s === 'D';
    $('.front', e).innerHTML = `<span class="rk${red ? ' red' : ''}">${c.r}</span><img class="sm" src="${SPR.suit(c.s)}" alt=""><img class="bg" src="${SPR.suit(c.s)}" alt="">`;
    e._face = true;
  }
  function syncCards(box, cards, seen) {
    cards.forEach((c, i) => {
      seen.add(c.id);
      let e = cardEls.get(c.id);
      if (!e) {
        e = makeCard(c); cardEls.set(c.id, e);
        box.insertBefore(e, box.children[i] || null);
        if (firstRender) { if (!c.hidden) e.classList.remove('down'); }
        else dealIn(e, !c.hidden);
        return;
      }
      if (e.parentNode !== box) {
        const r0 = UIZ.rect(e);
        box.insertBefore(e, box.children[i] || null);
        const r1 = UIZ.rect(e);
        e.animate([{ transform: `translate(${r0.left - r1.left}px,${r0.top - r1.top}px)` }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
      } else if (box.children[i] !== e) box.insertBefore(e, box.children[i] || null);
      if (!c.hidden && !e._face) { setFace(e, c); e.classList.remove('down'); AU.play('flip'); }
    });
  }
  function dealIn(e, faceUp) {
    const sh = UIZ.rect($('#shoe')), r = UIZ.rect(e);
    const dx = sh.left + 8 - r.left, dy = sh.top + 8 - r.top;
    e.animate([
      { transform: `translate(${dx}px,${dy}px) rotate(-25deg) scale(.8)` },
      { transform: 'translate(0,-6px) rotate(3deg)', offset: 0.85 },
      { transform: 'none' },
    ], { duration: 380, easing: 'cubic-bezier(.3,.8,.4,1)' });
    AU.play('card');
    if (faceUp) setTimeout(() => e.classList.remove('down'), 330);
  }
  function sweepCard(e) {
    const r = UIZ.rect(e);
    if (!r.width || firstRender) { e.remove(); return; }
    const tk = UIZ.rect($('.tk-who'));
    e.classList.add('sweep');
    Object.assign(e.style, { left: r.left + 'px', top: r.top + 'px', margin: 0 });
    $('#fxLayer').appendChild(e);
    const dx = tk.left + tk.width / 2 - r.left, dy = tk.top - r.top;
    const a = e.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${(Math.random() * 60 - 30) | 0}deg) scale(.5)`, opacity: 0 }],
      { duration: 500, delay: Math.random() * 150, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => e.remove();
  }

  // ---------- timer bar ----------
  function renderTimer(s, meP) {
    const bar = $('#timerBar');
    const t = s.timer;
    if (!t) { G.timer = null; bar.classList.remove('on'); return; }
    if (!G.timer || G.timer.id !== t.id) G.timer = { id: t.id, end: performance.now() + t.left, total: t.total || 1 };
    if (s.game === 'egg') {
      setText($('#timerLbl'), t.kind === 'pick' ? ((s.picked || []).includes(me.id) ? 'WAITING OTHERS...' : 'PICK A BOWL!') : 'NEXT LEVEL IN');
      G.timer.mine = t.kind === 'pick' && !(s.picked || []).includes(me.id);
      bar.classList.add('on');
      return;
    }
    if (s.game === 'order') {
      const mine = s.cur === me.id, cn = s.cur ? nameOf(s.cur).toUpperCase() : '';
      setText($('#timerLbl'), t.kind === 'show' ? (mine ? 'DENGAR! LISTEN UP' : cn + ' LISTENING...') : t.kind === 'answer' ? (mine ? 'KEY IN THE ORDER!' : cn + ' KEYING IN...') : 'NEXT TABLE IN');
      G.timer.mine = mine && t.kind === 'answer';
      bar.classList.add('on');
      return;
    }
    if (s.game === 'lami') {
      const mine = t.kind === 'turn' && s.cur === me.id;
      setText($('#timerLbl'), t.kind === 'turn' ? (mine ? 'GILIRAN KAU!' : nameOf(s.cur).toUpperCase() + '...') : 'NEXT HAND');
      G.timer.mine = mine;
      bar.classList.add('on');
      return;
    }
    if (s.game === 'roti') {
      setText($('#timerLbl'), t.kind === 'play' ? (s.telur ? 'ROTI TELUR!' : 'TEBAR ROTI!') : t.kind === 'ready' ? 'SIAP...' : 'REHAT');
      G.timer.mine = t.kind === 'play';
      bar.classList.add('on');
      return;
    }
    if (s.game === 'mamak') {
      const mine = (t.kind === 'turn' && s.cur === me.id) || (t.kind === 'claim' && G.priv && G.priv.claim);
      setText($('#timerLbl'), t.kind === 'turn' ? (s.cur === me.id ? 'GILIRAN KAU!' : nameOf(s.cur).toUpperCase() + '...') : t.kind === 'claim' ? 'CHOP? MAKAN?' : 'NEXT HAND');
      G.timer.mine = !!mine;
      bar.classList.add('on');
      return;
    }
    if (s.game === 'lalat') {
      setText($('#timerLbl'), t.kind === 'play' ? 'PAP LALAT!' : t.kind === 'ready' ? 'SIAP...' : 'REHAT');
      G.timer.mine = t.kind === 'play';
      bar.classList.add('on');
      return;
    }
    if (s.game === 'duit') {
      const done = !!(s.gave && s.gave[me.id]);
      setText($('#timerLbl'), done ? 'TUNGGU...' : 'KIRA BAKI!');
      G.timer.mine = !done && !!meP && meP.inGame;
      bar.classList.add('on');
      return;
    }
    if (s.game === 'tarik') {
      const mine = !!(s.turn && s.turn.pid === me.id);
      setText($('#timerLbl'), mine ? 'YOUR TARIK!' : (s.turn ? nameOf(s.turn.pid).toUpperCase() + ' TARIK...' : ''));
      G.timer.mine = mine && t.kind === 'tarik' && !TV.started();
      bar.classList.add('on');
      return;
    }
    if (s.game === 'kopi') {
      const mine = !!(s.turn && s.turn.pid === me.id);
      setText($('#timerLbl'), mine ? 'YOUR POUR!' : (s.turn ? nameOf(s.turn.pid).toUpperCase() + ' POURING...' : ''));
      G.timer.mine = mine && t.kind === 'pour';
      bar.classList.add('on');
      return;
    }
    if (s.game === 'pong') {
      const mine = !!(s.turn && s.turn.pid === me.id);
      setText($('#timerLbl'), mine ? 'YOUR THROW!' : (s.turn ? nameOf(s.turn.pid).toUpperCase() + ' AIMING...' : ''));
      G.timer.mine = mine && t.kind === 'aim';
      bar.classList.add('on');
      return;
    }
    const tk = s.players.find(p => p.id === s.taukeId);
    const turnName = s.turn ? nameOf(s.turn.pid) : '';
    const lbl = { bet: 'PLACE YOUR BETS!', ins: 'INSURANCE?', turn: s.turn && s.turn.pid === me.id ? 'YOUR TURN!' : turnName.toUpperCase() + "'S TURN", open: tk && tk.id === me.id ? 'TAUKE, OPEN KAD!' : 'TAUKE OPENING...', settle: 'NEXT ROUND IN' }[t.kind] || '';
    setText($('#timerLbl'), lbl);
    G.timer.mine = (t.kind === 'turn' && s.turn && s.turn.pid === me.id) ||
      (t.kind === 'bet' && meP && !meP.locked && !meP.out && s.taukeId !== me.id) ||
      (t.kind === 'ins' && meP && meP.inRound && !meP.insDecided) ||
      (t.kind === 'open' && s.taukeId === me.id);
    bar.classList.add('on');
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (!G || !G.timer) return;
    const left = Math.max(0, G.timer.end - now);
    $('#timerFill').style.width = (left / G.timer.total * 100).toFixed(1) + '%';
    const sec = Math.ceil(left / 1000);
    $('#timerSec').textContent = sec + 's';
    const urgent = sec <= 5 && G.timer.mine;
    $('#timerBar').classList.toggle('urgent', urgent);
    if (urgent && sec !== G.lastTick && sec > 0) { G.lastTick = sec; AU.play('tick'); }
  }

  function renderMsg(s) {
    const n = s.players.length;
    let m = '';
    switch (s.phase) {
      case 'lobby': m = n < 2 ? 'SHARE CODE ' + (s.code || '') + ' · NEED 2+ PLAYERS' : n + ' PLAYERS AT THE TABLE'; break;
      case 'betting': m = 'PLACE YOUR BETS'; break;
      case 'dealing': m = 'DEALING...'; break;
      case 'insurance': m = 'TAUKE SHOWS ACE!'; break;
      case 'playing': m = s.turn ? nameOf(s.turn.pid).toUpperCase() + "'S TURN" : ''; break;
      case 'dealer': m = s.dealer.revealed ? 'TAUKE DRAWING...' : 'WAITING TAUKE OPEN'; break;
      case 'settle': m = 'ROUND ' + s.round + ' DONE'; break;
      case 'gameover': m = 'GAME OVER'; break;
    }
    if (s.nextTaukeId && s.phase !== 'lobby') m += ' · NEXT TAUKE: ' + (s.nextTaukeId === 'random' ? 'RANDOM' : nameOf(s.nextTaukeId).toUpperCase());
    setText($('#tableMsg'), m);
  }

  function renderTicker(s) {
    const last = s.log[s.log.length - 1];
    const sp = $('#ticker span');
    const txt = last ? last.t : '';
    if (sp._t === txt) return;
    sp._t = txt; sp.textContent = txt;
    sp.classList.remove('new'); void sp.offsetWidth; sp.classList.add('new');
  }

  // ---------- controls ----------
  function maxBet(s, meP) { return Math.min(s.settings.maxBet, meP ? meP.chips : 0); }

  function renderControls(s, meP) {
    const box = $('#controls');
    if (!meP) { setCtl(box, 'none', '<div class="ctl-info">Spectating...</div>'); return; }
    const isT = s.taukeId === me.id, ph = s.phase, host = s.hostId === me.id;
    const turnMine = !!(s.turn && s.turn.pid === me.id);
    const hand = turnMine ? meP.hands[s.turn.hand] : null;
    const cd = hand && BJ.canDouble(meP, hand), cs = hand && BJ.canSplit(meP, hand);
    const lockedN = s.players.filter(p => p.locked).length;
    const bettors = s.players.filter(p => p.id !== s.taukeId && p.connected && !p.out).length;
    const key = [ph, isT, meP.locked, meP.out, turnMine, s.turn && s.turn.hand, cd, cs, meP.insDecided, meP.inRound, s.dealer.revealed, lockedN > 0, host, ph === 'lobby' ? s.players.length + ':' + s.nextTaukeId : '', meP.result ? meP.result.delta : ''].join('|');
    let html = null;

    if (ph === 'lobby') {
      const n = s.players.length;
      const nt = s.nextTaukeId && s.nextTaukeId !== 'random' ? nameOf(s.nextTaukeId) : 'Random';
      html = host
        ? `<div class="ctl-info">Players <b>${n}/${BJ.MAX_PLAYERS}</b> · Tauke: <b>${esc(nt)}</b></div>
           <div class="ctl-row"><button class="btn fixed" data-act="addBot" ${n >= BJ.MAX_PLAYERS ? 'disabled' : ''}>+ BOT</button>
           <button class="btn blue fixed" data-act="hostMenu">TAUKE</button>
           <button class="btn red big" data-act="start" ${n < 2 ? 'disabled' : ''}>START!<small>Mula main</small></button></div>
           <div class="ctl-hint">${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Duduk dulu... waiting for host to <b>START</b></div><div class="ctl-hint">Everyone starts with 1000 chips · No credit lah!</div>`;
    } else if (ph === 'betting') {
      if (isT) html = `<div class="ctl-info">You are <b>TAUKE</b>! Bank <b>${meP.chips}</b></div><div class="ctl-hint">${lockedN}/${bettors} players bet</div>
        <div class="ctl-row"><button class="btn green big" data-act="deal" ${lockedN ? '' : 'disabled'}>DEAL NOW<small>Tak tunggu lagi</small></button></div>`;
      else if (meP.out) html = outHTML();
      else if (meP.locked) html = `<div class="ctl-info">Bet locked <b>${meP.bet}</b> · Baki <b>${meP.chips}</b></div><div class="ctl-hint">Tunggu Tauke deal... (waiting for others)</div>`;
      else {
        html = `<div class="ctl-info">Baki <b id="cBal"></b> · Bet <b id="cBet"></b></div>
          <div class="chips-row">${[10, 50, 100, 500].map(v => `<button class="chip-btn" data-act="chip" data-v="${v}"><img src="${SPR.chip(v)}" alt=""><span>${v}</span></button>`).join('')}</div>
          <div class="ctl-row"><button class="btn fixed" data-act="clear">CLEAR</button><button class="btn fixed" data-act="max">MAX</button><button class="btn red big" data-act="bet" id="cBetBtn">BET!</button></div>`;
        if (G.ctlKey !== key) G.draft = Math.max(s.settings.minBet, Math.min(store.get('lastBet', 50), maxBet(s, meP)));
      }
    } else if (ph === 'dealing') {
      html = `<div class="ctl-info">Dealing kad...</div>${meP.out && !isT ? '<div class="ctl-hint">Pokai — sitting out</div>' : ''}`;
    } else if (ph === 'insurance') {
      if (meP.inRound && !meP.insDecided) {
        const half = Math.ceil(meP.hands[0].bet / 2);
        html = `<div class="ctl-info">Tauke shows <b>A</b>! Insurance? Cost <b>${half}</b></div><div class="ctl-hint">Pays 2:1 if Tauke has blackjack</div>
          <div class="ctl-row"><button class="btn green big" data-act="insYes">YES<small>Beli</small></button><button class="btn big" data-act="insNo">NO<small>Tak payah</small></button></div>`;
      } else html = `<div class="ctl-info">Waiting insurance...</div>`;
    } else if (ph === 'playing') {
      if (turnMine && hand) {
        const t = BJ.total(hand.cards).t;
        const up = s.dealer.cards[0] ? BJ.val(s.dealer.cards[0].r) : '?';
        html = `<div class="ctl-info">Your hand <b>${t}</b>${meP.hands.length > 1 ? ` <span class="px">(${s.turn.hand + 1}/${meP.hands.length})</span>` : ''} · Tauke shows <b>${up === 11 ? 'A' : up}</b></div>
          <div class="ctl-row">
            <button class="btn green big" data-act="hit">HIT<small>Tambah</small></button>
            <button class="btn red big" data-act="stand">STAND<small>Cukup</small></button>
            <button class="btn blue big" data-act="double" ${cd ? '' : 'disabled'}>DOUBLE<small>x2 bet</small></button>
            <button class="btn gold big" data-act="split" ${cs ? '' : 'disabled'}>SPLIT<small>Pecah</small></button>
          </div>`;
      } else {
        const who = s.turn ? nameOf(s.turn.pid) : '...';
        const mine = meP.inRound ? meP.hands.map(h => BJ.total(h.cards).t).join(' & ') : '';
        html = `<div class="ctl-info">Waiting for <b>${esc(who)}</b>...</div>${isT ? '<div class="ctl-hint">You are Tauke — you open after everyone</div>' : mine ? `<div class="ctl-hint">Your hand: ${mine}</div>` : meP.out ? '<div class="ctl-hint">Pokai — sitting out</div>' : ''}`;
      }
    } else if (ph === 'dealer') {
      html = isT && !s.dealer.revealed
        ? `<div class="ctl-info">Your turn, <b>TAUKE</b>!</div><div class="ctl-row"><button class="btn red big pulse" data-act="open">OPEN KAD!<small>Reveal &amp; draw</small></button></div>`
        : `<div class="ctl-info">${s.dealer.revealed ? 'Tauke drawing...' : 'Tauke opening kad...'}</div>`;
    } else if (ph === 'settle') {
      const r = meP.result;
      const info = r ? (isT ? `Tauke result <b>${fmtDelta(r.delta)}</b>` : `<b>${r.label}</b> ${fmtDelta(r.delta)}`) : meP.out ? '<b>POKAI</b> — sitting out' : 'Round over';
      html = `<div class="ctl-info">${info} · Baki <b>${meP.chips}</b></div>` +
        (isT || host ? `<div class="ctl-row"><button class="btn green big" data-act="next">NEXT ROUND<small>Main lagi</small></button></div>` : '<div class="ctl-hint">Next round coming...</div>');
    } else if (ph === 'gameover') {
      html = `<div class="ctl-info"><b>GAME OVER</b> · You: <b>${meP.chips}</b> chips</div><div class="ctl-row"><button class="btn blue big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">NEW GAME<small>Reset 1000</small></button>' : ''}</div>${host ? '' : '<div class="ctl-hint">Waiting host for new game...</div>'}`;
    }
    setCtl(box, key, html || '');
    updateDraft(s, meP);
  }
  function outHTML() { return '<div class="ctl-info"><b>POKAI!</b> Chips habis — no credit.</div><div class="ctl-hint">You sit out. Cheer your friends lah!</div>'; }
  function setCtl(box, key, html) {
    if (G.ctlKey === key) return;
    G.ctlKey = key;
    box.innerHTML = html;
    box.animate([{ transform: 'translateY(8px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 160, easing: 'steps(3)' });
  }
  function updateDraft(s, meP) {
    const b = $('#cBet'); if (!b || !meP) return;
    s = s || G.state;
    $('#cBal').textContent = meP.chips - G.draft;
    b.textContent = G.draft;
    const mx = maxBet(s, meP);
    $$('.chip-btn').forEach(c => { c.disabled = G.draft + (+c.dataset.v) > mx; });
    const bb = $('#cBetBtn'); if (bb) bb.disabled = G.draft < s.settings.minBet;
  }

  function doAct(a, v, btn) {
    AU.unlock();
    const s = G && G.state; if (!s) return;
    const meP = s.players.find(p => p.id === me.id);
    switch (a) {
      case 'chip': {
        const mx = maxBet(s, meP);
        G.draft = Math.min(mx, G.draft + (+v)); AU.play('chip');
        btn.animate([{ transform: 'translateY(-10px)' }, { transform: 'none' }], { duration: 180, easing: 'steps(3)' });
        updateDraft(s, meP); return;
      }
      case 'clear': G.draft = 0; AU.play('click'); updateDraft(s, meP); return;
      case 'max': G.draft = maxBet(s, meP); AU.play('chip'); updateDraft(s, meP); return;
      case 'bet':
        if (G.draft < s.settings.minBet) { AU.play('deny'); toast('Min bet ' + s.settings.minBet); return; }
        store.set('lastBet', G.draft); send({ t: 'bet', amount: G.draft }); return;
      case 'deal': AU.play('click'); send({ t: 'deal' }); return;
      case 'hit': case 'stand': case 'double': case 'split': AU.play('click'); send({ t: 'act', a }); return;
      case 'insYes': send({ t: 'ins', yes: true }); return;
      case 'insNo': AU.play('click'); send({ t: 'ins', yes: false }); return;
      case 'open': send({ t: 'open' }); return;
      case 'next': AU.play('click'); send({ t: 'next' }); return;
      case 'start': AU.play('tada'); send({ t: 'start' }); return;
      case 'addBot': AU.play('pop'); send({ t: 'addBot' }); return;
      case 'hostMenu': showHostMenu(); return;
      case 'newGame': send({ t: 'newGame' }); closeOverlay(); return;
      case 'rtLetak': RV.letak(); return;
      case 'lmMeld': LMV.meld(); return;
      case 'lmEnd': send({ t: 'endTurn' }); return;
      case 'mjDiscard': MV.discardSel(); return;
      case 'mjWin': send({ t: 'selfwin' }); return;
      case 'mjChop': send({ t: 'claim', what: 'chop' }); return;
      case 'mjMakan': send({ t: 'claim', what: 'makan' }); return;
      case 'mjPass': send({ t: 'claim', what: 'pass' }); return;
      case 'mjNext': send({ t: 'next' }); return;
      case 'results': if (G.state && G.state.game === 'lami') showLamiResult(); else if (G.state && G.state.game === 'roti') showRotiResult(); else if (G.state && G.state.game === 'mamak') showMamakResult(); else if (G.state && G.state.game === 'lalat') showLalatResult(); else if (G.state && G.state.game === 'duit') showDuitResult(); else if (G.state && G.state.game === 'tarik') showTarikResult(); else if (G.state && G.state.game === 'order') showOrderResult(); else if (G.state && G.state.game === 'egg') showEggResult(); else showPodium(); return;
      case 'submitOrder': AU.play('chip'); send({ t: 'chit', items: OV.chitNow() }); send({ t: 'submit' }); return;
      case 'menu': confirmLeave(); return;
    }
  }

  // =============== FX ===============
  function targetFor(pid) {
    if (!G || !G.state) return null;
    if (G.state.game === 'pong') return $$('#pongView .ph-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'lami') return $$('#lamiView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'roti') return $$('#rotiView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'mamak') return $$('#mamakView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'lalat') return $$('#lalatView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'duit') return $$('#duitView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'tarik') return $$('#tarikView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'kopi') return $$('#kopiView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'order') return $$('#orderView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (G.state.game === 'egg') return $$('#eggView .kp-card').find(c => c.dataset.pid === pid) || null;
    if (pid === G.state.taukeId) return $('.tk-who');
    return seatEls.get(pid) || null;
  }
  function avatarOf(pid) { const t = targetFor(pid); return t ? $('.av', t) : null; }

  function onFx(f) {
    if (!G || !f) return;
    if (G.state && G.state.game === 'pong') { pongFx(f); return; }
    if (G.state && G.state.game === 'kopi') { kopiFx(f); return; }
    if (G.state && G.state.game === 'tarik') { tarikFx(f); return; }
    if (G.state && G.state.game === 'duit') { duitFx(f); return; }
    if (G.state && G.state.game === 'lalat') { lalatFx(f); return; }
    if (G.state && G.state.game === 'mamak') { mamakFx(f); return; }
    if (G.state && G.state.game === 'roti') { rotiFx(f); return; }
    if (G.state && G.state.game === 'lami') { lamiFx(f); return; }
    if (G.state && G.state.game === 'order') { orderFx(f); return; }
    if (G.state && G.state.game === 'egg') { eggFx(f); return; }
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'bet': flyChips(f.pid, f.amount); break;
      case 'bust': {
        const a = avatarOf(f.pid); mood(a, 'sad'); AU.play('bust');
        const t = targetFor(f.pid); if (t) burst(t, ['#c0392b', '#ff6b5b', '#2a1a12'], 14);
        if (f.pid === me.id) { shakeScreen(); vibrate([60, 40, 90]); }
        break;
      }
      case 'bj': {
        const t = targetFor(f.pid); if (t) burst(t, ['#f6c744', '#fff3b0', '#ffffff', '#ff8a7a'], 30);
        mood(avatarOf(f.pid), 'happy'); AU.play('bj');
        showBanner(f.pid === me.id ? 'BLACKJACK!!' : nameOf(f.pid).toUpperCase() + ' BLACKJACK!', 'bj');
        if (f.pid === me.id) vibrate([50, 30, 50, 30, 120]);
        break;
      }
      case 'turn':
        if (f.pid === me.id) { AU.play('turn'); showBanner('YOUR TURN!', 'info'); vibrate(80); }
        break;
      case 'result': resultFx(f); break;
      case 'taukePick': taukePick(f); break;
      case 'shuffle': { const sh = $('#shoe'); sh.classList.remove('shuffling'); void sh.offsetWidth; sh.classList.add('shuffling'); AU.play('shuffle'); setTimeout(() => sh.classList.remove('shuffling'), 1600); break; }
      case 'peek': {
        const c = $('#dealerCards').children[1];
        if (c) { c.classList.remove('peek'); void c.offsetWidth; c.classList.add('peek'); }
        bubble(G.state.taukeId, '...', 'neutral');
        break;
      }
      case 'gameover': confetti(); AU.play('tada'); break;
    }
  }

  function bubble(pid, text, md) {
    const t = targetFor(pid); if (!t) return;
    const b = $('.bubble', t); if (!b) return;
    b.textContent = text;
    b.className = 'bubble ' + (md || '');
    b.style.marginLeft = '0px';
    if (t.classList.contains('tk-who') || t.classList.contains('ph-card') || t.classList.contains('kp-card')) { void b.offsetWidth; b.classList.add('show'); if (md === 'happy' || md === 'sad') mood($('.av', t), md); return; }
    const pr = UIZ.rect(b.parentElement), half = b.offsetWidth / 2, cx = pr.left + pr.width / 2;
    const shift = Math.max(6 - (cx - half), Math.min(0, innerWidth / UIZ.z - 6 - (cx + half)));
    b.style.marginLeft = shift + 'px';
    void b.offsetWidth;
    b.classList.add('show');
    if (md === 'happy' || md === 'sad') mood($('.av', t), md);
  }
  function mood(av, m) {
    if (!av) return;
    av.classList.remove('happy', 'sad'); void av.offsetWidth; av.classList.add(m);
    clearTimeout(av._mt); av._mt = setTimeout(() => av.classList.remove(m), 1600);
  }
  function center(e) { const r = UIZ.rect(e); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; }

  function flyChips(pid, amount) {
    const t = targetFor(pid); if (!t) return;
    const from = center($('.av', t));
    const spot = $('.betspot', t);
    const to = spot ? center(spot) : { x: from.x, y: from.y - 60 };
    if (spot && spot.classList.contains('none')) to.y -= 0;
    chipBreak(amount).slice(0, 4).forEach((v, i) => {
      const c = el('img', 'fly'); c.src = SPR.chip(v); c.alt = '';
      c.style.left = (from.x - 12) + 'px'; c.style.top = (from.y - 12) + 'px';
      $('#fxLayer').appendChild(c);
      const dx = to.x - from.x, dy = to.y - from.y;
      const a = c.animate([
        { transform: 'translate(0,0) scale(.8)' },
        { transform: `translate(${dx / 2}px,${dy / 2 - 46}px) scale(1.25)` },
        { transform: `translate(${dx}px,${dy}px) scale(1)` },
      ], { duration: 420, delay: i * 80, easing: 'linear', fill: 'both' });
      a.onfinish = () => { c.remove(); if (i === 0) AU.play('chip'); };
    });
  }

  function floatText(target, text, cls) {
    if (!target) return;
    const r = UIZ.rect(target);
    const d = el('div', 'float ' + (cls || ''));
    d.textContent = text;
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + 10) + 'px';
    $('#fxLayer').appendChild(d);
    const a = d.animate([
      { transform: 'translate(-50%, 10px) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -10px) scale(1.3)', opacity: 1, offset: 0.15 },
      { transform: 'translate(-50%, -24px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -54px) scale(1)', opacity: 0 },
    ], { duration: 1800, easing: 'steps(14)', fill: 'forwards' });
    a.onfinish = () => d.remove();
  }

  function burst(target, colors, n) {
    const c = center(target);
    for (let i = 0; i < n; i++) {
      const p = el('div', 'px');
      p.style.background = colors[i % colors.length];
      p.style.left = c.x + 'px'; p.style.top = (c.y - 10) + 'px';
      $('#fxLayer').appendChild(p);
      const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 70;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - 30;
      const a = p.animate([
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.25}px,${dy + 70}px)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: 'steps(10)', fill: 'forwards' });
      a.onfinish = () => p.remove();
    }
  }

  function confetti() {
    const cols = ['#f6c744', '#c0392b', '#2f8a5f', '#2a5cb0', '#fbf3dc', '#f58ab0'];
    for (let i = 0; i < 70; i++) {
      const p = el('div', 'px');
      p.style.background = cols[i % cols.length];
      p.style.left = (Math.random() * innerWidth / UIZ.z) + 'px'; p.style.top = '-10px';
      $('#fxLayer').appendChild(p);
      const dx = (Math.random() - 0.5) * 120, dy = innerHeight / UIZ.z + 30;
      const a = p.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)` }],
        { duration: 1800 + Math.random() * 1800, delay: Math.random() * 600, easing: 'steps(24)', fill: 'forwards' });
      a.onfinish = () => p.remove();
    }
  }

  function resultFx(f) {
    const t = targetFor(f.pid); if (!t) return;
    const av = $('.av', t);
    floatText(av, f.delta === 0 ? 'PUSH' : fmtDelta(f.delta), f.delta < 0 ? 'neg' : f.delta === 0 ? 'zero' : '');
    if (f.delta > 0) { burst(t, ['#f6c744', '#fff3b0', '#b8862a'], 12); mood(av, 'happy'); }
    else if (f.delta < 0) mood(av, 'sad');
    if (f.pid === me.id) {
      if (f.delta > 0) { AU.play(f.label === 'BLACKJACK' ? 'coin' : 'win'); if (f.label !== 'BLACKJACK') showBanner((f.label === 'TAUKE' ? 'UNTUNG ' : 'MENANG ') + fmtDelta(f.delta), 'win'); }
      else if (f.delta < 0) { AU.play('lose'); showBanner((f.label === 'TAUKE' ? 'RUGI ' : 'KALAH ') + f.delta, 'bust'); }
      else { AU.play('click'); showBanner('SERI · PUSH', 'info'); }
    } else if (f.delta > 0) AU.play('coin');
  }

  const bq = []; let bBusy = false;
  function showBanner(text, style) {
    if (bq.length > 3) bq.shift();
    bq.push({ text, style });
    if (!bBusy) nextBanner();
  }
  function nextBanner() {
    const b = bq.shift();
    const box = $('#banner');
    if (!b) { bBusy = false; return; }
    bBusy = true;
    box.innerHTML = '';
    const d = el('div', 'bn ' + (b.style || 'info'));
    d.textContent = b.text;
    box.appendChild(d);
    setTimeout(nextBanner, b.style === 'bj' ? 1500 : 1100);
  }

  function shakeScreen() { const g = $('#game'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); setTimeout(() => g.classList.remove('shake'), 600); }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  function taukePick(f) {
    const s = G.state;
    const p = s.players.find(x => x.id === f.id);
    if (!p) return;
    const cands = (f.candidates || []).map(id => s.players.find(x => x.id === id)).filter(Boolean);
    const label = f.label || 'TAUKE';
    if ((!f.random && f.type !== 'pick') || cands.length < 2) { showBanner(label + ': ' + p.name.toUpperCase(), 'info'); AU.play('tada'); return; }
    G.overlay = 'roulette';
    const ov = $('#overlay');
    ov.classList.remove('hidden');
    ov._kind = 'roulette';
    ov.classList.add('dark');
    if (s.dealer) renderTauke(s, new Set(s.dealer.cards.map(c => c.id)));
    ov.innerHTML = `<div class="roulette"><h2>${esc(f.title || 'SIAPA JADI TAUKE?')}</h2><div class="rl-row">${cands.map(c => `<div class="rl-item" data-id="${esc(c.id)}"><div class="av" style="background-image:url(${SPR.avatarSheet(c.avatar)})"></div><small>${esc(c.name)}</small></div>`).join('')}</div><div class="rl-result"></div></div>`;
    const items = $$('.rl-item', ov);
    const n = items.length, ci = cands.findIndex(c => c.id === f.id);
    const steps = n * (n < 4 ? 4 : 2) + ci + 1;
    let i = 0;
    const go = () => {
      if (!G || G.overlay !== 'roulette') return;
      items.forEach(x => x.classList.remove('on'));
      items[i % n].classList.add('on');
      AU.play('roll');
      i++;
      if (i < steps) { setTimeout(go, 55 + 300 * Math.pow(i / steps, 2.2)); return; }
      const w = items[ci]; w.classList.remove('on'); w.classList.add('win');
      $('.rl-result', ov).textContent = label + ': ' + p.name.toUpperCase() + '!';
      AU.play('tada'); confetti();
      setTimeout(() => { if (G && G.overlay === 'roulette') { closeOverlay(true); if (G.state) { G.ctlKey = ''; onState(G.state); } } }, 1500);
    };
    go();
  }

  // =============== TELUR PONG ===============
  function setPongMode(on) { setView(on ? 'pong' : 'bj'); }
  function setView(v) {
    $('#banner').classList.toggle('low', v !== 'bj' && v !== 'egg');
    $('#table').classList.toggle('hidden', v !== 'bj');
    $('#pongView').classList.toggle('hidden', v !== 'pong');
    $('#kopiView').classList.toggle('hidden', v !== 'kopi');
    $('#tarikView').classList.toggle('hidden', v !== 'tarik');
    $('#duitView').classList.toggle('hidden', v !== 'duit');
    $('#lalatView').classList.toggle('hidden', v !== 'lalat');
    $('#mamakView').classList.toggle('hidden', v !== 'mamak');
    $('#rotiView').classList.toggle('hidden', v !== 'roti');
    $('#lamiView').classList.toggle('hidden', v !== 'lami');
    if (v !== 'lami' && LMV.active) { LMV.active = false; LMV.reset(); }
    if (v === 'lami') LMV.active = true;
    if (RV.visible !== (v === 'roti')) { RV.visible = v === 'roti'; RV.show(RV.visible); }
    if (v !== 'mamak' && MV.active) { MV.active = false; MV.reset(); }
    if (v === 'mamak') MV.active = true;
    if (LV.visible !== (v === 'lalat')) { LV.visible = v === 'lalat'; LV.show(LV.visible); }
    if (v !== 'duit' && DV.active) { DV.active = false; DV.reset(); }
    if (v === 'duit') DV.active = true;
    if (TV.visible !== (v === 'tarik')) { TV.visible = v === 'tarik'; TV.show(TV.visible); }
    $('#orderView').classList.toggle('hidden', v !== 'order');
    $('#eggView').classList.toggle('hidden', v !== 'egg');
    if (EV.visible !== (v === 'egg')) { EV.visible = v === 'egg'; EV.show(EV.visible); }
    if (v !== 'order' && OV.active) { OV.active = false; OV.reset(); }
    if (v === 'order') OV.active = true;
    if (PV.visible !== (v === 'pong')) { PV.visible = v === 'pong'; PV.show(PV.visible); }
    if (KV.visible !== (v === 'kopi')) { KV.visible = v === 'kopi'; KV.show(KV.visible); }
  }

  function renderPongHud(s) {
    const meP = s.players.find(p => p.id === me.id);
    const opp = s.players.find(p => p.id !== me.id);
    const fill = (card, p) => {
      card.dataset.pid = p ? p.id : '';
      card.style.visibility = p ? '' : 'hidden';
      if (!p) return;
      setBg($('.av', card), SPR.avatarSheet(p.avatar));
      setText($('.nm', card), p.name + (p.id === me.id ? ' (you)' : '') + (p.wins ? ' · ' + p.wins + 'W' : '') + (p.connected ? '' : ' · offline'));
      const cups = s.cups && s.cups[p.id];
      setHTML($('.cupsl', card), cups ? cups.map(u => `<img src="${CUP_ICON}" alt=""${u ? '' : ' class="gone"'}>`).join('') : '');
      card.classList.toggle('turn', !!(s.turn && s.turn.pid === p.id && s.phase !== 'over'));
    };
    fill($('#pongView .ph-card.opp'), opp);
    fill($('#pongView .ph-card.mine'), meP);
    const w = s.wind || 0, vw = PV.mySeat() === 0 ? w : -w;
    const n = Math.round(Math.abs(vw) * 3);
    setText($('#pongView .wval'), s.phase === 'lobby' ? '-' : n === 0 ? 'TENANG' : (vw < 0 ? '<'.repeat(n) + ' ' : '') + Math.abs(vw).toFixed(1) + (vw > 0 ? ' ' + '>'.repeat(n) : ''));
    $('#pongView .ph-hint').classList.toggle('hidden', !(s.phase === 'aim' && s.turn && s.turn.pid === me.id));
  }

  function renderPongControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const mine = !!(s.turn && s.turn.pid === me.id);
    const left = s.turn ? s.turn.left : 0;
    const oppP = s.players.find(p => p.id !== me.id);
    const myCups = s.cups && s.cups[me.id] ? s.cups[me.id].filter(Boolean).length : 6;
    const key = ['pong', ph, mine, left, n, host, s.winner, (G.relays || []).join()].join('|');
    let html = '';
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Telur Pong · Players <b>${n}/2</b></div>
           <div class="ctl-row">${n < 2 ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start" ${n < 2 ? 'disabled' : ''}>START!<small>${n < 2 ? 'Tunggu kawan...' : 'Mula main'}</small></button></div>
           <div class="ctl-hint">${n < 2 ? 'Share code ' + esc(s.code || '') + ' to a friend · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Telur Pong · waiting for host to <b>START</b></div><div class="ctl-hint">Swipe up to throw eggs into kopi cups!</div>`;
    } else if (ph === 'coin') {
      html = '<div class="ctl-info">Lambung syiling... who throws first?</div>';
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      const st = id => s.stats && s.stats[id] ? s.stats[id].hits + '/' + s.stats[id].throws : '-';
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> MENANG! · You ${st(me.id)} · ${esc(oppP ? oppP.name : '')} ${st(oppP && oppP.id)}</div>` +
        (host ? '<div class="ctl-row"><button class="btn red big" data-act="newGame">REMATCH!<small>Lawan lagi</small></button></div>' : '<div class="ctl-hint">Waiting host for rematch...</div>');
    } else if (mine) {
      const eggs = Array.from({ length: left }, () => `<img src="${EGG_ICON}" alt="" style="width:21px;height:24px;vertical-align:-5px">`).join(' ');
      html = `<div class="ctl-info">GILIRAN KAU! ${eggs}</div><div class="ctl-hint">Swipe up on the table · longer = further · tilt to aim · watch the ANGIN</div>`;
    } else {
      html = `<div class="ctl-info"><b>${esc(oppP ? oppP.name : '...')}</b> is aiming at your cups...</div><div class="ctl-hint">Your cups left: ${myCups} · cheer with the chat button</div>`;
    }
    setCtl(box, key, html);
  }

  function floatAt(x, y, text, cls) {
    const d = el('div', 'float ' + (cls || ''));
    d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px';
    $('#fxLayer').appendChild(d);
    const a = d.animate([
      { transform: 'translate(-50%, 10px) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -12px) scale(1.4)', opacity: 1, offset: 0.15 },
      { transform: 'translate(-50%, -24px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -54px) scale(1)', opacity: 0 },
    ], { duration: 1600, easing: 'steps(14)', fill: 'forwards' });
    a.onfinish = () => d.remove();
  }

  function pongFx(f) {
    PV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); if (f.style === 'bj') AU.play('bj'); break;
      case 'pick': taukePick(f); break;
      case 'turn':
        if (f.pid === me.id) { AU.play('turn'); showBanner('GILIRAN KAU!', 'info'); vibrate(80); }
        break;
      case 'land': {
        if (f.outcome === 'hit' && f.pos) {
          const p = PV.screenOf(f.pos[0], f.pos[1], PONG.C.cupH);
          floatAt(p.x, p.y - 10, 'MASUK!', '');
          if (f.cup && f.cup.pid === me.id) { shakeScreen(); vibrate([40, 30, 60]); }
          else if (f.pid === me.id) vibrate(60);
        } else if (f.outcome === 'splat' && f.pos) {
          const p = PV.screenOf(f.pos[0], f.pos[1], 0);
          floatAt(p.x, p.y - 6, 'PECAH!', 'neg');
        } else if (f.outcome === 'floor') {
          const r = UIZ.rect($('#pongCanvas'));
          floatAt(r.left + r.width / 2, r.top + r.height * 0.5, 'JATUH LANTAI!', 'neg');
        } else if (f.outcome === 'drop') {
          const r = UIZ.rect($('#pongCanvas'));
          floatAt(r.left + r.width / 2, r.top + r.height * 0.7, 'TERLEPAS!', 'neg');
        }
        break;
      }
      case 'gameover':
        confetti(); AU.play(f.winner === me.id ? 'tada' : 'lose');
        break;
    }
  }

  function showPongResult() {
    const s = G && G.state; if (!s || s.phase !== 'over') return;
    const w = s.players.find(p => p.id === s.winner), l = s.players.find(p => p.id !== s.winner);
    const st = p => p && s.stats[p.id] ? s.stats[p.id].hits + ' / ' + s.stats[p.id].throws + ' masuk' : '';
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${st(p)}</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>JUARA TELUR PONG · ${esc(w ? w.name : '')}!</h2>
      <div class="podium">${pd(l, 1)}${pd(w, 0)}</div>
      <p style="text-align:center">Score so far: ${s.players.map(p => esc(p.name) + ' ' + (p.wins || 0)).join(' · ')}</p>
      <div class="row"><button class="btn" data-h="close">CLOSE</button>${G.isHost ? '<button class="btn red" data-h="newGame">REMATCH</button>' : ''}</div></div>`, 'podium');
    confetti();
  }

  // =============== CARI TELUR ===============
  function renderEggHud(s) {
    const top = $('#eggView .eg-top');
    const ids = s.players.filter(p => s.phase === 'lobby' || p.inGame).map(p => p.id);
    const res = s.phase === 'reveal' && s.result ? s.result.gains : null;
    setHTML($('.oq', top), ids.map(id => { const p = s.players.find(x => x.id === id); const picked = (s.picked || []).includes(id);
      const sub = s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : res ? (res[id] ? '+' + res[id] : 'KOSONG') : s.phase === 'pick' ? (picked ? 'PICKED' : '...') : p.score + ' PTS';
      return `<div class="kp-card${s.phase === 'pick' && picked ? ' turn' : ''}${id === me.id ? ' me' : ''}" data-pid="${esc(id)}"><div class="ph-box"><span class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></span><b class="nm">${esc(p.name)}</b><small>${sub}</small></div><div class="bubble"></div></div>`; }).join(''));
    setText($('.o-level', top), s.phase === 'lobby' ? 'CARI TELUR' : s.phase === 'over' ? 'HABIS!' : 'LEVEL ' + s.level + '/' + s.levels);
    setText($('.o-who', top), s.phase === 'lobby' ? 'Follow the egg!' : s.script ? s.script.n + ' mangkuk' : '');
  }
  function renderEggControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const picked = (s.picked || []).includes(me.id), inGame = meP && meP.inGame;
    const key = ['egg', ph, s.level, picked, n, host, (G.relays || []).join()].join('|');
    let html = '';
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Cari Telur · Players <b>${n}/6</b></div>
           <div class="ctl-row"><button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Mula main'}</small></button></div>
           <div class="ctl-hint">${n < 6 ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Cari Telur · waiting for host to <b>START</b></div><div class="ctl-hint">Follow the egg under the bowls!</div>`;
    } else if (ph === 'place') html = '<div class="ctl-info"><b>Tengok baik-baik!</b> Telur masuk mangkuk...</div>';
    else if (ph === 'shuffle') html = '<div class="ctl-info"><b>Ikut mangkuk telur!</b> Jangan kelip mata...</div>';
    else if (ph === 'pick') html = !inGame ? '<div class="ctl-info">Next game you can join in!</div>' : picked ? `<div class="ctl-info">Picked! Waiting others <b>${(s.picked || []).length}/${s.players.filter(p => p.inGame && p.connected).length}</b></div>` : '<div class="ctl-info"><b>Tap the bowl</b> with the egg!</div><div class="ctl-hint">Faster pick = more bonus</div>';
    else if (ph === 'reveal') {
      const g = s.result && s.result.gains[me.id];
      html = `<div class="ctl-info">${g ? '<b>JUMPA!</b> +' + g : inGame ? '<b>Kosong lah!</b> +0' : 'Reveal!'} · You: <b>${meP ? meP.score : 0}</b> pts</div>` + (host ? '<div class="ctl-row"><button class="btn big" data-act="next">NEXT<small>Level seterusnya</small></button></div>' : '');
    } else if (ph === 'over') {
      const w = s.ranking && s.ranking[0];
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '')}</b> menang · ${w ? w.score : 0} pts</div>
        <div class="ctl-row">${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="results">RESULTS</button><button class="btn big" data-act="menu">MAIN MENU</button></div>`;
    }
    setCtl(box, key, html);
  }
  function eggFx(f) {
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'picked': if (f.pid !== me.id) AU.play('tick'); break;
      case 'reveal': {
        const g = G.state && G.state.result && G.state.result.gains[me.id];
        AU.play(g ? 'win' : 'lose');
        if (g) { showBanner('JUMPA! +' + g, 'win'); vibrate(60); } else if (EV.myPick() != null) showBanner('KOSONG LAH!', 'bust');
        break;
      }
      case 'gameover': confetti(); AU.play('tada'); break;
    }
  }
  function showEggResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>RAJA TELUR · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — found <b>${p.correct}/${s.levels}</b> eggs · ${p.score} pts</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== INGAT ORDER ===============
  function renderOrderControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase, mine = s.cur === me.id;
    const cur = s.players.find(p => p.id === s.cur);
    const key = ['order', ph, mine, s.script && s.script.id, n, host, (G.relays || []).join()].join('|');
    let html = '';
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Ingat Order · Waiters <b>${n}/6</b></div>
           <div class="ctl-row"><button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Buka kedai'}</small></button></div>
           <div class="ctl-hint">${n < 6 ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Ingat Order · waiting for host to <b>START</b></div><div class="ctl-hint">Remember what every customer orders!</div>`;
    } else if (ph === 'show') {
      html = mine ? '<div class="ctl-info"><b>Dengar baik-baik!</b> Remember every order...</div><div class="ctl-hint">The tablet opens when they finish talking</div>'
        : `<div class="ctl-info"><b>${esc(cur ? cur.name : '')}</b> is taking the order...</div><div class="ctl-hint">Shh... let them listen</div>`;
    } else if (ph === 'answer') {
      html = mine ? '<div class="ctl-row"><button class="btn green big" data-act="submitOrder">HANTAR ORDER<small>Send to the kitchen</small></button></div>'
        : `<div class="ctl-info"><b>${esc(cur ? cur.name : '')}</b> is keying in the order...</div><div class="ctl-hint">Did you remember it? Haha</div>`;
    } else if (ph === 'reveal') {
      const r = s.result || {};
      html = `<div class="ctl-info">${esc(cur ? cur.name : '')}: <b>${r.correct || 0}/${r.total || 0}</b> betul · <b>+${r.pts || 0}</b>${r.perfect ? ' · PERFECT!' : ''}</div>` +
        (mine || host ? '<div class="ctl-row"><button class="btn big" data-act="next">NEXT<small>Meja seterusnya</small></button></div>' : '<div class="ctl-hint">Next table coming...</div>');
    } else if (ph === 'over') {
      const w = s.ranking && s.ranking[0];
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '')}</b> best waiter · ${w ? w.score : 0} pts</div>
        <div class="ctl-row">${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="results">RESULTS</button><button class="btn big" data-act="menu">MAIN MENU</button></div>`;
    }
    setCtl(box, key, html);
  }
  function orderFx(f) {
    OV.fx(f);
    switch (f.type) {
      case 'say': if (f.cust) OV.custSay(f.text); else bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'show': if (f.pid === me.id) { AU.play('turn'); showBanner('GILIRAN KAU!', 'info'); vibrate(80); } break;
      case 'answer': if (f.pid === me.id) { AU.play('tada'); vibrate(60); } break;
      case 'reveal': if (f.perfect) { confetti(); showBanner('PERFECT!', 'bj'); } break;
      case 'gameover': confetti(); AU.play('tada'); break;
    }
  }
  function showOrderResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>BEST WAITER · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.perfect}/${p.tables}</b> tables perfect · ${p.score} pts</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== LAMI ===============
  function renderLamiControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const mine = ph === 'turn' && s.cur === me.id;
    const pm = mine ? LMV.pickMeld() : null;
    const key = ['lami', ph, s.cur, s.hand, n, host, s.winner, s.acted, !!pm, LMV.picked(), (G.relays || []).join()].join('|');
    let html = '';
    const hd = `Hand <b>${Math.max(1, Math.min(s.hand, s.hands))}/${s.hands}</b>`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Lami · Players <b>${n}/${LAMI.MAX}</b></div>
           <div class="ctl-row">${n < LAMI.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start"${n < LAMI.MIN ? ' disabled' : ''}>START!<small>${n < LAMI.MIN ? 'Need 2+ (add a bot)' : 'Bahagi kad'}</small></button></div>
           <div class="ctl-hint">${n < LAMI.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Lami · waiting for host to <b>START</b></div><div class="ctl-hint">Meld or lay off every turn — or MATI!</div>`;
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> Raja Lami!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (mine) {
      const port = meP && meP.passport;
      html = `<div class="ctl-info">${hd} · <b>Giliran kau!</b> ${!port ? 'Buka passport: a same-suit run' : s.acted ? 'Main lagi, or habis giliran' : 'Must meld or lay off'}</div>
        <div class="ctl-row"><button class="btn green big" data-act="lmMeld"${pm ? '' : ' disabled'}>MELD<small>${pm ? (pm.type === 'run' ? 'Run' : 'Set') + ' baru' : 'Pick 3+ cards'}</small></button><button class="btn red big" data-act="lmEnd"${s.acted ? '' : ' disabled'}>HABIS<small>End turn</small></button></div>`;
    } else if (ph === 'result') {
      html = `<div class="ctl-info">${hd} habis!</div>${host ? '<div class="ctl-row"><button class="btn big" data-act="mjNext">NEXT HAND</button></div>' : '<div class="ctl-hint">Next hand starting...</div>'}`;
    } else {
      html = `<div class="ctl-info">${hd} · ${ph === 'deal' ? 'Bahagi kad...' : '<b>' + esc(nameOf(s.cur)) + '</b> punya giliran'}</div><div class="ctl-hint">${meP && !s.seats.includes(me.id) ? 'You join next game — tengok je' : meP && meP.dead ? 'Kau dah MATI — tunggu hand habis' : 'A 15 · 10/J/Q/K 10 · 2–9 face · Joker 20 — lowest wins'}</div>`;
    }
    setCtl(box, key, html);
  }

  function lamiFx(f) {
    LMV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'turn': if (f.pid === me.id) { AU.play('turn'); vibrate(60); } break;
      case 'dead': mood(avatarOf(f.pid), 'sad'); if (f.pid === me.id) { showBanner(f.noPort ? 'TAKDE PASSPORT · MATI' : 'MATI!', 'bust'); shakeScreen(); } break;
      case 'nope': if (f.pid === me.id) toast(f.why === 'port' ? 'Passport must be a same-suit run of 3+' : f.why === 'swap' ? 'That card does not match the joker' : 'Not a valid meld'); break;
      case 'game': confetti(); mood(avatarOf(f.pid), 'happy'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showLamiResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.total} pts</div><div class="blk">${i + 1}</div></div>` : '';
    const title = ['RAJA', 'XIAO GE', 'ER GE', 'DA GE'];
    showOverlay(`<div class="modal"><h2>RAJA LAMI · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.total}</b> pts${i ? ' · ' + (i === r.length - 1 ? 'DA GE' : title[i]) : ''}${p.games ? ' · best hand ' + p.games + '×' : ''}</p>`).join('')}
      <p><small>Lowest points wins</small></p>
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== ROTI FLIP ===============
  function renderRotiControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const d = RV.state();
    const dst = d ? d.st : '';
    const key = ['roti', ph, s.rnd, n, host, s.winner, dst, (G.relays || []).join()].join('|');
    let html = '';
    const rnd = `Round <b>${Math.max(1, Math.min(s.rnd, s.rounds))}/${s.rounds}</b>${s.telur ? ' · <b>ROTI TELUR x2</b>' : ''}`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Roti Flip · Players <b>${n}/${ROTI.MAX}</b></div>
           <div class="ctl-row">${n < ROTI.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Tebar roti!'}</small></button></div>
           <div class="ctl-hint">${n < ROTI.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Roti Flip · waiting for host to <b>START</b></div><div class="ctl-hint">Tap to flip, tap as it lands. LETAK before it koyak!</div>`;
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> Raja Roti!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (ph === 'play' && meP && meP.inGame && (dst === 'ball' || dst === 'air')) {
      html = `<div class="ctl-info">${rnd}</div>
        <div class="ctl-row"><button class="btn green big" data-act="rtLetak"${dst === 'air' ? ' disabled' : ''}>LETAK!<small>Masuk tawa, simpan point</small></button></div>
        <div class="ctl-hint">Tap the dough to flip · tap again when the ring turns green${matchMedia('(pointer:fine)').matches ? ' · Space = flip · Enter = letak' : ''}</div>`;
    } else if (ph === 'play') {
      html = `<div class="ctl-info">${rnd} · ${dst === 'koyak' ? '<b>KOYAK!</b> Tengok orang lain...' : dst === 'banked' ? '<b>Dah letak!</b> Tunggu yang lain...' : 'Tengok je'}</div>`;
    } else if (ph === 'break') {
      const best = s.players.filter(p => p.inGame && s.dough && s.dough[p.id]).sort((a, b) => s.dough[b.id].pts - s.dough[a.id].pts)[0];
      html = `<div class="ctl-info">${rnd} habis! ${best && s.dough[best.id].pts ? '<b>' + esc(best.name) + '</b> roti paling besar · ' + s.dough[best.id].pts : 'Semua koyak!'}</div>`;
    } else html = `<div class="ctl-info">${rnd} · <b>Siap sedia...</b></div><div class="ctl-hint">${s.telur ? 'Telur round: double points, but a koyak is messy!' : 'Bigger roti = more points'}</div>`;
    setCtl(box, key, html);
  }

  function rotiFx(f) {
    RV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'koyak': if (f.pid === me.id) shakeScreen(); mood(avatarOf(f.pid), 'sad'); break;
      case 'letak': if (f.tisu) mood(avatarOf(f.pid), 'happy'); break;
      case 'roundEnd': AU.play('win'); if (f.best) mood(avatarOf(f.best), 'happy'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showRotiResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>RAJA ROTI · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.score}</b> pts · ${p.rounds.map(x => x || '<s>koyak</s>').join(' / ')}${p.tisu ? ' · tisu ' + p.tisu + '×' : ''}</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== MAMAK MAHJONG ===============
  function renderMamakControls(s, meP, pv) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const mine = ph === 'turn' && s.cur === me.id;
    const cl = ph === 'claim' && pv && pv.claim;
    const key = ['mamak', ph, s.cur, s.hand, n, host, s.winner, mine && pv && pv.canWin, cl ? JSON.stringify(pv.claim) : '', (G.relays || []).join()].join('|');
    let html = '';
    const hd = `Hand <b>${Math.max(1, Math.min(s.hand, s.hands))}/${s.hands}</b>`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Mamak Mahjong · Players <b>${n}/${MAMAK.MAX}</b></div>
           <div class="ctl-row">${n < MAMAK.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start"${n < MAMAK.MIN ? ' disabled' : ''}>START!<small>${n < MAMAK.MIN ? 'Need 2+ (add a bot)' : 'Kocok tile'}</small></button></div>
           <div class="ctl-hint">${n < MAMAK.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Mamak Mahjong · waiting for host to <b>START</b></div><div class="ctl-hint">2 sets of three + 1 pair = MAKAN!</div>`;
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> Raja Mamak!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (mine) {
      html = `<div class="ctl-info">${hd} · <b>Giliran kau!</b> ${pv && pv.canWin ? 'Tiles cukup — MAKAN!' : 'Pilih satu tile untuk buang'}</div>
        <div class="ctl-row">${pv && pv.canWin ? '<button class="btn green big" data-act="mjWin">MAKAN!<small>Menang hand ni</small></button>' : ''}<button class="btn red big" data-act="mjDiscard">BUANG<small>Tap tile, then here</small></button></div>`;
    } else if (cl) {
      const last = s.last;
      html = `<div class="ctl-info"><b>${esc(nameOf(last.by))}</b> buang ${MAMAK.KINDS[last.k].label} — nak ambil?</div>
        <div class="ctl-row">${pv.claim.makan ? '<button class="btn green big" data-act="mjMakan">MAKAN!<small>Menang dengan tile ni</small></button>' : ''}${pv.claim.chop ? '<button class="btn red big" data-act="mjChop">CHOP!<small>Buat set terbuka</small></button>' : ''}<button class="btn big" data-act="mjPass">LEPAS<small>Tak nak</small></button></div>`;
    } else if (ph === 'claim') {
      html = `<div class="ctl-info">${hd} · tunggu orang lain decide...</div>`;
    } else if (ph === 'result') {
      html = `<div class="ctl-info">${hd} habis!</div>${host ? '<div class="ctl-row"><button class="btn big" data-act="mjNext">NEXT HAND</button></div>' : '<div class="ctl-hint">Next hand starting...</div>'}`;
    } else {
      html = `<div class="ctl-info">${hd} · ${ph === 'deal' ? 'Kocok tile...' : '<b>' + esc(nameOf(s.cur)) + '</b> punya giliran'}</div><div class="ctl-hint">${meP && !s.seats.includes(me.id) ? 'You join next game — tengok je' : '2 sets of three + 1 pair = MAKAN!'}</div>`;
    }
    setCtl(box, key, html);
  }

  function mamakFx(f) {
    MV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'draw': if (f.pid === me.id) vibrate(30); break;
      case 'makan': confetti(); mood(avatarOf(f.pid), 'happy'); if (f.from) mood(avatarOf(f.from), 'sad'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showMamakResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>RAJA MAMAK · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.score}</b> pts</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== LALAT HUNT ===============
  function renderLalatControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const key = ['lalat', ph, s.rnd, n, host, s.winner, (G.relays || []).join()].join('|');
    let html = '';
    const rnd = `Round <b>${Math.max(1, Math.min(s.rnd, s.rounds))}/${s.rounds}</b>`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Lalat Hunt · Players <b>${n}/${LALAT.MAX}</b></div>
           <div class="ctl-row">${n < LALAT.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Pap pap pap'}</small></button></div>
           <div class="ctl-hint">${n < LALAT.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Lalat Hunt · waiting for host to <b>START</b></div><div class="ctl-hint">Swat the flies. Jangan kena pinggan!</div>`;
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> Raja Lalat!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (ph === 'break') {
      const best = s.players.filter(p => p.inGame).sort((a, b) => (b.roundKills || 0) - (a.roundKills || 0))[0];
      html = `<div class="ctl-info">${rnd} habis! ${best && best.roundKills ? '<b>' + esc(best.name) + '</b> pap ' + best.roundKills + ' lalat' : 'Lalat menang round ni...'}</div>`;
    } else if (ph === 'ready') {
      html = `<div class="ctl-info">${rnd} · <b>Siap sedia...</b></div><div class="ctl-hint">${s.rnd === 3 ? 'SWARM!' : s.rnd === 2 ? 'More lalat, plates moved' : 'Tap the flies — flying or landed'}</div>`;
    } else {
      html = `<div class="ctl-info">${rnd} · <b>Pap!</b> Tap the lalat</div><div class="ctl-hint">${meP && !meP.inGame ? 'You join next game — tengok je' : 'Lalat +10 · langau hijau +25 · emas +50 · pinggan/cawan −15'}</div>`;
    }
    setCtl(box, key, html);
  }

  function lalatFx(f) {
    LV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'oops': if (f.pid === me.id) { shakeScreen(); vibrate(60); } mood(avatarOf(f.pid), 'sad'); break;
      case 'kill': if (f.pid === me.id) vibrate(25); break;
      case 'roundEnd': AU.play('win'); if (f.best) mood(avatarOf(f.best), 'happy'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showLalatResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>RAJA LALAT · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.score}</b> pts · ${p.kills} lalat${p.oops ? ' · oops ' + p.oops + '×' : ''}</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== KIRA DUIT ===============
  function renderDuitControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const key = ['duit', ph, s.rnd, n, host, s.winner, (G.relays || []).join()].join('|');
    let html = '';
    const rnd = `Customer <b>${Math.max(1, Math.min(s.rnd, s.rounds))}/${s.rounds}</b>`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Kira Duit · Cashiers <b>${n}/${DUIT.MAX}</b></div>
           <div class="ctl-row">${n < DUIT.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Buka kaunter'}</small></button></div>
           <div class="ctl-hint">${n < DUIT.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Kira Duit · waiting for host to <b>START</b></div><div class="ctl-hint">Bagi baki betul, paling laju menang!</div>`;
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> juruwang terbaik!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (ph === 'reveal') {
      html = `<div class="ctl-info">${rnd} · next customer coming...</div>`;
    } else if (ph === 'count') {
      html = `<div class="ctl-info">${rnd} · <b>Kira baki!</b> Tap duit, then BAGI BAKI</div><div class="ctl-hint">${meP && !meP.inGame ? 'You join next game — tengok je' : 'Fastest right baki scores most · fewest pieces +10'}</div>`;
    } else html = `<div class="ctl-info">${rnd} · next customer...</div>`;
    setCtl(box, key, html);
  }

  function duitFx(f) {
    DV.fx(f);
    switch (f.type) {
      case 'say': if (!f.cust) bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'gave': if (f.pid !== me.id) AU.play('tick'); break;
      case 'reveal': if (f.first && f.first === me.id) { showBanner('PALING LAJU!', 'win'); vibrate(60); } else if (G.state && G.state.gave && G.state.gave[me.id] && !(G.state.results || []).some(r => r.id === me.id && r.ok)) shakeScreen(); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showDuitResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.score} pts</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>JURUWANG TERBAIK · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.score}</b> pts · betul ${p.right}/${s.rounds}${p.fastest ? ' · paling laju ' + p.fastest + '×' : ''}</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== TARIK TEH ===============
  function renderTarikHud(s, sel) {
    const box = $(sel || '#tarikView .kq');
    const ids = s.order && s.order.length && s.phase !== 'lobby' ? s.order.concat(s.players.map(p => p.id).filter(id => !s.order.includes(id))) : s.players.map(p => p.id);
    const have = new Map($$('.kp-card', box).map(c => [c.dataset.pid, c]));
    ids.forEach((id, i) => {
      const p = s.players.find(x => x.id === id); if (!p) return;
      let c = have.get(id);
      if (!c) { c = el('div', 'kp-card', '<div class="ph-box"><span class="av"></span><b class="nm"></b><small></small></div><div class="bubble"></div>'); c.dataset.pid = id; }
      have.delete(id);
      if (box.children[i] !== c) box.insertBefore(c, box.children[i] || null);
      setBg($('.av', c), SPR.avatarSheet(p.avatar));
      setText($('.nm', c), p.name);
      const turn = s.game === 'duit' ? !!(s.phase === 'count' && s.gave && s.gave[id]) : (s.phase === 'tarik' || s.phase === 'result') && s.turn && s.turn.pid === id;
      if (s.game === 'lalat') $('small', c).style.color = p.col;
      if (s.game === 'lami') {
        const turn = s.phase === 'turn' && s.cur === id;
        setText($('small', c), s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : !s.seats.includes(id) ? 'NEXT' : p.dead ? 'MATI' : turn ? 'MAIN!' : s.phase === 'over' ? p.total + ' PTS' : p.count + ' KAD');
        c.classList.toggle('turn', !!turn);
        c.classList.toggle('out', !!(p.dead && s.phase !== 'lobby' && s.phase !== 'over'));
        c.classList.toggle('me', id === me.id);
        return;
      }
      if (s.game === 'roti') {
        const dd = s.dough && s.dough[id];
        setText($('small', c), s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : !p.inGame ? 'NEXT' : s.phase === 'play' && dd ? (dd.st === 'banked' ? 'LETAK ' + dd.pts : dd.st === 'koyak' ? 'KOYAK!' : dd.n + ' FLIP') : p.score + ' PTS');
        c.classList.toggle('turn', !!(s.phase === 'play' && dd && dd.st === 'banked'));
        c.classList.toggle('out', !!(s.phase === 'play' && dd && dd.st === 'koyak'));
        c.classList.toggle('me', id === me.id);
        return;
      }
      if (s.game === 'mamak') {
        const sub = s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : !s.seats.includes(id) ? 'NEXT' : !p.connected ? 'AUTO' : s.phase === 'turn' && s.cur === id ? 'MAIN!' : p.score + ' PTS';
        setText($('small', c), sub);
        c.classList.toggle('turn', s.phase === 'turn' && s.cur === id);
        c.classList.toggle('out', false);
        c.classList.toggle('me', id === me.id);
        return;
      }
      const sub = s.game === 'lalat' ? (s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : 'READY') : !p.inGame ? 'NEXT' : !p.connected ? 'OFF' : p.score + ' PTS')
        : s.game === 'duit'
        ? (s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : !p.inGame ? 'NEXT' : !p.connected ? 'OFF' : s.phase === 'count' ? (s.gave && s.gave[id] ? 'DAH BAGI' : 'KIRA...') : p.score + ' PTS')
        : s.phase === 'lobby' ? (p.wins ? p.wins + ' WIN' : '') : !p.inGame ? 'NEXT' : s.phase === 'tarik' && turn ? 'TARIK!' : !p.connected ? 'OFF' : p.total + ' BUIH';
      setText($('small', c), sub);
      c.classList.toggle('turn', !!turn);
      c.classList.toggle('out', s.phase !== 'lobby' && !p.inGame);
      c.classList.toggle('me', id === me.id);
    });
    for (const c of have.values()) c.remove();
  }

  function renderTarikControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const mine = !!(s.turn && s.turn.pid === me.id) && ph === 'tarik';
    const key = ['tarik', ph, mine, s.turn && s.turn.id, s.rnd, n, host, s.winner, (G.relays || []).join()].join('|');
    let html = '';
    const rnd = `Round <b>${Math.min(s.rnd, s.rounds)}/${s.rounds}</b>`;
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Tarik Teh · Players <b>${n}/${TARIK.MAX}</b></div>
           <div class="ctl-row">${n < TARIK.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start">START!<small>${n < 2 ? 'Main sorang pun boleh' : 'Mula main'}</small></button></div>
           <div class="ctl-hint">${n < TARIK.MAX ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Tarik Teh · waiting for host to <b>START</b></div><div class="ctl-hint">Tarik tinggi for more buih. Jangan tumpah!</div>`;
    } else if (ph === 'pick') {
      html = '<div class="ctl-info">Siapa tarik dulu...?</div>';
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> Raja Teh Tarik!</div>
        <div class="ctl-row"><button class="btn big" data-act="results">RESULTS</button>${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (mine) {
      html = `<div class="ctl-info" id="tarikMsg">${rnd} · <b>Your tarik!</b></div>
        <div class="ctl-hint">Hold on the mugs to pour · slide left/right to catch the teh · let go to stop${matchMedia('(pointer:fine)').matches ? ' · or Space + ← →' : ''}</div>`;
    } else if (ph === 'result' && s.last) {
      const l = s.players.find(p => p.id === s.last.pid);
      html = `<div class="ctl-info">${rnd} · <b>${esc(l ? l.name : '')}</b> ${s.last.tumpah ? 'TUMPAH! 0 buih' : s.last.why ? '0 buih' : '+' + s.last.pts + ' buih' + (s.last.perfect ? ' · SEMPURNA!' : '')}</div>`;
    } else {
      const who = s.turn ? nameOf(s.turn.pid) : '...';
      html = `<div class="ctl-info">${rnd} · <b>${esc(who)}</b> tarik teh...</div><div class="ctl-hint">${meP && !meP.inGame ? 'You join next game — tengok je' : 'Higher = more buih, but harder to catch!'}</div>`;
    }
    setCtl(box, key, html);
  }

  function tarikFx(f) {
    TV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'pick': taukePick(f); break;
      case 'turn': if (f.pid === me.id) { AU.play('turn'); showBanner('GILIRAN KAU!', 'info'); vibrate(80); } break;
      case 'tumpah': shakeScreen(); if (f.pid === me.id) vibrate([80, 40, 120]); mood(avatarOf(f.pid), 'sad'); break;
      case 'score': if (f.pts >= 80) mood(avatarOf(f.pid), 'happy'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showTarikResult() {
    const s = G && G.state; if (!s || s.phase !== 'over' || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.total} buih</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>RAJA TEH TARIK · ${esc(r[0] ? r[0].name : '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.map((p, i) => `<p>${i + 1}. ${esc(p.name)} — <b>${p.total}</b> buih · ${p.pulls.map(x => x || '<s>0</s>').join(' / ')}${p.tumpah ? ' · tumpah ' + p.tumpah + '×' : ''}</p>`).join('')}
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== KOPI TUMPAH ===============
  function renderKopiHud(s) {
    const box = $('#kopiView .kq');
    const ids = s.order && s.order.length && s.phase !== 'lobby' ? s.order.concat(s.players.map(p => p.id).filter(id => !s.order.includes(id))) : s.players.map(p => p.id);
    const have = new Map($$('.kp-card', box).map(c => [c.dataset.pid, c]));
    ids.forEach((id, i) => {
      const p = s.players.find(x => x.id === id); if (!p) return;
      let c = have.get(id);
      if (!c) { c = el('div', 'kp-card', '<div class="ph-box"><span class="av"></span><b class="nm"></b><small></small></div><div class="bubble"></div>'); c.dataset.pid = id; }
      have.delete(id);
      if (box.children[i] !== c) box.insertBefore(c, box.children[i] || null);
      setBg($('.av', c), SPR.avatarSheet(p.avatar));
      setText($('.nm', c), p.name);
      const turn = s.phase === 'pour' && s.turn && s.turn.pid === id;
      setText($('small', c), p.out && s.phase !== 'lobby' ? (s.loser === id ? 'TUMPAH' : 'OUT') : turn ? 'TUANG' : !p.connected ? 'OFF' : p.wins ? p.wins + ' WIN' : '');
      c.classList.toggle('turn', !!turn);
      c.classList.toggle('out', !!p.out && s.phase !== 'lobby');
      c.classList.toggle('me', id === me.id);
    });
    for (const c of have.values()) c.remove();
  }

  function renderKopiControls(s, meP) {
    const box = $('#controls');
    const host = s.hostId === me.id, n = s.players.length, ph = s.phase;
    const mine = !!(s.turn && s.turn.pid === me.id) && ph === 'pour';
    const key = ['kopi', ph, mine, s.turn && s.turn.id, n, host, s.winner, meP && meP.out, (G.relays || []).join()].join('|');
    let html = '';
    if (ph === 'lobby') {
      html = host
        ? `<div class="ctl-info">Kopi Tumpah · Players <b>${n}/${KOPI.MAX}</b></div>
           <div class="ctl-row">${n < KOPI.MAX ? '<button class="btn fixed" data-act="addBot">+ BOT</button>' : ''}
           <button class="btn red big" data-act="start" ${n < 2 ? 'disabled' : ''}>START!<small>${n < 2 ? 'Tunggu kawan...' : 'Mula main'}</small></button></div>
           <div class="ctl-hint">${n < 2 ? 'Share code ' + esc(s.code || '') + ' · ' : ''}${G.relays && G.relays.length ? 'Online via ' + esc(G.relays.join(' · ')) : OFFLINE ? 'Offline test' : 'Going online...'} · ${VERSION}</div>`
        : `<div class="ctl-info">Kopi Tumpah · waiting for host to <b>START</b></div><div class="ctl-hint">Pour kopi in turns. Don't be the one who tumpah!</div>`;
    } else if (ph === 'pick') {
      html = '<div class="ctl-info">Siapa tuang dulu...?</div>';
    } else if (ph === 'over') {
      const w = s.players.find(p => p.id === s.winner);
      html = `<div class="ctl-info"><b>${esc(w ? w.name : '?')}</b> MENANG! Semua lain belanja kopi.</div>
        <div class="ctl-row">${host ? '<button class="btn red big" data-act="newGame">MAIN LAGI<small>Restart</small></button>' : ''}<button class="btn big" data-act="menu">MAIN MENU<small>${host ? 'Close table' : 'Leave table'}</small></button></div>`;
    } else if (mine) {
      html = `<div class="ctl-info" id="kopiMsg">Your turn — <b>even one drop</b> counts!</div>
        <div class="ctl-row"><button class="btn green big hold" data-hold="1">TUANG!<small>Tekan &amp; tahan · hold to pour</small></button></div>`;
    } else if (ph === 'spill') {
      const l = s.players.find(p => p.id === s.loser);
      html = `<div class="ctl-info"><b>${esc(l ? l.name : '')}</b> TUMPAH! Belanja kopi!</div>`;
    } else {
      const who = s.turn ? nameOf(s.turn.pid) : '...';
      html = `<div class="ctl-info"><b>${esc(who)}</b> is pouring...</div><div class="ctl-hint">${meP && meP.out ? 'You are out this game — tengok je' : 'Your turn soon. Steady hand!'}</div>`;
    }
    setCtl(box, key, html);
  }

  function kopiFx(f) {
    KV.fx(f);
    switch (f.type) {
      case 'say': bubble(f.pid, f.text, f.mood); break;
      case 'emote': bubble(f.pid, f.text, 'emote'); AU.play('pop'); break;
      case 'banner': showBanner(f.text, f.style); break;
      case 'pick': taukePick(f); break;
      case 'turn': if (f.pid === me.id) { AU.play('turn'); showBanner('GILIRAN KAU!', 'info'); vibrate(80); } break;
      case 'spill': shakeScreen(); if (f.pid === me.id) vibrate([80, 40, 120]); mood(avatarOf(f.pid), 'sad'); break;
      case 'gameover': confetti(); AU.play(f.winner === me.id ? 'tada' : 'win'); break;
    }
  }

  function showKopiResult() {
    const s = G && G.state; if (!s || s.phase !== 'over') return;
    const w = s.players.find(p => p.id === s.winner);
    const others = s.players.filter(p => p.id !== s.winner);
    showOverlay(`<div class="modal"><h2>JUARA KOPI TUMPAH · ${esc(w ? w.name : '')}!</h2>
      <div class="podium">${w ? `<div class="pd p1"><div class="av" style="background-image:url(${SPR.avatarSheet(w.avatar)})"></div><div class="nm">${esc(w.name)}</div><div class="ch">${w.wins} WIN</div><div class="blk">1</div></div>` : ''}</div>
      <p style="text-align:center">Belanja kopi: ${others.map(p => esc(p.name)).join(', ') || '-'}</p>
      <div class="row">${G.isHost ? '<button class="btn red" data-h="newGame">MAIN LAGI</button>' : ''}<button class="btn" data-h="menu">MAIN MENU</button><button class="btn" data-h="close">CLOSE</button></div></div>`, 'podium');
    confetti();
  }

  // =============== OVERLAYS ===============
  function showOverlay(html, kind) {
    if (G) G.overlay = kind || 'modal';
    const ov = $('#overlay');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
    ov._kind = kind || 'modal';
  }
  function closeOverlay(force) {
    const ov = $('#overlay');
    if (!force && ov._kind === 'roulette' && G && G.overlay === 'roulette') return;
    ov.classList.add('hidden'); ov.classList.remove('dark'); ov.innerHTML = ''; ov._kind = null;
    if (G) G.overlay = null;
  }
  function alertBox(title, html) {
    showOverlay(`<div class="modal"><h2>${esc(title)}</h2><p>${html}</p><div class="row"><button class="btn green" data-h="close">OK LAH</button></div></div>`, 'alert');
  }

  function showHelpAll() {
    showOverlay(`<div class="modal help-all"><h2>CARA MAIN · HOW TO PLAY</h2>
      <h3>TELUR PONG · 2 players</h3>
      <ul><li><b>Swipe up</b> to throw an egg into the other player's 6 kopi cups. Longer swipe = further, tilt to aim.</li>
      <li>Watch the <b>ANGIN</b> (fan wind). 2 throws a turn; both in = <b>Telur balik!</b> Sink all 6 cups to win.</li></ul>
      <h3>KOPI TUMPAH · 2–6 players</h3>
      <ul><li>Take turns pouring kopi into the same glass. <b>Press and hold TUANG</b> — the longer you hold, the faster it pours.</li>
      <li>Any drip counts. The spill point is secret. Whoever makes it <b>tumpah</b> is out and belanja kopi. Last one left wins.</li></ul>
      <h3>INGAT ORDER · 1–6 players</h3>
      <ul><li>Customers say their orders, then the bubbles disappear. Key the whole order into the tablet from memory (drinks <b>PANAS</b> or <b>AIS</b>, plus food).</li>
      <li>Take turns, 5 tables each, getting harder. Watch for <b>"tambah"</b> and <b>"tukar"</b>! +10 right, −5 wrong, +20 perfect table.</li></ul>
      <h3>CARI TELUR · 1–6 players</h3>
      <ul><li>Follow the egg under the shuffling bowls, then everyone taps a bowl at the same time.</li>
      <li>10 levels, 3 up to 6 bowls. 100 points per egg found, plus a bonus for picking fast.</li></ul>
      <h3>ROTI FLIP · 1–6 players</h3>
      <ul><li>Everyone flips at once. <b>Tap</b> the dough to fling it, <b>tap again</b> when the ring turns green as it lands. Good catches make it bigger and thinner.</li>
      <li>Bad timing tears it. <b>LETAK</b> any time to keep your points — koyak first and you get 0. 10+ flips = Roti Tisu +20. Round 3 is Roti Telur x2.</li></ul>
      <h3>LALAT HUNT · 1–6 players</h3>
      <ul><li>Flies buzz over the table. <b>Tap a fly</b> — flying or landed — to swat it with your selipar. First hit wins it.</li>
      <li>Lalat +10, green langau +25, gold +50. Hit a plate or cup −15. 3 rounds of 30 s.</li></ul>
      <h3>KIRA DUIT · 1–6 players</h3>
      <ul><li>A customer pays at the counter. Everyone works out the <b>baki</b> (change) at the same time and taps notes and coins, then <b>BAGI BAKI</b>.</li>
      <li>Right baki scores 100 for the fastest, then 75, 60... Fewest pieces gets +10. Wrong = 0. 10 customers, harder each time.</li></ul>
      <h3>TARIK TEH · 1–6 players</h3>
      <ul><li>Take turns. <b>Hold</b> on the mugs to pour — your arm pulls higher and higher. Higher = more <b>buih</b>, but the stream swings more.</li>
      <li><b>Slide</b> left/right to keep the bottom mug under the teh. Spill too much and it's <b>tumpah</b> (0 buih). Let go any time to keep your buih. 3 rounds, most buih wins.</li></ul>
      <h3>MAIN DENGAN KAWAN</h3>
      <ul><li>Pick a game, tap <b>BUKA MEJA</b>, and share the 4-letter code. Friends type it in and tap <b>MASUK</b>.</li></ul>
      <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
  }
  function showHelp() {
    AU.unlock();
    if (!G) { showHelpAll(); return; }
    if ((G && G.state && G.state.game === 'egg') || (!G && me.mode === 'egg')) {
      showOverlay(`<div class="modal"><h2>CARI TELUR · CARA MAIN</h2>
        <ul>
          <li>Watch which bowl the <b>egg</b> goes under.</li>
          <li>The bowls shuffle — <b>ikut betul-betul!</b> (follow it)</li>
          <li>Everyone taps the bowl they think has the egg. You have 10 seconds. Nobody sees your pick until the reveal.</li>
          <li>Right bowl = <b>100 points</b> + up to 50 bonus for picking fast.</li>
          <li>10 levels: 3 bowls at first, up to 6 bowls and very fast. From level 6 watch out for <b>jumping bowls</b> and <b>fake swaps</b>!</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if ((G && G.state && G.state.game === 'order') || (!G && me.mode === 'order')) {
      showOverlay(`<div class="modal"><h2>INGAT ORDER · CARA MAIN</h2>
        <ul>
          <li>You are the waiter. Players take turns, one table each.</li>
          <li>Customers say their order one by one. <b>Dengar baik-baik</b> — then the bubbles disappear!</li>
          <li>Key the whole order into the tablet: drinks are <b>PANAS</b> (hot) or <b>AIS</b>, plus the food. Use − and + for how many.</li>
          <li>30 seconds, then tap <b>HANTAR ORDER</b>.</li>
          <li>+10 for each right item, −5 for each wrong one, +20 for a perfect table.</li>
          <li>5 tables each, from 1 customer up to 4. From table 3, someone may shout <b>"tambah satu..."</b>. At table 5 someone also <b>tukar</b> (changes) their order!</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'lami') {
      showOverlay(`<div class="modal"><h2>LAMI · CARA MAIN</h2>
        <ul>
          <li>Penang rummy (Si Rummy): 2 packs + 8 jokers. Everyone gets <b>20 cards</b> (25 with 3 players). Only you see yours.</li>
          <li><b>No drawing, no discarding.</b> On your turn you <b>must</b> do at least one thing: make a <b>meld</b> or <b>lay off</b> onto any meld on the table. Do as many as you like, then press <b>HABIS</b>.</li>
          <li><b>Run</b> = 3+ same suit in order (A-2-3 or J-Q-K-A, no wrap). <b>Set</b> = 3+ same rank (suits can repeat). Jokers are wild.</li>
          <li>Your first meld is your <b>passport</b> and must be a <b>run</b>. Can't make one? You're <b>MATI</b> for this hand.</li>
          <li>Tap your cards to pick them, then <b>MELD</b>, or tap a meld on the table to add them. Pick one card that matches a joker on the table and tap that meld to <b>swap</b> the joker back to you.</li>
          <li>Can't meld or lay off on your turn = <b>MATI</b> (dead) — you sit out with what's left.</li>
          <li>Empty your hand = <b>GAME!</b> Everyone else counts what's left: <b>A 15 · 10/J/Q/K 10 · 2–9 face · Joker 20</b>. 4 hands, lowest total wins.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'roti') {
      showOverlay(`<div class="modal"><h2>ROTI FLIP · CARA MAIN</h2>
        <ul>
          <li>Everyone flips their own roti canai at the same time. <b>30 seconds</b> per round.</li>
          <li><b>Tap</b> the dough to fling it up. A ring closes in as it comes down — <b>tap again</b> when the ring turns <b>green</b>.</li>
          <li><b>PERFECT</b> = big stretch. <b>OK</b> = small stretch and a little tear. <b>Early, late or missed</b> = a hole! Each flip is faster than the last.</li>
          <li>Fill the <b>KOYAK</b> bar and your roti tears — <b>0 points</b> this round.</li>
          <li>Press <b>LETAK!</b> any time to slap it on the tawa and keep the points. When time runs out, whole dough goes on the tawa by itself.</li>
          <li>10+ flips = <b>Roti Tisu +20</b>. Round 3 is <b>Roti Telur</b>: everything x2. Most points after 3 rounds is Raja Roti.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'mamak') {
      showOverlay(`<div class="modal"><h2>MAMAK MAHJONG · CARA MAIN</h2>
        <ul>
          <li>12 kinds of kopitiam tiles, 4 of each. Everyone holds <b>7 tiles</b> — only you can see yours.</li>
          <li>On your turn you <b>draw</b> one tile automatically, then tap a tile and tap it again (or press <b>BUANG</b>) to throw one away.</li>
          <li>Win with <b>8 tiles = 2 sets of three-of-a-kind + 1 pair</b>, e.g. KOPI KOPI KOPI · ROTI ROTI ROTI · TEH TEH. Press <b>MAKAN!</b></li>
          <li>When someone buang a tile and you hold a pair of it, you can <b>CHOP!</b> — take it to make an open set (everyone sees it), then buang one.</li>
          <li>If the thrown tile <b>finishes your hand</b>, press <b>MAKAN!</b> to win with it.</li>
          <li><b>Points:</b> win +10 · makan sendiri (own draw) +5 · no CHOP sets (tutup) +5 · the one who threw your winning tile −5.</li>
          <li><b>TUNGGU</b> under your tiles shows which tile you're waiting for. Tembok (wall) runs out = seri. <b>4 hands</b>, most points is Raja Mamak.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'lalat') {
      showOverlay(`<div class="modal"><h2>LALAT HUNT · CARA MAIN</h2>
        <ul>
          <li>Flies buzz around the kopitiam table and land for a moment. Everyone plays at the same time.</li>
          <li><b>Tap a fly</b> to swat it with your selipar — flying or landed. Landed ones are easier to hit! The first player to hit it gets the points.</li>
          <li>Black lalat <b>+10</b> · fat green langau <b>+25</b> · golden lalat <b>+50</b> (rare and fast).</li>
          <li>Miss and hit a <b>plate or cup −15</b> (pecah pinggan!).</li>
          <li>Swatting empty table makes you wait a moment, so don't just spam.</li>
          <li><b>3 rounds of 30 seconds.</b> Round 2 has more flies, round 3 is a swarm. Most points wins Raja Lalat.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'duit') {
      showOverlay(`<div class="modal"><h2>KIRA DUIT · CARA MAIN</h2>
        <ul>
          <li>A customer comes to the <b>BAYAR SINI</b> counter. The receipt shows what they ate, the <b>JUMLAH</b> and what they <b>BAYAR</b>.</li>
          <li>Everyone works out the <b>baki</b> (change) at the same time. Tap the notes and coins to put them in your tray. Tap a piece in the tray to take it back.</li>
          <li>Press <b>BAGI BAKI!</b> when it's right. You only get one try per customer!</li>
          <li>Right baki: <b>100</b> pts for the fastest, then 75, 60, 50... Use the <b>fewest pieces</b> for +10. Wrong or too slow = 0.</li>
          <li><b>10 customers</b>, more items each time. Later customers pay with extra coins so the baki comes out neat — watch out!</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if (G && G.state && G.state.game === 'tarik') {
      showOverlay(`<div class="modal"><h2>TARIK TEH · CARA MAIN</h2>
        <ul>
          <li>Players take turns, <b>3 rounds</b>. One pull each turn.</li>
          <li><b>Press and hold</b> on the mugs to start pouring. Your arm keeps pulling the top mug <b>higher</b> while you hold.</li>
          <li>Higher pull = more <b>buih</b> per second (watch the ruler: OK · TINGGI · PRO · GILA!).</li>
          <li>But the stream <b>swings</b> more the higher you go. <b>Slide left/right</b> to keep the bottom mug under it. On a computer you can also use <b>Space</b> + <b>← →</b>.</li>
          <li>Teh that misses the mug fills the <b>TUMPAH</b> bar. Fill it and you get <b>0 buih</b> for that pull!</li>
          <li><b>Let go</b> any time to keep your buih. Pour the whole mug cleanly for <b>SEMPURNA +25</b>.</li>
          <li>Most buih after 3 rounds is Raja Teh Tarik.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if ((G && G.state && G.state.game === 'kopi') || (!G && me.mode === 'kopi')) {
      showOverlay(`<div class="modal"><h2>KOPI TUMPAH · CARA MAIN</h2>
        <ul>
          <li>Everyone takes turns pouring kopi into <b>the same cup</b>.</li>
          <li><b>Press and hold</b> TUANG (or the cup) to pour. The longer you hold, the faster the kettle pours. Let go to stop — a few drops still fall after.</li>
          <li>Any pour counts — <b>even one drip</b>. A tap is enough to pass your turn.</li>
          <li>The kopi can bulge a little above the rim, but the real spill point is <b>secret</b> and different every cup.</li>
          <li>Whoever makes it <b>tumpah</b> is out and <b>belanja kopi</b>! A new cup starts. Last player standing wins.</li>
          <li>10 seconds per turn, or the kettle drips a little for you.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    if ((G && G.state && G.state.game === 'pong') || (!G && me.mode === 'pong')) {
      showOverlay(`<div class="modal"><h2>TELUR PONG · CARA MAIN</h2>
        <ul>
          <li>Throw eggs into the other player's <b>6 kopi cups</b>.</li>
          <li><b>Swipe up</b> on the table (or drag up with the mouse). <b>Longer swipe = further</b>. Swipe <b>left/right</b> to aim.</li>
          <li>The ceiling fan blows: check <b>ANGIN</b> (wind) before you throw. It changes every turn.</li>
          <li><b>2 throws</b> per turn. Both go in? <b>Telur balik!</b> You throw 2 more.</li>
          <li>Sink all 6 of their cups to win. Egg on the table = pecah telur, egg on the floor = jatuh lantai.</li>
          <li>25 seconds per throw, or the egg slips out of your hand.</li>
        </ul>
        <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
      return;
    }
    showOverlay(`<div class="modal"><h2>UNCLE JACK 21 · CARA MAIN</h2>
      <ul>
        <li>Get closer to <b>21</b> than the <b>Tauke</b> (dealer) without going over.</li>
        <li>J, Q, K = 10. Ace = 1 or 11.</li>
        <li><b>Blackjack</b> (A + 10 on first two cards) pays <b>3:2</b>.</li>
        <li><b>HIT</b> = tambah kad · <b>STAND</b> = cukup · <b>DOUBLE</b> = 2x bet, one card only · <b>SPLIT</b> a pair into two hands.</li>
        <li>Tauke shows an Ace? You can buy <b>insurance</b> (pays 2:1).</li>
        <li>Tauke must draw to 16 and stand on 17.</li>
        <li>One player is the <b>Tauke</b> — the host picks, or it's random. Tauke's chips are the bank: players win from the Tauke, lose to the Tauke.</li>
        <li>Everyone starts with <b>1000</b> chips. <b>No credit!</b> Chips habis = you sit out.</li>
        <li>Tauke bankrupt? A new Tauke is picked. Game ends when only 1 player still has chips.</li>
      </ul>
      <p style="font-size:16px;color:#8a7458">Play chips only — no real money.</p>
      <div class="row"><button class="btn green" data-h="close">FAHAM!</button></div></div>`, 'help');
  }

  function confirmLeave() {
    const host = G && G.mode === 'host';
    showOverlay(`<div class="modal"><h2>BALIK RUMAH?</h2><p>${host ? 'You are the <b>host</b>. Leaving will <b>close the table for everyone</b>.' : 'Leave this table? You can rejoin with the same code.'}</p>
      <div class="row"><button class="btn" data-h="close">STAY</button><button class="btn red" data-h="leave">LEAVE</button></div></div>`, 'confirm');
  }

  function showHostMenu() {
    if (!G || !G.isHost) return;
    G.overlay = 'hostmenu';
    renderHostMenu(true);
  }
  function renderHostMenu(force) {
    const s = G.state; if (!s) return;
    const randomCur = !s.nextTaukeId || s.nextTaukeId === 'random';
    const html = `<div class="modal"><h2>HOST MENU</h2>
      <p>Pick the <b>Tauke</b> (dealer). ${s.phase === 'lobby' ? 'Applies when the game starts.' : 'Applies from the next round.'}</p>
      <div class="plist">
        <div class="prow${randomCur ? ' cur' : ''}"><span class="av" style="background-image:url(${DICE});background-size:100% 100%;--av:36px"></span><div class="info">Random${s.phase === 'lobby' ? '' : ' (re-roll)'}<small>${randomCur ? 'SELECTED' : 'Let the dice decide'}</small></div><button class="btn gold" data-h="tauke" data-id="">PICK</button></div>
        ${s.players.map(p => `<div class="prow${s.nextTaukeId === p.id ? ' cur' : ''}"><span class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></span>
          <div class="info">${esc(p.name)}${p.id === me.id ? ' (you)' : ''}<small>${p.chips} chips${p.id === s.taukeId ? ' · TAUKE NOW' : ''}${s.nextTaukeId === p.id ? ' · NEXT' : ''}${p.isBot ? ' · BOT' : ''}${!p.connected ? ' · OFFLINE' : ''}</small></div>
          <button class="btn gold" data-h="tauke" data-id="${esc(p.id)}" ${p.chips < s.settings.minBet || !p.connected ? 'disabled' : ''}>TAUKE</button>
          ${p.id !== me.id ? `<button class="btn red" data-h="kick" data-id="${esc(p.id)}">KICK</button>` : ''}</div>`).join('')}
      </div>
      <div class="row"><button class="btn" data-h="addBot" ${s.players.length >= BJ.MAX_PLAYERS ? 'disabled' : ''}>+ BOT</button><button class="btn green" data-h="close">OK</button></div></div>`;
    const ov = $('#overlay');
    if (!force && ov._html === html) return;
    const sc = ov.querySelector('.modal') ? ov.querySelector('.modal').scrollTop : 0;
    showOverlay(html, 'hostmenu');
    ov._html = html;
    const m = ov.querySelector('.modal'); if (m) m.scrollTop = sc;
  }

  function showPodium() {
    const s = G && G.state; if (!s || !s.ranking) return;
    const r = s.ranking;
    const pd = (p, i) => p ? `<div class="pd p${i + 1}"><div class="av" style="background-image:url(${SPR.avatarSheet(p.avatar)})"></div><div class="nm">${esc(p.name)}</div><div class="ch">${p.chips}</div><div class="blk">${i + 1}</div></div>` : '';
    showOverlay(`<div class="modal"><h2>GAME OVER · HUAT AH ${esc((r[0] || {}).name || '')}!</h2>
      <div class="podium">${pd(r[1], 1)}${pd(r[0], 0)}${pd(r[2], 2)}</div>
      ${r.slice(3).map((p, i) => `<p>${i + 4}. ${esc(p.name)} — ${p.chips}</p>`).join('')}
      <div class="row"><button class="btn" data-h="close">CLOSE</button>${G.isHost ? '<button class="btn red" data-h="newGame">NEW GAME</button>' : ''}</div></div>`, 'podium');
    confetti();
  }

  function overlayAction(h, id) {
    AU.play('click');
    switch (h) {
      case 'close': closeOverlay(); break;
      case 'leave': closeOverlay(); leaveGame(); break;
      case 'tauke': send({ t: 'tauke', id: id || null }); break;
      case 'kick':
        if (G && G.mode === 'host' && G.net) G.net.send(id, { t: 'kicked' });
        send({ t: 'kick', id });
        break;
      case 'addBot': send({ t: 'addBot' }); break;
      case 'newGame': send({ t: 'newGame' }); closeOverlay(); break;
      case 'menu': closeOverlay(); confirmLeave(); break;
    }
  }

  // =============== misc ===============
  function share() {
    if (!G || !G.code) return;
    AU.play('click');
    const url = location.origin + location.pathname + '?room=' + G.code;
    const text = 'Jom main ' + ({ pong: 'Telur Pong', kopi: 'Kopi Tumpah', order: 'Ingat Order', egg: 'Cari Telur', tarik: 'Tarik Teh', duit: 'Kira Duit', lalat: 'Lalat Hunt', mamak: 'Mamak Mahjong', roti: 'Roti Flip', lami: 'Lami' }[G.state && G.state.game] || 'Uncle Jack 21') + ' kat Kopitiam 21! Meja ' + G.code;
    if (navigator.share) { navigator.share({ title: 'Kopitiam 21', text, url }).catch(() => {}); return; }
    const done = () => toast('Link copied! Paste to your friends');
    if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(done, () => toast('Code: ' + G.code));
    else toast('Code: ' + G.code);
  }
  function toast(msg) {
    const t = $('#toast'); t.innerHTML = ''; const d = el('div'); d.textContent = msg; t.appendChild(d);
  }
  let statusT = null;
  function setStatus(msg, ms) {
    const s = $('#status');
    clearTimeout(statusT);
    if (!msg) { s.classList.add('hidden'); return; }
    s.textContent = msg; s.classList.remove('hidden');
    if (ms) statusT = setTimeout(() => s.classList.add('hidden'), ms);
  }

  // =============== boot ===============
  Scene.init($('#scene'));
  PV.mount($('#pongCanvas'), { onThrow: (p, a) => send({ t: 'throw', p, a }) });
  KV.mount($('#kopiCanvas'), { onLevel: m => send(m) });
  TV.mount($('#tarikCanvas'), { onFrame: m => send(m) });
  DV.mount($('#duitView'), { onGive: m => send(m) });
  LV.mount($('#lalatCanvas'), { onSwat: m => send(m) });
  MV.mount($('#mamakView'), { onAct: m => send(m) });
  RV.mount($('#rotiCanvas'), { onReport: m => send(m) });
  LMV.mount($('#lamiView'), { onAct: m => send(m), onToast: t => toast(t), onSel: () => { if (G && G.state) renderLamiControls(G.state, G.state.players.find(p => p.id === me.id)); } });
  RV.onLocal = () => { if (G && G.state) renderRotiControls(G.state, G.state.players.find(p => p.id === me.id)); };
  window.addEventListener('keydown', e => {
    if (!G || !G.state || G.state.game !== 'roti' || e.repeat || document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); RV.tap(); }
    if (e.code === 'Enter') { e.preventDefault(); RV.letak(); }
  });
  TV.onLocal = L => {
    const m = $('#tarikMsg'); if (!m) return;
    const html = L.done ? (L.sp >= TARIK.P.TUMPAH ? '<b>TUMPAH!</b> Aiyo...' : '<b>' + Math.round(L.fr) + ' buih!</b>') : L.miss ? '<b>Kejar!</b> Catch the teh!' : L.h > 0.75 ? '<b>GILA tinggi!</b> Lepas bila-bila...' : '<b>Tarik!</b> Hold &amp; slide...';
    if (m._h !== html) { m._h = html; m.innerHTML = html; }
  };
  const tkKeys = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }, tkDown = new Set();
  const tkDir = () => { let d = 0; for (const k of tkDown) d += tkKeys[k]; TV.key(Math.max(-1, Math.min(1, d))); };
  window.addEventListener('keydown', e => {
    if (!G || !G.state || G.state.game !== 'tarik' || document.activeElement.tagName === 'INPUT') return;
    if (e.code in tkKeys) { e.preventDefault(); tkDown.add(e.code); tkDir(); }
    if (e.code === 'Space' && !e.repeat && TV.isMine()) { e.preventDefault(); TV.press(); }
  });
  window.addEventListener('keyup', e => {
    if (e.code in tkKeys) { tkDown.delete(e.code); tkDir(); }
    if (e.code === 'Space' && G && G.state && G.state.game === 'tarik') TV.release();
  });
  OV.mount($('#orderView'), { onChit: items => send({ t: 'chit', items }) });
  EV.mount($('#eggCanvas'), { onPick: slot => send({ t: 'pick', slot }) });
  KV.onLocal = (ok) => {
    const m = $('#kopiMsg'); if (!m) return;
    const html = ok ? '<b>OK!</b> Lepas bila-bila — or risk a bit more...' : 'Your turn — <b>even one drop</b> counts!';
    if (m._h !== html) { m._h = html; m.innerHTML = html; }
  };
  // hold-to-pour button (pointer + space bar)
  $('#controls').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-hold]'); if (!b) return;
    e.preventDefault(); b.classList.add('on'); KV.press();
    try { b.setPointerCapture(e.pointerId); } catch (x) {}
  });
  const holdEnd = () => { $$('#controls [data-hold]').forEach(b => b.classList.remove('on')); KV.release(); };
  window.addEventListener('pointerup', holdEnd);
  window.addEventListener('pointercancel', holdEnd);
  // long-press = contextmenu on phones (it can also cancel a held pour); block it everywhere except text boxes
  document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  window.addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && KV.isMine() && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); KV.press(); } });
  window.addEventListener('keyup', e => { if (e.code === 'Space') KV.release(); });
  PV.onAim = p => {
    const pw = $('#pongView .ph-power');
    if (p == null) { pw.classList.add('hidden'); return; }
    pw.classList.remove('hidden');
    $('i', pw).style.height = Math.min(100, p * 100).toFixed(0) + '%';
    $('i', pw).style.background = p < 0.5 ? '#7cff9a' : p < 0.85 ? '#f6c744' : '#ff6b5b';
  };
  initHome();
  $('.chit-foot span').textContent = VERSION;
  initGameUI();
  if (OFFLINE && params.has('autohost')) { me.name = me.name || 'Tester'; if (params.get('mode')) me.mode = params.get('mode'); startHost(); }
  else {
    // refreshed the page mid-game? hop straight back to the same table
    let back = null; try { back = sessionStorage.getItem('k21room'); } catch (e) {}
    if (back && me.name) startJoin(back);
  }
  window.K21 = { get G() { return G; }, me };
})();
