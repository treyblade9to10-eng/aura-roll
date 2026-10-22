'use strict';
// ---- all sounds are synthesized, no audio files ----

const Sound = (() => {
  let ctx = null, master = null, on = true, vol = .55, nbuf = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = on ? vol : 0;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(o) {
    if (!ctx || !on) return;
    const t0 = ctx.currentTime + (o.at || 0), g = ctx.createGain(), os = ctx.createOscillator();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t0);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.t);
    if (o.detune) os.detune.value = o.detune;
    const v = o.v == null ? .2 : o.v, atk = o.atk || .006;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + o.t);
    let out = os;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); out = f; }
    out.connect(g); g.connect(master); os.start(t0); os.stop(t0 + o.t + .05);
  }
  function noise(o) {
    if (!ctx || !on) return;
    const t0 = ctx.currentTime + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nbuf; src.loop = true; f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f, t0); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.t);
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(o.v || .2, t0 + (o.atk || o.t * .6)); g.gain.exponentialRampToValueAtTime(.0001, t0 + o.t);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + o.t + .05);
  }
  const N = n => 261.63 * Math.pow(2, n / 12);   // semitones above middle C
  const MAJ = [0, 4, 7, 12, 16, 19, 24], PENT = [0, 2, 4, 7, 9, 12, 14];

  return {
    init,
    get on() { return on; },
    toggle() { on = !on; if (master) master.gain.value = on ? vol : 0; return on; },
    click() { tone({ f: 620, to: 380, t: .07, type: 'triangle', v: .12 }); },
    tick(i) { tone({ f: 380 + (i % 6) * 60, t: .05, type: 'square', v: .04, lp: 1800 }); },
    deny() { tone({ f: 160, to: 110, t: .16, type: 'sawtooth', v: .1, lp: 700 }); },
    coin() { tone({ f: 1320, t: .09, type: 'square', v: .05, lp: 3000 }); tone({ f: 1760, t: .14, type: 'square', v: .05, at: .06, lp: 3000 }); },
    buy() { [0, 4, 7, 12].forEach((s, i) => tone({ f: N(s + 12), t: .16, type: 'triangle', v: .1, at: i * .05 })); },
    ach() { [0, 7, 12, 16, 19].forEach((s, i) => tone({ f: N(s + 12), t: .3, type: 'triangle', v: .1, at: i * .07 })); tone({ f: N(24), t: .7, type: 'sine', v: .08, at: .35 }); },
    biome(rare) { noise({ f: 300, to: 3000, t: 1.4, v: .12, q: .8 }); tone({ f: rare ? 70 : 110, t: 1.2, type: 'sine', v: .2 }); },
    // build-up while the reveal is charging
    charge(tier, dur) {
      noise({ f: 200 + tier * 80, to: 2500 + tier * 900, t: dur, v: .06 + tier * .02, q: 2, atk: dur * .9 });
      tone({ f: 90 + tier * 12, to: 400 + tier * 160, t: dur, type: 'sawtooth', v: .04 + tier * .008, lp: 1200, atk: dur * .8 });
      if (tier >= 3) for (let i = 0; i < 8; i++) tone({ f: N(PENT[i % 7] + 12 * (1 + (i > 3 ? 1 : 0))), t: .12, type: 'triangle', v: .05, at: dur * (.4 + i * .07) });
    },
    // cutscene build: rising drone + noise + a heartbeat that speeds up
    cutBuild(dur, tier) {
      noise({ f: 150, to: 5000 + tier * 600, t: dur, v: .09, q: 1.5, atk: dur * .95 });
      tone({ f: 55, to: 160 + tier * 14, t: dur, type: 'sawtooth', v: .06, lp: 700, atk: dur * .9 });
      let at = 0, gap = Math.max(.3, dur / 5);
      while (at < dur - .15) { tone({ f: 62, to: 38, t: .22, type: 'sine', v: .3, at }); tone({ f: 62, to: 38, t: .2, type: 'sine', v: .2, at: at + gap * .25 }); at += gap; gap = Math.max(.2, gap * .88); }
    },
    slash() { noise({ f: 5000, to: 1500, t: .18, v: .3, type: 'highpass', atk: .005 }); tone({ f: 900, to: 200, t: .15, type: 'sawtooth', v: .08, lp: 2500 }); },
    zap() { noise({ f: 3000, to: 400, t: .35, v: .35, type: 'bandpass', q: .6, atk: .004 }); tone({ f: 80, to: 40, t: .5, type: 'sine', v: .3 }); },
    reveal(tier) {
      const base = [0, 0, -3, -5, -7, -5, -2, 0][tier];
      if (tier === 0) { tone({ f: N(base + 7), t: .25, type: 'triangle', v: .12 }); return; }
      const notes = MAJ.slice(0, Math.min(7, 2 + tier));
      notes.forEach((s, i) => tone({ f: N(base + s + 12), t: .5 + tier * .08, type: tier > 4 ? 'sawtooth' : 'triangle', v: .09 + tier * .005, at: i * (.07 - tier * .004), lp: 3500 }));
      if (tier >= 2) tone({ f: N(base - 12), t: .9, type: 'sine', v: .25 });
      if (tier >= 3) noise({ f: 1500, to: 8000, t: .8, v: .1, type: 'highpass', atk: .02 });
      if (tier >= 4) { tone({ f: 70, to: 28, t: 1.4, type: 'sine', v: .55 }); noise({ f: 400, to: 60, t: 1.2, v: .35, type: 'lowpass', atk: .01 }); }
      if (tier >= 5) [0, 7, 12, 19].forEach((s, i) => { tone({ f: N(base + s), t: 2, type: 'sawtooth', v: .05, at: .2, detune: -9 + i * 6, lp: 2400 }); });
      if (tier >= 6) { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ f: N(base + s + 12), t: 2.6, type: 'sine', v: .07, at: .35 + i * .09 })); tone({ f: 45, to: 22, t: 2.4, type: 'sine', v: .7 }); }
      if (tier >= 7) { noise({ f: 8000, to: 100, t: 3, v: .35, q: .5, atk: .02 }); [0, 12, 19, 24, 28, 31, 36].forEach((s, i) => tone({ f: N(base + s + 12), t: 3, type: 'triangle', v: .09, at: .5 + i * .14 })); }
    },
  };
})();
