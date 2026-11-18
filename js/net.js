/* Kopitiam 21 — networking over free public MQTT relays (secure WebSocket).
   Every phone talks to a relay, not to each other, so it works on any Wi-Fi or mobile data.
   The host announces the table on ALL relays at once; players use whichever relay they reach.
   The host's browser still runs the game; relays only pass messages along. */
(function (root) {
  'use strict';
  const NS = 'kopitiam21/v3/';
  const CFG = root.K21_CONFIG || {};
  const qs = new URLSearchParams(root.location.search);
  const BROKERS = qs.get('broker') ? qs.getAll('broker') : (CFG.brokers && CFG.brokers.length ? CFG.brokers : [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
  ]);
  const NET = { BROKERS };
  const T = code => ({
    host: NS + code + '/host',          // retained "table is open" marker
    toHost: NS + code + '/h',           // players -> host
    all: NS + code + '/all',            // host -> everyone
    to: pid => NS + code + '/c/' + pid, // host -> one player
  });
  const enc = o => JSON.stringify(o);
  const dec = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch (e) { return null; } };
  const rid = () => Math.random().toString(36).slice(2, 10);
  const short = url => { try { const p = new URL(url).hostname.split('.'); return p.length > 1 ? p[p.length - 2] : p[0]; } catch (e) { return url; } };
  NET.short = short;

  function connect(url, opts) {
    const c = root.mqtt.connect(url, Object.assign({
      clientId: 'k21_' + rid(), clean: true, keepalive: 20, reconnectPeriod: 3000, connectTimeout: 10000, protocolVersion: 4,
    }, opts || {}));
    c.on('error', e => console.warn('[relay]', short(url), e && e.message));
    return c;
  }

  // ---------- host ----------
  NET.host = function (code, h) {
    let t = T(code), closed = false, readyFired = false;
    const links = [];
    const seen = new Map(); // pid -> last message time
    const api = {
      code, relays: [],
      broadcast(msg) { const p = enc(msg); for (const l of links) if (l.ready && l.c.connected) l.c.publish(t.all, p, { qos: 1 }); },
      send(pid, msg) { const p = enc(msg); for (const l of links) if (l.ready && l.c.connected) l.c.publish(t.to(pid), p, { qos: 1 }); },
      close() {
        closed = true; clearInterval(hb); clearTimeout(failTO);
        for (const l of links) {
          try { if (l.c.connected) { l.c.publish(t.all, enc({ t: 'closed' }), { qos: 1 }); l.c.publish(t.host, '', { retain: true, qos: 1 }); } } catch (e) {}
          setTimeout(() => { try { l.c.end(true); } catch (e) {} }, 700);
        }
      },
    };
    const refreshRelays = () => { api.relays = links.filter(l => l.ready && l.c.connected).map(l => short(l.url)); if (h.onRelays) h.onRelays(api.relays); };

    function onMsg(topic, payload) {
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
    }

    function startLink(url) {
      const l = { url, ready: false };
      l.c = connect(url, { will: { topic: t.host, payload: '', retain: true, qos: 1 } });
      l.c.on('message', onMsg);
      l.c.on('connect', () => {
        if (closed) return;
        if (h.onStatus) h.onStatus('');
        l.c.subscribe(t.toHost, { qos: 1 }, err => {
          if (err) return;
          l.c.publish(t.host, enc({ open: true, ts: Date.now() }), { retain: true, qos: 1 });
          l.ready = true;
          refreshRelays();
          if (!readyFired) { readyFired = true; clearTimeout(failTO); h.onReady(code); }
        });
      });
      l.c.on('offline', () => { l.ready = false; refreshRelays(); if (!links.some(x => x.ready) && h.onStatus) h.onStatus('reconnecting'); });
      links.push(l);
    }

    // pick a code nobody is using (checked on the first relay that answers), then go live everywhere
    function probeAndStart() {
      let decided = false, anyConnected = false;
      const probes = BROKERS.map(url => {
        const c = connect(url, { reconnectPeriod: 0 });
        c.on('connect', () => {
          c.subscribe(t.host, { qos: 1 });
          if (!anyConnected) { anyConnected = true; setTimeout(() => { if (!decided) { decided = true; done(false); } }, 1500); }
        });
        c.on('message', (topic, payload) => {
          const m = payload && payload.length ? dec(payload) : null;
          if (topic === t.host && m && m.open && !decided) { decided = true; done(true); }
        });
        return c;
      });
      function done(taken) {
        probes.forEach(c => { try { c.end(true); } catch (e) {} });
        if (closed) return;
        if (taken) { api.code = code = h.newCode(); t = T(code); probeAndStart(); return; }
        BROKERS.forEach(startLink);
      }
    }
    probeAndStart();
    const failTO = setTimeout(() => { if (!readyFired && !closed) h.onError('network'); }, 25000);

    const hb = setInterval(() => {
      if (closed) return;
      api.broadcast({ t: 'ping' });
      const now = Date.now();
      for (const [pid, last] of seen) if (now - last > 25000) { seen.delete(pid); h.onLeave(pid); }
    }, 4000);
    return api;
  };

  // ---------- player ----------
  NET.join = function (code, h, pid) {
    const t = T(code);
    let cl = null, closed = false, everOpen = false, lastHost = Date.now(), goneTimer = null, nfTO = null;
    const reached = new Set();
    const tries = [];
    const api = {
      relay: null,
      send(m) { if (cl && cl.connected) cl.publish(t.toHost, enc({ pid, m }), { qos: 1 }); },
      close() {
        closed = true; clearInterval(wd); clearTimeout(firstTO); clearTimeout(nfTO); clearTimeout(goneTimer);
        if (cl) { try { api.send({ t: 'bye' }); } catch (e) {} }
        setTimeout(() => tries.forEach(c => { try { c.end(true); } catch (e) {} }), 300);
      },
    };
    function fail(why) { if (closed) return; h.onError(why, Array.from(reached)); api.close(); }

    // try every relay at once; keep the first one that has this table
    BROKERS.forEach(url => {
      const c = connect(url, { will: { topic: t.toHost, payload: enc({ pid, m: { t: 'bye' } }), qos: 1 } });
      tries.push(c);
      c.on('connect', () => {
        reached.add(short(url));
        c.subscribe([t.host, t.all, t.to(pid)], { qos: 1 });
        if (!nfTO && !cl) nfTO = setTimeout(() => { if (!cl) fail('notfound'); }, 8000);
        if (c === cl && everOpen && !closed) h.onOpen(); // re-join after a blip
      });
      c.on('message', (topic, payload) => {
        if (closed) return;
        if (topic === t.host) {
          const m = payload && payload.length ? dec(payload) : null;
          if (m && m.open) {
            if (!cl) {
              cl = c; api.relay = short(url);
              clearTimeout(nfTO);
              tries.forEach(o => { if (o !== c) { try { o.end(true); } catch (e) {} } });
              h.onOpen();
              let n = 0;
              const again = setInterval(() => { if (everOpen || closed || ++n > 5) clearInterval(again); else h.onOpen(); }, 4000);
            }
            if (c === cl) { lastHost = Date.now(); if (goneTimer) { clearTimeout(goneTimer); goneTimer = null; h.onStatus(''); } }
          } else if (c === cl && everOpen && !goneTimer) {
            h.onStatus('reconnecting');
            goneTimer = setTimeout(() => fail('lost'), 15000);
          }
          return;
        }
        if (c !== cl) return;
        const m = dec(payload); if (!m) return;
        lastHost = Date.now();
        if (goneTimer) { clearTimeout(goneTimer); goneTimer = null; h.onStatus(''); }
        if (m.t === 'ping') { api.send({ t: 'pong' }); return; }
        if (m.t === 'closed') { fail('lost'); return; }
        if (m.t === 'welcome') { if (!everOpen) { everOpen = true; clearTimeout(firstTO); } h.onStatus(''); return; }
        h.onMsg(m);
      });
      c.on('offline', () => { if (c === cl && !closed) h.onStatus('reconnecting'); });
    });

    const firstTO = setTimeout(() => { if (!everOpen) fail(reached.size ? (cl ? 'timeout' : 'notfound') : 'network'); }, 25000);
    const wd = setInterval(() => {
      if (!everOpen || closed) return;
      if (Date.now() - lastHost > 20000 && !goneTimer) { h.onStatus('reconnecting'); goneTimer = setTimeout(() => fail('lost'), 12000); }
    }, 3000);
    return api;
  };

  root.NET = NET;
})(window);
