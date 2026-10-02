// Efectos de sonido sintetizados con WebAudio: no hay archivos de audio que cargar.
// create() devuelve un motor; en el navegador el AudioContext se crea con el primer toque (las normas de autoplay).
// Para pruebas se le puede inyectar un OfflineAudioContext: create({ ctx }).
(function (root) {
  'use strict';
  function create(opts) {
    opts = opts || {};
    let ctx = opts.ctx || null, master = null, noiseBuf = null, muted = !!opts.muted, vol = opts.volume == null ? 0.7 : opts.volume;
    const loops = {};

    function ensure() {
      if (master) return true;
      if (!ctx) {
        const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
        try { ctx = new AC(); } catch (e) { return false; }
      }
      // Todo se monta con variables locales: el motor solo queda "listo" al final, así un fallo a medias no lo deja roto.
      const comp = ctx.createDynamicsCompressor();      // evita que varios sonidos a la vez saturen
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      const m = ctx.createGain(); m.gain.value = muted ? 0 : vol; m.connect(comp);
      let tail = comp;
      try {   // limitador suave: aunque suenen muchos efectos a la vez, la señal no pasa de ±1. Es opcional: si falla, se sigue sin él.
        const lim = ctx.createWaveShaper(), curve = new Float32Array(2048), knee = 0.6;   // lineal hasta 0,6 y codo suave por encima
        for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee))); }
        lim.curve = curve; try { lim.oversample = '2x'; } catch (e) { /* no pasa nada */ }
        comp.connect(lim); tail = lim;
      } catch (e) { try { comp.disconnect(); } catch (e2) { /* nada */ } tail = comp; }
      tail.connect(ctx.destination);
      const sr = ctx.sampleRate, n = Math.floor(sr * 2), nb = ctx.createBuffer(1, n, sr);
      const d = nb.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = nb; master = m;
      return true;
    }
    const T = () => ctx.currentTime + 0.005;
    const bus = g => { const b = ctx.createGain(); b.gain.value = g; b.connect(master); return b; };

    // Un tono con envolvente (ataque lineal, caída exponencial). f2 = glissando final; lp/lp2 = filtro paso bajo (y su barrido)
    function tone(out, o) {
      const t = T() + (o.at || 0), dur = o.dur, a = Math.min(o.attack == null ? 0.008 : o.attack, dur * 0.5);
      const osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + dur); osc.connect(f); node = f; }
      node.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.05);
    }
    // Ruido filtrado con envolvente
    function noise(out, o) {
      const t = T() + (o.at || 0), dur = o.dur, a = Math.min(o.attack == null ? 0.005 : o.attack, dur * 0.5);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur); f.Q.value = o.q || 0.8;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    }

    const SOUNDS = {
      click: o => tone(o, { f: 1500, f2: 900, type: 'square', dur: .04, vol: .1, lp: 3000 }),
      vote: o => tone(o, { f: 620, f2: 380, dur: .08, vol: .22 }),
      task: o => { tone(o, { f: 988, dur: .22, vol: .2 }); tone(o, { f: 1319, dur: .5, vol: .22, at: .09 }); tone(o, { f: 2638, dur: .3, vol: .04, at: .09, type: 'triangle' }); },
      kill: o => {
        noise(o, { type: 'lowpass', f: 1400, f2: 90, q: 1, dur: .35, vol: .6, attack: .004 });
        tone(o, { f: 190, f2: 38, dur: .42, vol: .6, attack: .004 });
        tone(o, { f: 1100, f2: 240, type: 'sawtooth', dur: .14, vol: .16, lp: 2500 });
        noise(o, { type: 'highpass', f: 3200, q: .5, dur: .07, vol: .3, at: .02 });
      },
      report: o => { for (let i = 0; i < 3; i++) { tone(o, { f: i % 2 ? 380 : 500, type: 'square', dur: .26, vol: .2, at: i * .27, lp: 2200 }); tone(o, { f: i % 2 ? 190 : 250, type: 'square', dur: .26, vol: .08, at: i * .27, lp: 900 }); } },
      eject: o => {
        noise(o, { f: 160, f2: 2800, q: 1.4, dur: 2.2, vol: .3, attack: .6 });
        tone(o, { f: 150, f2: 32, dur: 2.2, vol: .38, attack: .2, lp: 300 });
        tone(o, { f: 900, f2: 120, type: 'triangle', dur: 2, vol: .05, attack: .3 });
      },
      ejectImp: o => [523, 659, 784, 1046].forEach((f, i) => tone(o, { f, type: 'triangle', dur: .55, vol: .22, at: i * .15, attack: .01 })),
      ejectNo: o => { [330, 262, 220].forEach((f, i) => tone(o, { f, type: 'triangle', dur: .7, vol: .22, at: i * .28 })); tone(o, { f: 110, dur: 1.1, vol: .14, attack: .1 }); },
      warn: o => { tone(o, { f: 720, type: 'square', dur: .13, vol: .16, lp: 2600 }); tone(o, { f: 720, type: 'square', dur: .13, vol: .16, at: .22, lp: 2600 }); },
      fixed: o => [523, 659, 784].forEach((f, i) => tone(o, { f, dur: .5, vol: .2, at: i * .1 })),
      vent: o => {
        noise(o, { type: 'highpass', f: 1800, q: .6, dur: .09, vol: .32 });
        tone(o, { f: 330, type: 'square', dur: .14, vol: .12, lp: 1200 }); tone(o, { f: 465, type: 'square', dur: .14, vol: .1, at: .04, lp: 1200 });
        tone(o, { f: 110, f2: 70, dur: .3, vol: .22 });
      },
      door: o => { tone(o, { f: 96, f2: 44, dur: .38, vol: .55, attack: .004 }); noise(o, { type: 'lowpass', f: 500, q: .7, dur: .2, vol: .35, attack: .004 }); },
      lights: o => tone(o, { f: 420, f2: 55, type: 'sawtooth', dur: .95, vol: .22, lp: 900, lp2: 120, attack: .02 }),
      static: o => { noise(o, { f: 1800, q: .5, dur: .45, vol: .22 }); [.1, .24, .36].forEach(a => noise(o, { type: 'highpass', f: 2800, dur: .03, vol: .22, at: a })); },
      camOn: o => { tone(o, { f: 1800, dur: .07, vol: .12 }); noise(o, { f: 2500, q: .5, dur: .3, vol: .13, at: .02 }); },
      introCrew: o => {
        noise(o, { f: 200, f2: 4200, q: 1.2, dur: 1.2, vol: .14, attack: .9 });
        [220, 277, 330, 440].forEach(f => tone(o, { f, dur: 3.0, vol: .09, attack: 1.0 }));
        tone(o, { f: 110, f2: 55, dur: .7, vol: .4, at: 1.2 }); tone(o, { f: 880, dur: 1.2, vol: .1, at: 1.35 });
      },
      introImp: o => {
        tone(o, { f: 55, type: 'sawtooth', dur: 3.0, vol: .15, attack: .7, lp: 300 }); tone(o, { f: 58.3, type: 'sawtooth', dur: 3.0, vol: .12, attack: .7, lp: 300 });
        tone(o, { f: 77, dur: 3.0, vol: .12, attack: .9 });
        tone(o, { f: 62, f2: 28, dur: .9, vol: .55, at: 1.2 }); noise(o, { type: 'lowpass', f: 320, dur: .6, vol: .32, at: 1.2 });
        tone(o, { f: 392, dur: .9, vol: .08, at: 2.0, attack: .05 }); tone(o, { f: 554, dur: .9, vol: .08, at: 2.0, attack: .05 });
      },
      win: o => { [523, 659, 784, 1046, 1319].forEach((f, i) => tone(o, { f, type: 'triangle', dur: .45, vol: .2, at: i * .12 })); [523, 659, 784].forEach(f => tone(o, { f, type: 'triangle', dur: 1.0, vol: .1, at: .62 })); },
      lose: o => { [440, 349, 294, 220].forEach((f, i) => tone(o, { f, type: 'triangle', dur: .55, vol: .22, at: i * .22 })); tone(o, { f: 110, dur: 1.2, vol: .18, at: .5, attack: .1 }); }
    };
    const DUR = { click: .1, vote: .15, task: .7, kill: .6, report: 1.1, eject: 2.5, ejectImp: 1.1, ejectNo: 1.4, warn: .45, fixed: .8, vent: .45, door: .5, lights: 1.1, static: .55, camOn: .4, introCrew: 3.4, introImp: 3.4, win: 1.6, lose: 1.6 };

    // Sonidos continuos (se paran a mano): sirena de crisis y zumbido de las cámaras
    const LOOPS = {
      alarm: () => {
        const b = bus(1), o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = T();
        o.type = 'sawtooth'; o.frequency.value = 520; lfo.type = 'square'; lfo.frequency.value = 1.5; depth.gain.value = 150; lfo.connect(depth); depth.connect(o.frequency);
        f.type = 'lowpass'; f.frequency.value = 2400; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.16, t + .15);
        o.connect(f); f.connect(g); g.connect(b); o.start(t); lfo.start(t);
        return { gain: g, nodes: [o, lfo] };
      },
      camhum: () => {
        const b = bus(1), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain(), t = T();
        src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = .3; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.05, t + .2);
        o.type = 'sine'; o.frequency.value = 50; og.gain.value = .05; src.connect(f); f.connect(g); g.connect(b); o.connect(og); og.connect(b); src.start(t); o.start(t);
        return { gain: g, nodes: [src, o] };
      }
    };

    const api = {
      names: Object.keys(SOUNDS), loopNames: Object.keys(LOOPS), durations: DUR,
      get ctx() { return ctx; },
      unlock() { if (!ensure()) return false; if (ctx.resume && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* sin permiso todavía */ } } return true; },
      // dist = distancia (m) al origen del sonido: más lejos, más bajo
      play(name, o) {
        const fn = SOUNDS[name]; if (!fn || muted || !ensure()) return false;
        if (ctx.resume && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ... */ } }
        const g = o && o.dist != null ? Math.max(0.06, 1 / (1 + o.dist / 9)) : 1;
        try { fn(bus(g * (o && o.gain != null ? o.gain : 1))); } catch (e) { return false; }
        return true;
      },
      loopStart(name) {
        if (loops[name] || !LOOPS[name] || muted || !ensure()) return false;
        try { loops[name] = LOOPS[name](); } catch (e) { return false; } return true;
      },
      loopStop(name) {
        const l = loops[name]; if (!l) return; delete loops[name];
        try { const t = ctx.currentTime; l.gain.gain.cancelScheduledValues(t); l.gain.gain.setValueAtTime(Math.max(0.0001, l.gain.gain.value), t); l.gain.gain.exponentialRampToValueAtTime(0.0001, t + .2); l.nodes.forEach(n => n.stop(t + .25)); } catch (e) { /* ya parado */ }
      },
      stopAll() { Object.keys(loops).forEach(n => api.loopStop(n)); },
      setMuted(m) { muted = !!m; if (muted) api.stopAll(); if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, .02); },
      isMuted() { return muted; },
      setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.setTargetAtTime(vol, ctx.currentTime, .02); }
    };
    return api;
  }
  const out = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.Sfx = out;
})(typeof window !== 'undefined' ? window : this);
