/* Kopitiam 21 — networking over a public MQTT relay (WebSocket on port 443-style TLS).
   Works on any network, no account needed: every phone talks to the relay, not to each other.
   The host's browser still runs the game; the relay only passes messages along. */
(function (root) {
  'use strict';
  const NS = 'kopitiam21/v2/';
  const CFG = root.K21_CONFIG || {};
  const qs = new URLSearchParams(root.location.search);
  const BROKERS = qs.get('broker') ? [qs.get('broker')] : (CFG.brokers && CFG.brokers.length ? CFG.brokers : [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
  ]);
  const NET = {};
  const T = code => ({
    host: NS + code + '/host',   // retained "table is open" marker
    toHost: NS + code + '/h',    // players -> host
    all: NS + code + '/all',     // host -> everyone
    to: pid => NS + code + '/c/' + pid, // host -> one player
  });
  const enc = o => JSON.stringify(o);
  const dec = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch (e) { return null; } };
  const rid = () => Math.random().toString(36).slice(2, 10);

  function connect(url, opts) {
    return root.mqtt.connect(url, Object.assign({
      clientId: 'k21_' + rid(), clean: true, keepalive: 20, reconnectPeriod: 2000, connectTimeout: 8000, protocolVersion: 4,
    }, opts || {}));
  }

  // Connect to the first relay that answers.
  function firstBroker(makeOpts, onClient, onFail) {
    let i = 0;
    const tryNext = () => {
      if (i >= BROKERS.length) { onFail('network'); return; }
      const url = BROKERS[i++];
      const c = connect(url, makeOpts(url));
      let ok = false;
      const to = setTimeout(() => { if (!ok) { c.end(true); tryNext(); } }, 9000);
      c.once('connect', () => { ok = true; clearTimeout(to); onClient(c, url); });
      c.on('error', () => {});
    };
    tryNext();
  }

  // ---------- host ----------
  NET.host = function (code, h) {
    let cl = null, t = T(code), closed = false;
    const seen = new Map(); // pid -> last message time
    const api = {
      code,
      broadcast(msg) { if (cl && cl.connected) cl.publish(t.all, enc(msg), { qos: 1 }); },
      send(pid, msg) { if (cl && cl.connected) cl.publish(t.to(pid), enc(msg), { qos: 1 }); },
      close() {
        closed = true; clearInterval(hb);
        if (cl) { try { cl.publish(t.all, enc({ t: 'closed' }), { qos: 1 }); cl.publish(t.host, '', { retain: true, qos: 1 }, () => cl.end()); } catch (e) {} setTimeout(() => { try { cl.end(true); } catch (e) {} }, 800); }
      },
    };

    function open(c) {
      cl = c;
      // make sure nobody else is using this code
      let taken = false;
      const probe = (topic, payload) => { if (topic === t.host && payload && payload.length) { const m = dec(payload); if (m && m.open) taken = true; } };
      cl.on('message', probe);
      cl.subscribe(t.host, { qos: 1 });
      setTimeout(() => {
        cl.removeListener('message', probe);
        cl.unsubscribe(t.host);
        if (taken) {
          // code in use: reconnect with a fresh code (the will must point at our own marker)
          cl.end(true); cl = null;
          api.code = code = h.newCode(); t = T(code);
          firstBroker(() => ({ will: { topic: t.host, payload: '', retain: true, qos: 1 } }), open, e => h.onError(e));
          return;
        }
        start();
      }, 1200);
    }
    function announce() { cl.publish(t.host, enc({ open: true, ts: Date.now() }), { retain: true, qos: 1 }); }
    function start() {
      cl.subscribe(t.toHost, { qos: 1 }, err => {
        if (err) { h.onError('subscribe'); return; }
        announce();
        h.onReady(code);
      });
      cl.on('message', (topic, payload) => {
        if (topic !== t.toHost || closed) return;
        const w = dec(payload); if (!w || !w.pid || !w.m) return;
        const pid = String(w.pid).slice(0, 24), m = w.m;
        if (m.t === 'bye') { if (seen.delete(pid)) h.onLeave(pid); return; }
        if (m.t === 'hello') {
          const r = h.onHello(Object.assign({}, m, { pid }));
          if (!r || !r.ok) { api.send(pid, { t: 'reject', reason: (r && r.reason) || 'Cannot join' }); return; }
          const fresh = !seen.has(pid);
          seen.set(pid, Date.now());
          api.send(pid, { t: 'welcome' });
          if (fresh) h.onJoined(pid);
          return;
        }
        if (!seen.has(pid)) return;
        seen.set(pid, Date.now());
        if (m.t === 'pong') return;
        h.onIntent(pid, m);
      });
      cl.on('connect', () => { if (!closed) announce(); }); // after a reconnect
      cl.on('offline', () => h.onStatus && h.onStatus('reconnecting'));
      cl.on('reconnect', () => h.onStatus && h.onStatus('reconnecting'));
      cl.on('connect', () => h.onStatus && h.onStatus(''));
    }
    // heartbeat: tell players we're alive, drop players who went silent
    const hb = setInterval(() => {
      if (!cl || !cl.connected) return;
      api.broadcast({ t: 'ping' });
      const now = Date.now();
      for (const [pid, last] of seen) if (now - last > 25000) { seen.delete(pid); h.onLeave(pid); }
    }, 4000);

    firstBroker(() => ({ will: { topic: t.host, payload: '', retain: true, qos: 1 } }), open, e => h.onError(e));
    return api;
  };

  // ---------- player ----------
  NET.join = function (code, h, pid) {
    const t = T(code);
    let cl = null, closed = false, everOpen = false, welcomed = false, lastHost = Date.now(), goneTimer = null;
    const api = {
      send(m) { if (cl && cl.connected) cl.publish(t.toHost, enc({ pid, m }), { qos: 1 }); },
      close() {
        closed = true; clearInterval(wd); clearTimeout(firstTO); clearTimeout(goneTimer);
        if (cl) { try { api.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { cl.end(true); } catch (e) {} }, 300); }
      },
    };
    function fail(why) { if (closed) return; h.onError(why); api.close(); }
    const brokers = BROKERS.slice();
    function tryBroker(i) {
      if (closed) return;
      if (i >= brokers.length) { fail(everOpen ? 'lost' : sawBroker ? 'notfound' : 'network'); return; }
      const c = connect(brokers[i], { will: { topic: t.toHost, payload: enc({ pid, m: { t: 'bye' } }), qos: 1 } });
      let found = false, connected = false;
      const to = setTimeout(() => { if (!found) { c.end(true); tryBroker(i + 1); } }, 9000);
      c.on('error', () => {});
      c.once('connect', () => {
        connected = true; sawBroker = true;
        c.subscribe([t.host, t.all, t.to(pid)], { qos: 1 });
      });
      c.on('message', (topic, payload) => {
        if (closed) return;
        if (topic === t.host) {
          const m = payload && payload.length ? dec(payload) : null;
          if (m && m.open) {
            lastHost = Date.now(); clearTimeout(goneTimer); goneTimer = null;
            if (!found) { found = true; clearTimeout(to); cl = c; hello(); }
          } else if (found && everOpen && !goneTimer) {
            // host vanished; give it a moment to come back
            h.onStatus('reconnecting');
            goneTimer = setTimeout(() => fail('lost'), 15000);
          } else if (!found) {
            clearTimeout(to); c.end(true); tryBroker(i + 1);
          }
          return;
        }
        if (c !== cl) return;
        const m = dec(payload); if (!m) return;
        lastHost = Date.now();
        if (goneTimer) { clearTimeout(goneTimer); goneTimer = null; h.onStatus(''); }
        if (m.t === 'ping') { api.send({ t: 'pong' }); return; }
        if (m.t === 'closed') { fail('lost'); return; }
        if (m.t === 'welcome') { welcomed = true; if (!everOpen) { everOpen = true; clearTimeout(firstTO); } h.onStatus(''); return; }
        h.onMsg(m);
      });
      // no retained "open" marker shows up -> no table on this relay
      c.once('connect', () => setTimeout(() => { if (!found && !closed) { clearTimeout(to); c.end(true); tryBroker(i + 1); } }, 3500));
      c.on('offline', () => { if (c === cl && !closed) h.onStatus('reconnecting'); });
      c.on('connect', () => { if (c === cl && !closed && everOpen) hello(); }); // re-join after a blip
    }
    let sawBroker = false;
    function hello() { h.onOpen(); }
    tryBroker(0);
    const firstTO = setTimeout(() => { if (!everOpen) fail(sawBroker ? 'timeout' : 'network'); }, 25000);
    const wd = setInterval(() => {
      if (!everOpen || closed) return;
      if (Date.now() - lastHost > 20000 && !goneTimer) { h.onStatus('reconnecting'); goneTimer = setTimeout(() => fail('lost'), 12000); }
    }, 3000);
    return api;
  };

  root.NET = NET;
})(window);
