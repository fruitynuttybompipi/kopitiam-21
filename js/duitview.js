/* Kopitiam 21 — Kira Duit view: the customer at the BAYAR SINI counter, their receipt, and your cash drawer. */
(function (root) {
  'use strict';
  const { DUIT, SPR, AU } = root;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DV = {};
  let box, st = null, meId = null, handlers = {};
  let tray = {}, trayKey = '', custKey = '', revKey = '', mode = '';

  // ---------- pixel money, drawn in code ----------
  const NOTE = { n1: ['#3d6fd1', '#7aa0e8'], n5: ['#3f9a3a', '#7cc46a'], n10: ['#d4382c', '#f07a6a'], n20: ['#e8902a', '#f6c070'], n50: ['#2a8a9a', '#6ac0c8'] };
  const COIN = { c10: ['#c9ced6', '#eef1f4', '#7d848e'], c20: ['#d9b24a', '#f6dc8a', '#8a6a1e'], c50: ['#e0b84a', '#fbe49a', '#8a6a1e'] };
  const imgs = {};
  function money(id) {
    if (imgs[id]) return imgs[id];
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const P = root.Scene.ptext, tw = root.Scene.tw;
    if (NOTE[id]) {
      c.width = 34; c.height = 17;
      const [b, l] = NOTE[id], v = String(DUIT.val(id) / 100);
      R(0, 0, 34, 17, '#2a1a12'); R(1, 1, 32, 15, b);
      R(2, 2, 11, 13, l);
      R(5, 4, 5, 8, '#fbf3dc'); R(6, 5, 3, 3, b); R(6, 9, 3, 2, b);        // portrait in a little window
      R(14, 12, 18, 1, l); R(14, 14, 12, 1, l);
      P(g, v, 32 - tw(v), 3, '#fbf3dc');
      P(g, 'RM', 15, 3, l);
    } else {
      const big = id === 'c50', n = big ? 17 : 15; c.width = n; c.height = n;
      const [b, l, d] = COIN[id], r = n / 2;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - r, dy = y + 0.5 - r, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd > r) continue;
        R(x, y, 1, 1, dd > r - 1.2 ? '#2a1a12' : dd > r - 2.2 ? d : (dx + dy < -3 ? l : b));
      }
      const v = String(DUIT.val(id));
      P(g, v, Math.round(r - tw(v) / 2), Math.round(r - 3), '#2a1a12');
    }
    return (imgs[id] = c.toDataURL());
  }
  DV.money = money;
  const img = (id, cls) => `<img class="${cls || ''} ${DUIT.val(id) >= 100 ? 'note' : 'coin'}${id === 'c50' ? ' big' : ''}" src="${money(id)}" alt="">`;
  const label = id => DUIT.val(id) >= 100 ? 'RM' + DUIT.val(id) / 100 : DUIT.val(id) + ' sen';
  const rm = sen => 'RM' + (sen / 100).toFixed(2);
  const piecesHtml = coins => DUIT.MONEY.filter(m => coins[m.id]).map(m => Array.from({ length: coins[m.id] }, () => img(m.id)).join('')).join('');

  // ---------- layout ----------
  DV.mount = function (el, h) {
    box = el; handlers = h || {};
    box.innerHTML = `
      <div class="oq"></div>
      <div class="d-head"><b class="d-level"></b></div>
      <div class="d-counter">
        <div class="d-cust"><span class="av"></span><div class="d-bub"></div></div>
        <div class="d-receipt"></div>
      </div>
      <div class="d-drawer hidden">
        <div class="d-tray"><div class="d-pieces"></div><b class="d-total">RM0.00</b></div>
        <div class="d-keys">${DUIT.GIVE.map(id => `<button class="d-key" data-k="${id}" type="button">${img(id)}<small>${label(id)}</small></button>`).join('')}</div>
        <div class="d-acts"><button class="btn" data-dact="clear" type="button">KOSONG</button><button class="btn red big" data-dact="give" type="button">BAGI BAKI!</button></div>
        <div class="d-lock hidden"></div>
      </div>
      <div class="d-reveal hidden"></div>`;
    box.addEventListener('click', onClick);
  };

  function canGive() { return !!(st && st.phase === 'count' && st.cust && !(st.gave && st.gave[meId]) && meP() && meP().inGame); }
  function meP() { return st && st.players.find(p => p.id === meId); }
  function onClick(e) {
    const t = e.target.closest('[data-k],[data-rm],[data-dact]');
    if (!t || !canGive()) return;
    if (t.dataset.k) {
      const k = t.dataset.k;
      if ((tray[k] || 0) >= 9) return;
      tray[k] = (tray[k] || 0) + 1; AU.play(DUIT.val(k) >= 100 ? 'card' : 'chip');
      t.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 120, easing: 'steps(2)' });
    } else if (t.dataset.rm) {
      const k = t.dataset.rm; tray[k] = (tray[k] || 0) - 1; if (tray[k] <= 0) delete tray[k]; AU.play('click');
    } else if (t.dataset.dact === 'clear') { tray = {}; AU.play('click'); }
    else if (t.dataset.dact === 'give') {
      if (!DUIT.sum(tray)) { nudge(); return; }
      handlers.onGive && handlers.onGive({ t: 'give', r: st.rnd, coins: Object.assign({}, tray) });
      AU.play('coin');
      const lock = $('.d-lock', box); lock.textContent = 'Dah bagi ' + rm(DUIT.sum(tray)) + '! Tunggu...'; lock.classList.remove('hidden');
      box.classList.add('given');
    }
    drawTray();
  }
  function nudge() { const tr = $('.d-tray', box); tr.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200, easing: 'steps(3)' }); AU.play('bust'); }
  function drawTray() {
    const p = $('.d-pieces', box);
    p.innerHTML = DUIT.MONEY.filter(m => tray[m.id]).map(m => `<button class="d-pc" data-rm="${m.id}" type="button">${img(m.id)}${tray[m.id] > 1 ? `<i>×${tray[m.id]}</i>` : ''}</button>`).join('') || '<span class="d-hint">Tap duit bawah untuk bagi baki</span>';
    $('.d-total', box).textContent = rm(DUIT.sum(tray));
  }

  function receipt(c, showBaki) {
    const rows = c.items.map(x => `<div class="d-row"><img src="${root.OV.icon(x.id + (x.id === 'limau' || x.id === 'bandung' ? ':ais' : ':panas'))}" alt=""><span>${x.qty > 1 ? x.qty + '× ' : ''}${esc(x.name)}</span><b>${(x.sen * x.qty / 100).toFixed(2)}</b></div>`).join('');
    return `<div class="d-rh">RESIT · MEJA ${c.n}</div>${rows}
      <div class="d-line"></div>
      <div class="d-sum"><span>JUMLAH</span><b>${rm(c.total)}</b></div>
      <div class="d-sum paid"><span>BAYAR</span><b>${rm(c.paidSen)}</b></div>
      <div class="d-paid">${piecesHtml(c.paid)}</div>
      <div class="d-sum baki"><span>BAKI</span><b>${showBaki && c.baki != null ? rm(c.baki) : '???'}</b></div>`;
  }

  DV.render = function (s, me) {
    st = s; meId = me;
    const c = s.cust;
    box.classList.toggle('reveal', s.phase === 'reveal');
    const lvl = $('.d-level', box);
    lvl.textContent = s.phase === 'lobby' ? 'KAUNTER BELUM BUKA' : s.phase === 'over' ? 'KAUNTER TUTUP' : 'CUSTOMER ' + Math.max(1, Math.min(s.rnd, s.rounds)) + '/' + s.rounds;
    // customer + receipt
    const ck = c ? s.round + ':' + c.n + ':' + (s.phase === 'reveal') : s.phase;
    if (ck !== custKey) {
      custKey = ck;
      const cu = $('.d-cust', box), rc = $('.d-receipt', box);
      if (c) {
        cu.classList.remove('hidden'); rc.classList.remove('hidden');
        $('.av', cu).style.backgroundImage = `url(${SPR.avatarSheet(c.av)})`;
        cu.classList.toggle('arrive', s.phase === 'count');
        rc.innerHTML = receipt(c, s.phase === 'reveal');
        if (s.phase === 'reveal') rc.querySelector('.baki').classList.add('show');
      } else {
        cu.classList.add('hidden');
        rc.classList.remove('hidden');
        rc.innerHTML = `<div class="d-wait">${s.phase === 'next' ? 'Next customer...' : s.phase === 'over' ? 'Terima kasih, datang lagi!' : 'Tunggu host buka kaunter'}</div>`;
      }
    }
    // drawer
    const dr = $('.d-drawer', box), rv = $('.d-reveal', box);
    const showDrawer = s.phase === 'count' && !!c && !!meP() && meP().inGame;
    dr.classList.toggle('hidden', !showDrawer);
    const tk = s.round + ':' + s.rnd;
    if (tk !== trayKey) { trayKey = tk; tray = {}; box.classList.remove('given'); $('.d-lock', box).classList.add('hidden'); drawTray(); }
    if (showDrawer && s.gave && s.gave[meId] && !box.classList.contains('given')) { box.classList.add('given'); const l = $('.d-lock', box); l.textContent = 'Dah bagi! Tunggu...'; l.classList.remove('hidden'); }
    // reveal
    const rk = s.phase === 'reveal' && s.results ? tk : '';
    rv.classList.toggle('hidden', !rk);
    if (rk && rk !== revKey) {
      revKey = rk;
      const res = s.results.slice().sort((a, b) => b.pts - a.pts || (a.at || 9e9) - (b.at || 9e9));
      rv.innerHTML = `<div class="d-ans"><span>BAKI BETUL</span><b>${rm(c.baki)}</b><div class="d-paid">${piecesHtml(DUIT.best(c.baki))}</div></div>
        ${res.map(r => { const p = s.players.find(x => x.id === r.id); return `<div class="d-res ${r.ok ? 'ok' : 'no'}${r.id === meId ? ' me' : ''}"><span class="av" style="background-image:url(${p ? SPR.avatarSheet(p.avatar) : ''})"></span><span class="nm">${esc(p ? p.name : '?')}</span><span class="d-v">${!r.gave ? 'tak bagi' : r.ok ? '✓ ' + (r.at / 1000).toFixed(1) + 's' + (r.rank === 0 && res.length > 1 ? ' · LAJU!' : '') + (r.neat ? ' · kemas' : '') : '✗ ' + rm(r.amt)}</span><b>+${r.pts}</b></div>`; }).join('')}`;
    }
    if (!rk) revKey = '';
  };
  DV.fx = function (f) {
    if (f.type === 'customer') { AU.play('clink'); custSay(f.text); }
    if (f.type === 'say' && f.cust) custSay(f.text);
    if (f.type === 'reveal') AU.play(f.first === meId ? 'tada' : 'coin');
  };
  function custSay(text) {
    const b = $('.d-bub', box); if (!b) return;
    b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 2600);
  }
  DV.reset = function () { custKey = ''; trayKey = ''; revKey = ''; tray = {}; };
  root.DV = DV;
})(window);
