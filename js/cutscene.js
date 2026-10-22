'use strict';
// ---- full-screen cutscenes for Mythic and above ----
// Every cutscene has a BUILD (style depends on the aura), an IMPACT (flash, shake, shockwaves) and a REVEAL
// (the aura at full size, name slams in). Tap to skip: first tap jumps to the impact, a later tap closes it.

const CUT_STYLE = {
  slash: ['treyblade', 'katana', 'reaper', 'worldbreak', 'samurai'],
  wings: ['celestia', 'seraph', 'archangel', 'phoenix', 'vampire', 'feather', 'ascendant'],
  rift: ['rift', 'gate', 'error404', 'null', 'segfault', 'oblivion', 'glitch', 'witching'],
  bang: ['singularity', 'bigbang', 'hypernova', 'supernova', 'infinity', 'omniverse', 'architect', 'genesis', 'voidwalker', 'monarch', 'afterlife', 'totality', 'ouroboros', 'cycle'],
  storm: ['tempest', 'thundergod', 'hurricane', 'maelstrom', 'thunder', 'stormborn'],
};
const cutStyleOf = id => { for (const k in CUT_STYLE) if (CUT_STYLE[k].includes(id)) return k; return 'converge'; };

const Cutscene = (() => {
  const TAU = Math.PI * 2, rnd = FX.rnd, dot = FX.dot, rgba = FX.rgba;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const BUILD = [0, 0, 0, 0, 0, 2.7, 3.7, 5.2], HOLD = [0, 0, 0, 0, 0, 3, 3.7, 4.8];
  const WHITE = [255, 255, 255];

  // the little figure, dim at first and brightening as the aura builds
  function figureDim(S, p) {
    const c = S.ctx; c.globalCompositeOperation = 'source-over'; c.globalAlpha = clamp(.2 + p, 0, 1);
    FX.figure(c, S.cx, S.cy, S.R, S.col[0], 0); c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
  }
  function jag(x0, y0, x1, y1, n, amp) {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u + rnd(-amp, amp), y0 + (y1 - y0) * u + rnd(-amp * .3, amp * .3)]); }
    pts.push([x1, y1]); return pts;
  }
  function strokePts(c, pts, w, col, a) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = rgba(col, a * .45); c.lineWidth = w * 3.2; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
    c.strokeStyle = rgba(WHITE, a); c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
  }

  // ------------------------------------------------------------------ build styles
  const B = {
    // energy gathers from the edges into a pulsing core
    converge(S, p, dt) {
      const { ctx: c, cx, cy, R, col } = S, diag = Math.hypot(S.W, S.H) / 2;
      S.acc = (S.acc || 0) + dt * (50 + p * 230); let n = Math.floor(S.acc); S.acc -= n;
      while (n--) S.parts.push({ a: rnd(0, TAU), r0: diag * rnd(.5, 1.1), age: 0, life: rnd(.9, 1.5), c: Math.floor(Math.random() * 3), s: rnd(.012, .03) * R });
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const q = S.parts[i]; q.age += dt; const u = q.age / q.life;
        if (u >= 1) { S.parts[i] = S.parts[S.parts.length - 1]; S.parts.pop(); continue; }
        const r = q.r0 * (1 - u * u), a = q.a + u * 2.2;
        dot(c, col[q.c], cx + Math.cos(a) * r, cy + Math.sin(a) * r * .8, q.s * (.6 + u * 1.8), .2 + u * .8);
      }
      const beat = .5 + .5 * Math.sin(S.t * (4 + p * 14));
      dot(c, col[0], cx, cy, R * (.15 + p * .9) * (.9 + .1 * beat), .25 + p * .7); dot(c, WHITE, cx, cy, R * (.05 + p * .25), p * .8);
      figureDim(S, p);
    },
    // blade slashes cut the screen, the last two cross
    slash(S, p, dt) {
      const { ctx: c, cx, cy, R, col } = S, diag = Math.hypot(S.W, S.H);
      if (!S.slashes) {
        const N = [0, 0, 0, 0, 0, 4, 6, 8][S.tier]; S.slashes = [];
        for (let i = 0; i < N; i++) S.slashes.push({ at: .1 + .66 * i / N, a: rnd(-.9, .9) + (i % 2 ? Math.PI : 0), ox: rnd(-.3, .3), oy: rnd(-.25, .25) });
        S.slashes.push({ at: .84, a: -.7, ox: 0, oy: 0 }, { at: .88, a: .7, ox: 0, oy: 0 });
      }
      figureDim(S, p * .8);
      for (const s of S.slashes) {
        if (p < s.at) continue;
        if (!s.fired) { s.fired = true; Sound.slash(); S.kick = 1; S.flash = Math.max(S.flash, .22); s.x = cx + s.ox * S.W; s.y = cy + s.oy * S.H; }
        const u = clamp((p - s.at) / .07, 0, 1), fade = Math.max(.18, 1 - (p - s.at) / .35), L = diag * .7;
        const dx = Math.cos(s.a) * L, dy = Math.sin(s.a) * L;
        const x0 = s.x - dx, y0 = s.y - dy, x1 = x0 + dx * 2 * u, y1 = y0 + dy * 2 * u, nx = -Math.sin(s.a) * R * .05, ny = Math.cos(s.a) * R * .05;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny, x1, y1); c.quadraticCurveTo((x0 + x1) / 2 - nx * .2, (y0 + y1) / 2 - ny * .2, x0, y0);
        c.fillStyle = rgba(col[s.a > 3 ? 1 : 0], fade * .9); c.shadowColor = rgba(col[0], 1); c.shadowBlur = R * .12; c.fill(); c.shadowBlur = 0;
        c.strokeStyle = rgba(WHITE, fade); c.lineWidth = Math.max(1.5, R * .012); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
      dot(c, col[0], cx, cy, R * (.1 + p * .6), p * .45);
    },
    // light descends, feathers fall, a halo forms
    wings(S, p, dt) {
      const { ctx: c, cx, cy, R, col, W, H } = S, bw = R * (.1 + p * .55);
      const g = c.createLinearGradient(cx - bw, 0, cx + bw, 0); g.addColorStop(0, rgba(col[2], 0)); g.addColorStop(.5, rgba(col[2], .38 * p)); g.addColorStop(1, rgba(col[2], 0));
      c.fillStyle = g; c.fillRect(cx - bw, 0, bw * 2, H);
      S.acc = (S.acc || 0) + dt * (5 + p * 16); let n = Math.floor(S.acc); S.acc -= n;
      while (n--) S.parts.push({ x: cx + rnd(-1, 1) * R * 1.3, y: -20, vy: rnd(60, 130) * H / 800, sw: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), s: rnd(.05, .1) * R, c: Math.random() < .5 ? 0 : 2, age: 0, life: rnd(4, 6) });
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const q = S.parts[i]; q.age += dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        if (q.y > H + 30) { S.parts[i] = S.parts[S.parts.length - 1]; S.parts.pop(); continue; }
        c.save(); c.translate(q.x + Math.sin(S.t * 1.4 + q.sw) * R * .18, q.y); c.rotate(q.rot); c.fillStyle = rgba(col[q.c], .75);
        c.beginPath(); c.ellipse(0, 0, q.s * .35, q.s, 0, 0, TAU); c.fill(); c.restore();
      }
      dot(c, col[0], cx, cy - R * .2, R * (.2 + p * .8), p * .45);
      figureDim(S, p);
      const h = clamp((p - .55) / .4, 0, 1);
      if (h > 0) { c.strokeStyle = rgba(col[2], h); c.lineWidth = R * .02; c.shadowColor = rgba(col[0], 1); c.shadowBlur = R * .1; c.beginPath(); c.ellipse(cx, cy - R * .66 - (1 - h) * R * .2, R * .2, R * .05, 0, 0, TAU); c.stroke(); c.shadowBlur = 0; }
    },
    // reality cracks, glitches, tears open
    rift(S, p, dt) {
      const { ctx: c, cx, cy, R, col, W, H } = S, diag = Math.hypot(W, H) / 2;
      if (!S.cracks) {
        S.cracks = [];
        for (let i = 0; i < 10; i++) {
          let a = i * TAU / 10 + rnd(-.2, .2), x = cx, y = cy; const pts = [[x, y]], len = diag / 12;
          for (let k = 0; k < 14; k++) { a += rnd(-.45, .45); x += Math.cos(a) * len * rnd(.6, 1.4); y += Math.sin(a) * len * rnd(.6, 1.4); pts.push([x, y]); }
          S.cracks.push(pts);
        }
      }
      for (const pts of S.cracks) {
        const k = Math.min(pts.length, 1 + p * 1.15 * pts.length), whole = Math.floor(k), part = k - whole, seg = pts.slice(0, whole);
        if (whole < pts.length && whole > 0) { const a = pts[whole - 1], b = pts[whole]; seg.push([a[0] + (b[0] - a[0]) * part, a[1] + (b[1] - a[1]) * part]); }
        if (seg.length > 1) strokePts(c, seg, Math.max(1.2, R * .012), col[0], .85);
      }
      const nb = Math.floor(p * p * 12);
      for (let i = 0; i < nb; i++) {
        const y = rnd(0, H), h = rnd(3, 26), off = rnd(-1, 1) * 40 * p;
        c.fillStyle = rgba(col[i % 2], .06 + .22 * p); c.fillRect(off, y, W, h); c.fillStyle = rgba(col[1], .1 + .12 * p); c.fillRect(-off, y + h * .4, W * rnd(.2, 1), h * .35);
      }
      if (p > .65) {
        const u = (p - .65) / .35, rx = R * .02 + u * R * .55;
        c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.beginPath(); c.ellipse(cx, cy, rx, rx * 2.6, 0, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(col[0], .9); c.lineWidth = R * .02; c.shadowColor = rgba(col[0], 1); c.shadowBlur = R * .15; c.beginPath(); c.ellipse(cx, cy, rx, rx * 2.6, 0, 0, TAU); c.stroke(); c.shadowBlur = 0;
      }
    },
    // a black hole drags the stars in, then collapses
    bang(S, p, dt) {
      const { ctx: c, cx, cy, R, col, W, H } = S, diag = Math.hypot(W, H) / 2;
      if (!S.stars) S.stars = Array.from({ length: 260 }, () => ({ a: rnd(0, TAU), r: rnd(.06, 1.1), s: rnd(.8, 2.2), k: Math.random() }));
      for (const q of S.stars) {
        q.r -= dt * (.05 + p * p * 1.6) * (.12 / (q.r + .12)) * 2.2; if (q.r < .05) { q.r = 1.1; q.a = rnd(0, TAU); }
        q.a += dt * (.1 + p * 1.8) / (q.r + .2) * .35;
        const trail = .01 + p * .2, x0 = cx + Math.cos(q.a) * q.r * diag, y0 = cy + Math.sin(q.a) * q.r * diag * .8, x1 = cx + Math.cos(q.a - trail * 2) * (q.r + trail) * diag, y1 = cy + Math.sin(q.a - trail * 2) * (q.r + trail) * diag * .8;
        c.strokeStyle = rgba(FX.mix(col[q.k < .5 ? 0 : 1], WHITE, .5), .35 + .5 * q.k); c.lineWidth = q.s; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
      const col2 = p > .93 ? clamp((1 - p) / .07, 0, 1) : 1, rd = R * (.1 + .3 * p) * col2;
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.beginPath(); c.arc(cx, cy, rd, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter';
      c.lineWidth = Math.max(1.5, R * .015); c.strokeStyle = rgba(col[1], .85 * col2); c.shadowColor = rgba(col[1], 1); c.shadowBlur = R * .1;
      c.beginPath(); c.ellipse(cx, cy, rd * 2.3, rd * .7, S.t * .8, 0, TAU); c.stroke();
      c.strokeStyle = rgba(col[0], .9 * col2); c.beginPath(); c.arc(cx, cy, rd * 1.12, 0, TAU); c.stroke(); c.shadowBlur = 0;
      if (p > .9) dot(c, WHITE, cx, cy, R * (.05 + (p - .9) * 6), clamp((p - .9) * 10, 0, 1));
    },
    // rain, then lightning strikes faster and faster
    storm(S, p, dt) {
      const { ctx: c, cx, cy, R, col, W, H } = S, k = H / 800;
      S.acc = (S.acc || 0) + dt * 130; let n = Math.floor(S.acc); S.acc -= n;
      while (n--) S.parts.push({ x: rnd(-.1, 1.2) * W, y: -20, vy: rnd(700, 1000) * k, len: rnd(.05, .12) * R, age: 0, life: 1.4 });
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const q = S.parts[i]; q.age += dt; q.y += q.vy * dt; q.x -= 90 * k * dt; if (q.y > H + 40) { S.parts[i] = S.parts[S.parts.length - 1]; S.parts.pop(); continue; }
        c.strokeStyle = rgba(col[0], .35); c.lineWidth = Math.max(1, R * .006); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 8 * k, q.y - q.len); c.stroke();
      }
      if (!S.bolts) S.bolts = [.1, .24, .36, .48, .58, .67, .75, .82, .89, .95].map(at => ({ at, x: rnd(.1, .9) * W, life: 0 }));
      for (const b of S.bolts) {
        if (p >= b.at && !b.fired) { b.fired = true; b.life = .3; b.pts = jag(b.x, -10, b.x + rnd(-.1, .1) * W, cy - R * .1, 12, R * .22); S.flash = Math.max(S.flash, .3 + p * .3); S.kick = .8; Sound.zap(); }
        if (b.life > 0) { b.life -= dt; strokePts(c, b.pts, Math.max(1.5, R * .02), col[1], clamp(b.life / .3, 0, 1)); }
      }
      figureDim(S, p);
    },
  };

  // ------------------------------------------------------------------ the moment of impact
  function impact(S) {
    S.impact = true; S.flash = S.tier >= 7 ? 1.6 : 1; S.kick = 1;
    Sound.reveal(S.tier); try { navigator.vibrate && navigator.vibrate(S.tier >= 6 ? [40, 30, 120] : [40]); } catch (e) { }
    S.fx.set(S.aura, S.variant); S.parts = []; S.bolts = null;
    const diag = Math.hypot(S.W, S.H);
    for (let i = 0; i < 3 + (S.tier - 5); i++) S.rings.push({ age: -i * .18, life: 1.2 + i * .25, max: diag * (.6 + i * .12), c: S.col[i % 3] });
    for (let i = 0; i < 110; i++) { const a = rnd(0, TAU), v = rnd(120, 620) * S.H / 800; S.burst.push({ x: S.cx, y: S.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rnd(.8, 2), c: i % 3, s: rnd(.02, .05) * S.R }); }
    if (S.style === 'storm') { S.bolts = null; S.bolt = { life: .6, pts: jag(S.cx, -10, S.cx, S.cy - S.R * .2, 14, S.R * .25) }; }
    const i = S.info, txt = S.host.querySelector('.ctxt');
    txt.innerHTML = '<div class="c1">' + esc(i.tier.name.toUpperCase()) + (S.res.variant.id !== 'normal' ? ' &middot; ' + esc(S.res.variant.name.toUpperCase()) : '') + '</div>' +
      '<div class="c2 nmx t-' + i.tier.id + '">' + esc(i.aura.name.toUpperCase()) + '</div><div class="c3">' + fmtOdds(S.res.eff || i.eff) + '</div>' + (S.res.isNew ? '<div class="c5">NEW AURA</div>' : '');
  }

  // ------------------------------------------------------------------ the reveal after impact
  function reveal(S, a, q, dt) {
    const { ctx: c, cx, cy, W, H, col } = S, RR = S.R * (1 + .12 * ease(a * 1.2)), diag = Math.hypot(W, H);
    c.globalCompositeOperation = 'source-over';
    const g = c.createRadialGradient(cx, cy, S.R * .2, cx, cy, diag * .6); g.addColorStop(0, rgba(col[1], .38 * ease(a * 2))); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    if (S.tier >= 6) {
      const n = 16, rot = S.t * (S.tier >= 7 ? .18 : .1);
      for (let i = 0; i < n; i++) { const a0 = rot + i * TAU / n, w = TAU / n * .3; c.fillStyle = rgba(col[i % 2], .06 + .03 * (S.tier - 6)); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a0 - w) * diag, cy + Math.sin(a0 - w) * diag); c.lineTo(cx + Math.cos(a0 + w) * diag, cy + Math.sin(a0 + w) * diag); c.closePath(); c.fill(); }
    }
    if (S.bolt && S.bolt.life > 0) { S.bolt.life -= dt; strokePts(c, S.bolt.pts, Math.max(2, S.R * .03), col[1], clamp(S.bolt.life / .6, 0, 1)); }
    S.fx.draw(c, cx, cy, RR, dt, 'back');
    c.globalCompositeOperation = 'source-over'; FX.figure(c, cx, cy, RR, col[0], Math.sin(S.fx.t * 1.6) * RR * .018);
    S.fx.draw(c, cx, cy, RR, dt, 'front');
    c.globalCompositeOperation = 'lighter';
    for (const r of S.rings) { r.age += dt; if (r.age < 0 || r.age > r.life) continue; const u = r.age / r.life; c.strokeStyle = rgba(r.c, (1 - u) * .9); c.lineWidth = S.R * .05 * (1 - u) + 1; c.beginPath(); c.arc(cx, cy, r.max * ease(u), 0, TAU); c.stroke(); }
    for (let i = S.burst.length - 1; i >= 0; i--) {
      const b = S.burst[i]; b.age += dt; if (b.age >= b.life) { S.burst[i] = S.burst[S.burst.length - 1]; S.burst.pop(); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - dt * 1.4; b.vy *= 1 - dt * 1.4; b.vy += 40 * dt;
      dot(c, col[b.c], b.x, b.y, b.s * (1 - b.age / b.life * .5) * 2, 1 - b.age / b.life);
    }
  }

  // ------------------------------------------------------------------ frame + lifecycle
  function resize(S) {
    const r = S.host.getBoundingClientRect(), dpr = Math.min(1.75, window.devicePixelRatio || 1);
    S.W = r.width; S.H = r.height; S.dpr = dpr; S.cv.width = S.W * dpr; S.cv.height = S.H * dpr;
    S.cx = S.W / 2; S.cy = S.H * (S.W < S.H ? .43 : .4); S.R = Math.min(S.W * .38, S.H * (S.W < S.H ? .28 : .27));
  }

  function tick(S, dt) {
    S.t += dt;
    if (!S.impact && S.t >= S.T) impact(S);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * (S.impact ? (S.tier >= 7 ? 1.1 : 1.7) : 3.2));
    if (S.kick > 0) S.kick = Math.max(0, S.kick - dt * (S.impact ? 1.2 : 4));
    const c = S.ctx, W = S.W, H = S.H, p = clamp(S.t / S.T, 0, 1), a = S.impact ? S.t - S.T : 0, q = clamp(a / (S.D - S.T), 0, 1);
    c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H);
    const shake = (S.kick * (S.impact ? 7 + (S.tier - 5) * 5 : 8)) + (S.impact ? 0 : p * p * (S.style === 'converge' || S.style === 'bang' ? 3 : 0));
    const zoom = S.impact ? 1 + .05 * (1 - q) : 1 + (S.tier >= 6 ? .16 : .1) * p * p;
    c.save(); c.translate(S.cx, S.cy); c.scale(zoom, zoom); c.translate(-S.cx + rnd(-shake, shake), -S.cy + rnd(-shake, shake));
    c.globalCompositeOperation = 'lighter';
    if (S.impact) reveal(S, a, q, dt); else B[S.style](S, p, dt);
    c.restore();
    c.globalCompositeOperation = 'lighter';
    if (S.flash > 0) { c.fillStyle = rgba(FX.mix(S.col[0], WHITE, .8), clamp(S.flash, 0, 1)); c.fillRect(0, 0, W, H); }
    c.globalCompositeOperation = 'source-over';
    const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    const bar = H * .085 * ease(S.t / .6) * (S.closing ? 0 : 1); c.fillStyle = '#000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
    if (S.t >= S.D && !S.closing) close(S);
  }
  function loop(S) { if (Cutscene.active !== S || S.manual) return; const now = performance.now(), dt = Math.min(.05, (now - S.last) / 1000); S.last = now; tick(S, dt); S.raf = requestAnimationFrame(() => loop(S)); }

  function close(S) {
    if (S.closed) return; S.closing = true; S.closed = true;
    cancelAnimationFrame(S.raf); removeEventListener('resize', S.onResize);
    if (!S.opts.replay && window.stage) stage.reveal(S.tier, S.colHex);
    S.host.classList.add('out');
    setTimeout(() => { if (Cutscene.active === S) Cutscene.active = null; S.host.classList.add('hidden'); S.host.classList.remove('cut', 'out'); S.host.innerHTML = ''; S.host.onclick = null; S.done && S.done(); }, S.opts.manual ? 0 : 500);
  }

  return {
    active: null,
    // res = { aura, variant, key, eff, isNew }, tier 5-7. done() runs when the cutscene has fully closed.
    play(res, tier, done, opts) {
      opts = opts || {}; if (this.active) this.skipNow();
      tier = clamp(tier, 5, 7);
      const host = $('#cine'), mode = opts.mode || Game.s.settings.cine || 'full', sc = (mode === 'short' || Game.s.settings.quick) ? .5 : 1;
      host.classList.remove('hidden', 'out'); host.classList.add('cut');
      host.innerHTML = '<canvas></canvas><div class="ctxt"></div><div class="c4 skiphint">TAP TO SKIP</div>';
      const S = { host, cv: host.querySelector('canvas'), res, aura: res.aura, variant: res.variant.id, tier, opts, done, info: info(res.key), style: cutStyleOf(res.aura.id),
        col: FX.variantColors(res.aura, res.variant.id), colHex: UI.colorOf(res), t: 0, T: BUILD[tier] * sc, D: (BUILD[tier] + HOLD[tier]) * sc, parts: [], rings: [], burst: [], fx: new FX.AuraFX(),
        flash: 0, kick: 0, impact: false, closing: false, manual: !!opts.manual, last: performance.now() };
      S.ctx = S.cv.getContext('2d'); resize(S);
      S.onResize = () => resize(S); addEventListener('resize', S.onResize);
      host.style.setProperty('--tc', S.colHex);
      host.onclick = () => { if (S.t < .45) return; if (!S.impact) S.t = Math.max(S.t, S.T - .001); else if (S.t > S.T + 1.1) close(S); };
      this.active = S;
      Sound.cutBuild(S.T, tier);
      if (!S.manual) S.raf = requestAnimationFrame(() => loop(S));
      return S;
    },
    skipNow() { const S = this.active; if (S) { close(S); this.active = null; } },
    // test helper: advance a manual cutscene by `sec` seconds
    advance(sec) { const S = this.active; if (!S) return; for (let t = 0; t < sec; t += 1 / 30) tick(S, 1 / 30); },
  };
})();
