/* Kopitiam 21 — peer-to-peer networking (PeerJS / WebRTC).
   The host's browser runs the game; friends connect straight to it with a 4-letter code. */
(function (root) {
  'use strict';
  const PREFIX = 'kopitiam21-';
  const NET = {};
  // optional self-hosted PeerJS server: ?peerhost=example.com&peerport=443&peerpath=/
  const qs = new URLSearchParams(root.location.search);
  const OPTS = { debug: 1 };
  if (qs.get('peerhost')) Object.assign(OPTS, { host: qs.get('peerhost'), port: +qs.get('peerport') || 443, path: qs.get('peerpath') || '/', secure: qs.get('peersecure') !== '0' });

  NET.host = function (code, h) {
    let peer = null, closed = false;
    const conns = new Map(); // pid -> DataConnection
    const api = {
      code,
      broadcast(msg) { for (const c of conns.values()) if (c.open) { try { c.send(msg); } catch (e) {} } },
      send(pid, msg) { const c = conns.get(pid); if (c && c.open) { try { c.send(msg); } catch (e) {} } },
      close() {
        closed = true; clearInterval(hb);
        for (const c of conns.values()) { try { c.close(); } catch (e) {} }
        if (peer) peer.destroy();
      },
    };

    function create() {
      peer = new root.Peer(PREFIX + api.code, OPTS);
      peer.on('open', () => h.onReady(api.code));
      peer.on('error', e => {
        if (closed) return;
        if (e.type === 'unavailable-id') { peer.destroy(); api.code = h.newCode(); create(); return; }
        if (e.type === 'peer-unavailable') return;
        h.onError(e.type || String(e));
      });
      peer.on('disconnected', () => {
        // lost the signalling server; open games keep running, but new joins need it back
        if (!closed) setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000);
      });
      peer.on('connection', conn => {
        let pid = null;
        conn.on('data', m => {
          if (!m || typeof m !== 'object') return;
          conn._last = Date.now();
          if (m.t === 'hello') {
            const r = h.onHello(m);
            if (!r || !r.ok) {
              try { conn.send({ t: 'reject', reason: (r && r.reason) || 'Cannot join' }); } catch (e) {}
              setTimeout(() => { try { conn.close(); } catch (e) {} }, 600);
              return;
            }
            pid = m.pid;
            const old = conns.get(pid);
            if (old && old !== conn) { old._replaced = true; try { old.close(); } catch (e) {} }
            conns.set(pid, conn);
            h.onJoined(pid);
            return;
          }
          if (!pid || m.t === 'pong') return;
          h.onIntent(pid, m);
        });
        conn.on('close', () => {
          if (pid && conns.get(pid) === conn) { conns.delete(pid); h.onLeave(pid); }
        });
        conn.on('error', () => {});
      });
    }
    create();

    // heartbeat: phones that sleep never send "close", so ping and drop silent ones
    const hb = setInterval(() => {
      const now = Date.now();
      for (const [pid, c] of conns) {
        if (now - (c._last || now) > 20000) { conns.delete(pid); try { c.close(); } catch (e) {} h.onLeave(pid); }
        else if (c.open) { try { c.send({ t: 'ping' }); } catch (e) {} }
      }
    }, 4000);
    return api;
  };

  NET.join = function (code, h) {
    let peer = null, conn = null, closed = false, everOpen = false, tries = 0, retrying = false, lastMsg = Date.now();
    const api = {
      send(m) { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } },
      close() { closed = true; clearInterval(wd); clearTimeout(firstTO); try { conn && conn.close(); } catch (e) {} if (peer) peer.destroy(); },
    };
    function fail(why) { if (closed) return; h.onError(why); api.close(); }
    function retry() {
      if (closed || retrying) return;
      retrying = true; tries++;
      h.onStatus('reconnecting');
      if (tries > 15) { fail('lost'); return; }
      try { conn && conn.close(); } catch (e) {}
      setTimeout(() => { retrying = false; if (!closed) connect(); }, Math.min(800 * tries, 4000));
    }
    function openConn() {
      conn = peer.connect(PREFIX + code, { reliable: true });
      const c = conn;
      c.on('open', () => { everOpen = true; tries = 0; lastMsg = Date.now(); clearTimeout(firstTO); h.onStatus(''); h.onOpen(); });
      c.on('data', m => {
        lastMsg = Date.now();
        if (m && m.t === 'ping') { try { c.send({ t: 'pong' }); } catch (e) {} return; }
        h.onMsg(m);
      });
      c.on('close', () => { if (c === conn && !closed) retry(); });
      c.on('error', () => {});
    }
    function connect() {
      if (peer && !peer.destroyed && peer.open) { openConn(); return; }
      if (peer) { try { peer.destroy(); } catch (e) {} }
      peer = new root.Peer(OPTS);
      peer.on('open', openConn);
      peer.on('error', e => {
        if (closed) return;
        if (e.type === 'peer-unavailable') { if (!everOpen) fail('notfound'); else if (tries >= 2) fail('lost'); else retry(); return; }
        if (e.type === 'browser-incompatible') { fail('browser'); return; }
        retry();
      });
      peer.on('disconnected', () => { if (!closed) { try { peer.reconnect(); } catch (e) {} } });
    }
    connect();
    const firstTO = setTimeout(() => { if (!everOpen) fail('timeout'); }, 20000);
    const wd = setInterval(() => { if (everOpen && !closed && !retrying && Date.now() - lastMsg > 11000) retry(); }, 2000);
    return api;
  };

  root.NET = NET;
})(window);
