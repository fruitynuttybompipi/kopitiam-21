/* Kopitiam 21 — Mamak Mahjong view: green felt table with the discard pool, open sets, and your own tiles. */
(function (root) {
  'use strict';
  const { MAMAK, AU } = root;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MV = {};
  let box, st = null, pv = null, meId = null, handlers = {};
  let sel = null, lastKeys = {};

  const K = MAMAK.KINDS;
  const icon = k => root.OV.icon(K[k].icon);
  const tile = (k, cls, n) => `<${n != null ? 'button type="button"' : 'span'} class="mt ${cls || ''}"${n != null ? ` data-n="${n}"` : ''}><img src="${icon(k)}" alt=""><small>${K[k].label}</small></${n != null ? 'button' : 'span'}>`;
  const set3 = (k, cls) => `<span class="m-set">${tile(k, cls)}${tile(k, cls)}${tile(k, cls)}</span>`;
  const nameOf = id => { const p = st && st.players.find(x => x.id === id); return p ? p.name : '?'; };

  MV.mount = function (el, h) {
    box = el; handlers = h || {};
    box.innerHTML = `
      <div class="oq"></div>
      <div class="m-table">
        <div class="m-info"><b class="m-hand"></b><span class="m-wall"></span></div>
        <div class="m-melds"></div>
        <div class="m-last"></div>
        <div class="m-pool"></div>
      </div>
      <div class="m-mine">
        <div class="m-myexp"></div>
        <div class="m-row"></div>
        <div class="m-wait"></div>
      </div>`;
    box.addEventListener('click', e => {
      const t = e.target.closest('.m-row [data-n]');
      if (!t || !myTurn()) return;
      const n = +t.dataset.n;
      if (sel === n) { MV.discardSel(); return; }
      sel = n; AU.play('click');
      drawHand(true);
      handlers.onSelect && handlers.onSelect(sel);
    });
  };
  function myTurn() { return !!(st && st.phase === 'turn' && st.cur === meId && pv); }
  MV.selected = () => sel;
  MV.discardSel = function () {
    if (!myTurn()) return;
    const n = sel != null && pv.hand.includes(sel) ? sel : null;
    if (n == null) { const r = $('.m-row', box); r.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200, easing: 'steps(3)' }); return; }
    handlers.onAct && handlers.onAct({ t: 'discard', n });
    sel = null;
  };

  function drawHand(force) {
    const row = $('.m-row', box);
    if (!pv || !st || st.phase === 'lobby' || st.phase === 'over') { row.innerHTML = ''; return; }
    const key = pv.key + '|' + pv.hand.join(',') + '|' + pv.drawn + '|' + sel + '|' + myTurn();
    if (!force && key === lastKeys.hand) return;
    lastKeys.hand = key;
    if (sel != null && !pv.hand.includes(sel)) sel = null;
    // the tile just drawn sits a little apart on the right
    const main = pv.hand.filter(n => n !== pv.drawn);
    const html = main.map(n => tile(MAMAK.kindOf(n), (n === sel ? 'sel' : '') + (myTurn() ? ' live' : ''), n)).join('')
      + (pv.drawn != null && pv.hand.includes(pv.drawn) ? `<i class="m-gap"></i>${tile(MAMAK.kindOf(pv.drawn), 'new' + (pv.drawn === sel ? ' sel' : '') + (myTurn() ? ' live' : ''), pv.drawn)}` : '');
    row.innerHTML = html;
  }

  MV.render = function (s, priv, me) {
    st = s; pv = priv; meId = me;
    box.classList.toggle('myturn', myTurn());
    const meP = s.players.find(p => p.id === me);
    $('.m-hand', box).textContent = s.phase === 'lobby' ? 'MAMAK MAHJONG' : s.phase === 'over' ? 'GAME HABIS' : 'HAND ' + Math.min(s.hand, s.hands) + '/' + s.hands;
    $('.m-wall', box).textContent = s.phase === 'lobby' || s.phase === 'over' ? '' : 'TEMBOK ' + s.wallLeft + ' · dealer ' + nameOf(s.seats[s.dealer]);
    // open sets of the others
    const mk = JSON.stringify([s.players.map(p => [p.id, p.exposed]), s.phase]);
    if (mk !== lastKeys.melds) {
      lastKeys.melds = mk;
      $('.m-melds', box).innerHTML = s.players.filter(p => p.id !== me && p.exposed && p.exposed.length).map(p => `<div class="m-meld"><span>${esc(p.name)}</span>${p.exposed.map(k => set3(k, 'xs')).join('')}</div>`).join('');
    }
    // centre: last discard, or the result
    const last = $('.m-last', box);
    const lk = JSON.stringify([s.phase, s.last, s.result, s.cur]);
    if (lk !== lastKeys.last) {
      lastKeys.last = lk;
      if (s.phase === 'result' && s.result) {
        const r = s.result;
        last.innerHTML = r.draw ? '<div class="m-res">SERI · tembok habis, takde siapa makan</div>'
          : `<div class="m-res"><b>${esc(nameOf(r.winner))}</b> ${r.self ? 'MAKAN SENDIRI' : 'makan dari ' + esc(nameOf(r.fedBy))} · <b>+${r.pts}</b>${r.closed ? ' (tutup +5)' : ''}${r.fedBy ? ` · ${esc(nameOf(r.fedBy))} −5` : ''}</div>
             <div class="m-win">${r.exposed.map(k => set3(k, 'sm open')).join('')}${r.tiles.map(k => tile(k, 'sm')).join('')}</div>`;
      } else if (s.last && (s.phase === 'claim' || s.phase === 'pass')) {
        last.innerHTML = `<div class="m-dis"><span>${esc(nameOf(s.last.by))} buang</span>${tile(s.last.k, 'big')}${s.phase === 'claim' ? '<em>CHOP? MAKAN?</em>' : ''}</div>`;
      } else if (s.phase === 'turn') {
        last.innerHTML = `<div class="m-turn">${s.cur === me ? '<b>GILIRAN KAU!</b> Pilih tile, tekan lagi untuk buang' : esc(nameOf(s.cur)) + ' tengah fikir...'}</div>`;
      } else if (s.phase === 'deal') last.innerHTML = '<div class="m-turn">Kocok tile... 🀄</div>';
      else if (s.phase === 'lobby') last.innerHTML = '<div class="m-turn">2 set sama + 1 pair = MAKAN!</div>';
      else last.innerHTML = '';
    }
    // discard pool
    const pk = s.discards.length + ':' + s.hand + ':' + s.round;
    if (pk !== lastKeys.pool) {
      lastKeys.pool = pk;
      $('.m-pool', box).innerHTML = s.discards.map((d, i) => tile(d.k, 'xs' + (i === s.discards.length - 1 ? ' hot' : ''))).join('');
    }
    // mine
    $('.m-myexp', box).innerHTML = meP && meP.exposed && meP.exposed.length && s.phase !== 'lobby' && s.phase !== 'over' ? meP.exposed.map(k => set3(k, 'sm open')).join('') : '';
    drawHand();
    const w = $('.m-wait', box);
    w.innerHTML = pv && pv.waits && pv.waits.length && s.phase !== 'result' ? 'TUNGGU: ' + pv.waits.map(k => tile(k, 'xs')).join('') + ' <b>1 lagi!</b>' : '';
  };
  MV.fx = function (f) {
    if (f.type === 'discard') AU.play('card');
    if (f.type === 'draw' && f.pid === meId) AU.play('flip');
    if (f.type === 'deal') { AU.play('shuffle'); lastKeys = {}; sel = null; }
    if (f.type === 'chop') AU.play('chip');
    if (f.type === 'makan') AU.play(f.pid === meId ? 'tada' : 'win');
  };
  MV.reset = function () { lastKeys = {}; sel = null; };
  root.MV = MV;
})(window);
