/* Kopitiam 21 — 8-bit sound effects + chiptune loop, all synthesized (no audio files) */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfxGain = null, musGain = null;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('k21:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('k21:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const AU = { sfxOn: store.get('sfx', true), musicOn: store.get('music', true) };

  function unlock() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = AU.sfxOn ? 0.5 : 0; sfxGain.connect(master);
      musGain = ctx.createGain(); musGain.gain.value = AU.musicOn ? 0.16 : 0; musGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(f, t0, dur, type, vol, slide, out) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(out || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(t0, dur, vol, hp, out) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out || sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

  const SFX = {
    click: t => tone(1200, t, 0.04, 'square', 0.15),
    card: t => { noise(t, 0.05, 0.25, 2500); tone(1400, t, 0.03, 'triangle', 0.15); },
    flip: t => { noise(t, 0.04, 0.2, 3000); noise(t + 0.06, 0.04, 0.2, 3000); tone(900, t + 0.05, 0.05, 'square', 0.1, 1500); },
    chip: t => { tone(2400, t, 0.05, 'triangle', 0.25); tone(3100, t + 0.05, 0.07, 'triangle', 0.2); },
    coin: t => { tone(N(83), t, 0.08, 'square', 0.18); tone(N(88), t + 0.08, 0.22, 'square', 0.18); },
    win: t => [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.08, 0.12, 'square', 0.2)),
    bj: t => {
      [67, 72, 76, 79, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.09, i === 6 ? 0.5 : 0.12, 'square', 0.22));
      [55, 60, 64].forEach((n, i) => tone(N(n), t + 0.54 + i * 0.01, 0.5, 'triangle', 0.2));
    },
    lose: t => { tone(N(64), t, 0.18, 'square', 0.18); tone(N(60), t + 0.18, 0.3, 'square', 0.18); },
    bust: t => { tone(300, t, 0.45, 'sawtooth', 0.22, 60); noise(t, 0.3, 0.2, 400); },
    turn: t => { tone(N(81), t, 0.12, 'square', 0.2); tone(N(88), t + 0.12, 0.25, 'square', 0.2); },
    tick: t => tone(1700, t, 0.02, 'square', 0.1),
    shuffle: t => { for (let i = 0; i < 10; i++) noise(t + i * 0.06, 0.05, 0.18, 2000 + (i % 3) * 800); },
    pop: t => tone(380, t, 0.08, 'sine', 0.3, 900),
    roll: t => tone(N(76 + Math.floor(Math.random() * 6)), t, 0.05, 'square', 0.15),
    tada: t => { [72, 76, 79].forEach(n => tone(N(n), t, 0.12, 'square', 0.15)); [72, 76, 79, 84].forEach(n => tone(N(n), t + 0.15, 0.5, 'square', 0.15)); },
    whoosh: t => { noise(t, 0.25, 0.22, 900); tone(500, t, 0.22, 'sine', 0.08, 1400); },
    splash: t => { noise(t, 0.35, 0.3, 300); tone(220, t, 0.18, 'sine', 0.25, 90); [79, 84].forEach((n, i) => tone(N(n), t + 0.12 + i * 0.07, 0.12, 'square', 0.12)); },
    crack: t => { noise(t, 0.06, 0.35, 2500); noise(t + 0.05, 0.12, 0.25, 600); tone(160, t + 0.02, 0.08, 'square', 0.12, 80); },
    clink: t => { tone(2600, t, 0.12, 'triangle', 0.25); tone(3900, t, 0.08, 'triangle', 0.12); },
    deny: t => { tone(180, t, 0.08, 'square', 0.15); tone(150, t + 0.09, 0.12, 'square', 0.15); },
  };

  // continuous pouring sound
  let pourSrc = null, pourGain = null;
  AU.pour = function (on) {
    if (!ctx) return;
    if (on && !pourSrc && AU.sfxOn) {
      if (!noiseBuf) noise(ctx.currentTime, 0.01, 0.0001, 1000);
      pourSrc = ctx.createBufferSource(); pourSrc.buffer = noiseBuf; pourSrc.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
      pourGain = ctx.createGain(); pourGain.gain.setValueAtTime(0.0001, ctx.currentTime); pourGain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.08);
      pourSrc.connect(f); f.connect(pourGain); pourGain.connect(sfxGain); pourSrc.start();
    } else if (!on && pourSrc) {
      const s = pourSrc, g = pourGain; pourSrc = null;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { try { s.stop(); } catch (e) {} }, 300);
    }
  };

  AU.unlock = unlock;
  AU.play = function (name) {
    if (!ctx || !AU.sfxOn || !SFX[name]) return;
    try { SFX[name](ctx.currentTime + 0.01); } catch (e) {}
  };

  // ---------- chiptune loop (C pentatonic, kopitiam-cheerful) ----------
  const _ = null;
  const LEAD = [
    76, _, 79, _, 81, 79, 76, _, 74, _, 76, 79, 76, 74, 72, _,
    76, _, 79, _, 81, 84, 81, 79, 76, 74, 72, 74, 76, _, _, _,
    69, _, 72, _, 74, 72, 69, _, 67, _, 69, 72, 74, 76, 74, _,
    76, 79, 81, 79, 76, 74, 72, 74, 72, _, _, _, _, _, 67, 69,
  ];
  const BASS = [48, 43, 45, 43, 41, 48, 43, 48];
  const BPM = 112, STEP = 60 / BPM / 2;
  let musTimer = null, nextT = 0, stepI = 0;
  function sched() {
    while (nextT < ctx.currentTime + 0.2) {
      const i = stepI % LEAD.length;
      const n = LEAD[i];
      if (n) tone(N(n), nextT, STEP * 0.9, 'square', 0.22, null, musGain);
      if (i % 4 === 0) { const b = BASS[Math.floor(i / 8) % BASS.length]; tone(N(b), nextT, STEP * 1.8, 'triangle', 0.5, null, musGain); }
      if (i % 4 === 2) { const b = BASS[Math.floor(i / 8) % BASS.length] + 12; tone(N(b), nextT, STEP * 0.9, 'triangle', 0.35, null, musGain); }
      if (i % 2 === 1) noise(nextT, 0.03, 0.12, 6000, musGain);
      nextT += STEP; stepI++;
    }
  }
  AU.startMusic = function () {
    unlock();
    if (!ctx || musTimer) return;
    nextT = ctx.currentTime + 0.1; stepI = 0;
    musTimer = setInterval(sched, 50);
  };
  AU.stopMusic = function () { if (musTimer) clearInterval(musTimer); musTimer = null; };
  AU.toggleMusic = function () {
    AU.musicOn = !AU.musicOn; store.set('music', AU.musicOn);
    if (musGain) musGain.gain.setTargetAtTime(AU.musicOn ? 0.16 : 0, ctx.currentTime, 0.05);
    return AU.musicOn;
  };
  AU.toggleSfx = function () {
    AU.sfxOn = !AU.sfxOn; store.set('sfx', AU.sfxOn);
    if (sfxGain) sfxGain.gain.setTargetAtTime(AU.sfxOn ? 0.5 : 0, ctx.currentTime, 0.02);
    return AU.sfxOn;
  };
  root.AU = AU;
})(window);
