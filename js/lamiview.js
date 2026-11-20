/* Kopitiam 21 — Lami view: melds on the green table, your 20 cards on the rack. Tap cards to pick them,
   then MELD, or tap a meld on the table to add them (lay off) or swap out a joker. */
(function (root) {
  'use strict';
  const { LAMI, SPR, AU } = root;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LMV = {};
  let box, st = null, pv = null, meId = null, handlers = {};
  let sel = new Set(), sortBy = 'suit', keys = {};

  function cardHtml(id, cls, as, tag) {
    const t = tag || 'span';
    if (LAMI.isJ(id)) {
      const lab = as ? LAMI.RANK(as.r) : '★';
      return `<${t} class="lc jk ${cls || ''}" data-id="${id}"><b>${lab}</b>${as && as.s ? `<img src="${SPR.suit(as.s)}" alt="" class="ghost">` : '<small>JOKER</small>'}</${t}>`;
    }
    const c = LAMI.card(id), red = c.s === 'H' || c.s === 'D';
    return `<${t} class="lc ${red ? 'red' : ''} ${cls || ''}" data-id="${id}"><b>${LAMI.RANK(c.r)}</b><img src="${SPR.suit(c.s)}" alt=""></${t}>`;
  }
  LMV.card = cardHtml;
  const nameOf = id => { const p = st && st.players.find(x => x.id === id); return p ? p.name : '?'; };
  const meP = () => st && st.players.find(p => p.id === meId);
  const myTurn = () => !!(st && st.phase === 'turn' && st.cur === meId && pv);

  LMV.mount = function (el, h) {
    box = el; handlers = h || {};
    box.innerHTML = `
      <div class="oq"></div>
      <div class="m-table l-table">
        <div class="m-info"><b class="l-hand"></b><span class="l-sub"></span></div>
        <div class="l-melds"></div>
        <div class="l-res"></div>
      </div>
      <div class="m-mine l-mine">
        <div class="l-bar"><span class="l-pick"></span><button type="button" class="l-sort">SUSUN</button></div>
        <div class="l-row"></div>
      </div>`;
    box.addEventListener('click', e => {
      const so = e.target.closest('.l-sort');
      if (so) { sortBy = sortBy === 'suit' ? 'rank' : 'suit'; keys.hand = ''; drawHand(); return; }
      const c = e.target.closest('.l-row [data-id]');
      if (c) {
        if (!myTurn()) return;
        const id = +c.dataset.id;
        if (sel.has(id)) sel.delete(id); else sel.add(id);
        AU.play('click');
        keys.hand = ''; drawHand(); pickInfo();
        handlers.onSel && handlers.onSel();
        return;
      }
      const m = e.target.closest('.l-meld');
      if (m && myTurn() && sel.size) {
        const mid = +m.dataset.mid, meld = st.melds.find(x => x.id === mid);
        const ids = [...sel];
        const p = meP();
        if (!p || !p.passport) { nudge(m); handlers.onToast && handlers.onToast('Buka passport dulu — a same-suit run'); return; }
        if (meld && LAMI.layOn(meld, ids)) { handlers.onAct({ t: 'lay', mid, ids }); sel.clear(); return; }
        if (meld && ids.length === 1 && LAMI.swapIn(meld, ids[0])) { handlers.onAct({ t: 'swap', mid, id: ids[0] }); sel.clear(); return; }
        nudge(m);
      }
    });
  };
  function nudge(el) { el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200, easing: 'steps(3)' }); AU.play('deny'); }

  // what the current pick makes
  LMV.pickMeld = function () {
    if (!sel.size) return null;
    const ids = [...sel], p = meP();
    return p && p.passport ? LAMI.asMeld(ids) : LAMI.asRun(ids);
  };
  LMV.meld = function () {
    const m = LMV.pickMeld();
    if (!myTurn() || !m) { nudge($('.l-row', box)); return; }
    handlers.onAct({ t: 'meld', ids: [...sel] });
    sel.clear();
  };
  function pickInfo() {
    const el = $('.l-pick', box);
    if (!myTurn()) { el.textContent = ''; return; }
    if (!sel.size) { el.textContent = meP() && !meP().passport ? 'Pilih run sama suit untuk passport' : 'Pilih kad'; return; }
    const m = LMV.pickMeld();
    el.innerHTML = m ? `<b class="ok">${m.type === 'run' ? 'RUN' : 'SET'} ✓</b> tekan MELD, atau tap meld atas meja` : `${sel.size} kad · tap meld atas meja untuk tambah`;
  }

  function sorted(hand) {
    const k = id => { if (LAMI.isJ(id)) return 999; const c = LAMI.card(id); return sortBy === 'suit' ? 'SHDC'.indexOf(c.s) * 20 + c.r : c.r * 4 + 'SHDC'.indexOf(c.s); };
    return hand.slice().sort((a, b) => k(a) - k(b) || a - b);
  }
  function drawHand() {
    const row = $('.l-row', box);
    if (!pv || !st || st.phase === 'lobby' || st.phase === 'over') { row.innerHTML = ''; return; }
    for (const id of [...sel]) if (!pv.hand.includes(id)) sel.delete(id);
    const key = pv.key + '|' + pv.hand.join(',') + '|' + [...sel].join(',') + '|' + sortBy + '|' + myTurn();
    if (key === keys.hand) return;
    keys.hand = key;
    row.innerHTML = sorted(pv.hand).map(id => cardHtml(id, (sel.has(id) ? 'sel' : '') + (myTurn() ? ' live' : ''), null, 'button')).join('');
  }

  LMV.render = function (s, priv, me) {
    st = s; pv = priv; meId = me;
    box.classList.toggle('myturn', myTurn());
    if (!myTurn()) sel.clear();
    const p = meP();
    $('.l-hand', box).textContent = s.phase === 'lobby' ? 'LAMI' : s.phase === 'over' ? 'GAME HABIS' : 'HAND ' + Math.min(s.hand, s.hands) + '/' + s.hands;
    $('.l-sub', box).textContent = s.phase === 'lobby' || s.phase === 'over' ? '' : p && p.dead ? 'Kau dah MATI — tengok je' : p && !p.passport ? 'Belum passport' : (s.melds.length + ' meld atas meja');
    const mk = JSON.stringify([s.melds, s.phase === 'turn' && s.cur === me]);
    if (mk !== keys.melds) {
      keys.melds = mk;
      $('.l-melds', box).innerHTML = s.melds.length ? s.melds.map(m => `<button type="button" class="l-meld ${myTurn() ? 'live' : ''}" data-mid="${m.id}"><i>${esc(nameOf(m.owner))}</i><span>${m.cards.map(c => cardHtml(c.id, 'xs', c.as)).join('')}</span></button>`).join('')
        : `<div class="m-turn">${s.phase === 'lobby' ? 'No draw, no discard. Meld or lay off every turn — or MATI!' : 'Meja kosong. First meld must be a same-suit run.'}</div>`;
    }
    const rs = $('.l-res', box);
    const rk = JSON.stringify([s.phase, s.result]);
    if (rk !== keys.res) {
      keys.res = rk;
      if (s.phase === 'result' && s.result) {
        const r = s.result;
        rs.innerHTML = `<div class="m-res">${r.winner ? '<b>' + esc(nameOf(r.winner)) + '</b> GAME! habis kad' : 'Semua MATI · <b>' + esc(nameOf(r.best)) + '</b> paling sikit'}</div>`
          + r.rows.map((x, i) => `<div class="l-rrow"><span>${i + 1}. ${esc(nameOf(x.id))}</span><b>${x.pts} pts</b><span class="l-left">${x.left.slice(0, 12).map(id => cardHtml(id, 'xs')).join('')}${x.left.length > 12 ? '…' : ''}</span></div>`).join('');
      } else rs.innerHTML = '';
    }
    drawHand(); pickInfo();
  };
  LMV.fx = function (f) {
    if (f.type === 'meld' || f.type === 'lay') AU.play('card');
    if (f.type === 'swap') AU.play('flip');
    if (f.type === 'deal') { AU.play('shuffle'); keys = {}; sel.clear(); }
    if (f.type === 'dead') AU.play('lose');
    if (f.type === 'game') AU.play(f.pid === meId ? 'tada' : 'win');
    if (f.type === 'nope' && f.pid === meId) AU.play('deny');
  };
  LMV.reset = function () { keys = {}; sel.clear(); };
  LMV.picked = () => sel.size;
  root.LMV = LMV;
})(window);
