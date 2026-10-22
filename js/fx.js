'use strict';
// ---- aura renderer: every aura is a stack of layers drawn on a canvas ----

const FX = (() => {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const lum = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

  // soft dot sprites (cached) so thousands of glows are cheap
  const sprites = {};
  function spr(c) {
    const k = (c[0] >> 3) + ',' + (c[1] >> 3) + ',' + (c[2] >> 3);
    if (sprites[k]) return sprites[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.3, rgba(c, 0.55)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return sprites[k] = cv;
  }
  function dot(ctx, c, x, y, r, a) { if (a <= 0 || r <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr(c), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

  function emit(L, dt, rate) { L.acc = (L.acc || 0) + dt * rate; const n = Math.floor(L.acc); L.acc -= n; return Math.min(n, 12); }
  function step(L, dt, fn) {
    const p = L.p || (L.p = []);
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i]; q.age += dt;
      if (q.age >= q.life) { p[i] = p[p.length - 1]; p.pop(); continue; }
      fn(q, q.age / q.life);
    }
    return p;
  }
  function star4(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  const BACK = { glow: 1, rays: 1, void: 1, moon: 1, aurora: 1, galaxy: 1, clock: 1, rift: 1, singularity: 1, prism: 1, halo: 1, voidcore: 1, infinity: 1, wings: 1, runes: 1 };

  const LAYERS = {
    glow(ctx, L, cx, cy, R, dt, t, col) {
      const p = 1 + 0.06 * Math.sin(t * 2.2);
      const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.25 * p);
      g.addColorStop(0, rgba(col[0], 0.55)); g.addColorStop(0.45, rgba(col[1], 0.2)); g.addColorStop(1, rgba(col[1], 0));
      ctx.fillStyle = g; ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
    },
    wisps(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 22); n--;) L.p = (L.p || []).concat([{ x: cx + rnd(-.5, .5) * R, y: cy + rnd(.2, .9) * R, vx: rnd(-8, 8) * k, vy: -rnd(30, 70) * k, s: rnd(.1, .22) * R, ph: rnd(0, TAU), age: 0, life: rnd(1.6, 3) }]);
      step(L, dt, (q, u) => { q.x += (q.vx + Math.sin(t * 2 + q.ph) * 14 * k) * dt; q.y += q.vy * dt; dot(ctx, mix(col[0], col[2], u * .6), q.x, q.y, q.s * (.6 + u * .6), (1 - u) * .45); });
    },
    embers(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 40); n--;) L.p.push({ x: cx + rnd(-.45, .45) * R, y: cy + rnd(.3, .9) * R, vx: rnd(-14, 14) * k, vy: -rnd(70, 170) * k, s: rnd(.03, .07) * R, ph: rnd(0, TAU), age: 0, life: rnd(.8, 1.8) });
      step(L, dt, (q, u) => { q.x += (q.vx + Math.sin(t * 5 + q.ph) * 20 * k) * dt; q.y += q.vy * dt; dot(ctx, mix(col[2], col[0], u), q.x, q.y, q.s * (1 - u * .5) * 2.4, 1 - u); });
    },
    flames(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 120); n--;) L.p.push({ x: cx + rnd(-.42, .42) * R, y: cy + rnd(.35, .85) * R, vx: rnd(-10, 10) * k, vy: -rnd(110, 230) * k, s: rnd(.13, .26) * R, age: 0, life: rnd(.7, 1.3) });
      step(L, dt, (q, u) => {
        q.x += q.vx * dt + Math.sin(t * 6 + q.y * .03) * 12 * k * dt; q.y += q.vy * dt;
        const c = u < .35 ? mix(col[2], col[1], u / .35) : mix(col[1], col[0], (u - .35) / .65);
        dot(ctx, c, q.x, q.y, q.s * (1.1 - u * .7), (1 - u) * .75);
      });
    },
    leaves(ctx, L, cx, cy, R, dt, t, col) { LAYERS._fall(ctx, L, cx, cy, R, dt, t, col, true); },
    petals(ctx, L, cx, cy, R, dt, t, col) { LAYERS._fall(ctx, L, cx, cy, R, dt, t, col, false); },
    _fall(ctx, L, cx, cy, R, dt, t, col, leaf) {
      const k = R / 200;
      for (let n = emit(L, dt, 14); n--;) L.p.push({ a: rnd(0, TAU), rr: rnd(.4, 1.1), y: cy - R * 1.1, vy: rnd(40, 80) * k, rot: rnd(0, TAU), vr: rnd(-3, 3), s: rnd(.05, .1) * R, c: Math.random() < .5 ? 0 : 1, age: 0, life: rnd(2.4, 4) });
      step(L, dt, (q, u) => {
        q.y += q.vy * dt; q.rot += q.vr * dt;
        const x = cx + Math.sin(q.a + t * 1.3 + u * 6) * R * q.rr * .8, y = q.y;
        ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, (1 - u) * 1.6) * .9; ctx.fillStyle = rgba(col[q.c], 1);
        ctx.beginPath();
        if (leaf) { ctx.moveTo(-q.s, 0); ctx.quadraticCurveTo(0, -q.s * .9, q.s, 0); ctx.quadraticCurveTo(0, q.s * .9, -q.s, 0); }
        else { ctx.ellipse(0, 0, q.s, q.s * .55, 0, 0, TAU); }
        ctx.fill(); ctx.restore();
      });
    },
    snow(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 18); n--;) L.p.push({ x: cx + rnd(-1.2, 1.2) * R, y: cy - R * 1.2, vy: rnd(30, 70) * k, rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), s: rnd(.03, .07) * R, ph: rnd(0, TAU), age: 0, life: rnd(3, 5) });
      step(L, dt, (q, u) => {
        q.y += q.vy * dt; q.rot += q.vr * dt;
        const x = q.x + Math.sin(t + q.ph) * 14 * k;
        ctx.save(); ctx.translate(x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, (1 - u) * 2) * .9; ctx.strokeStyle = rgba(col[1], 1); ctx.lineWidth = Math.max(1, q.s * .22);
        ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * q.s, Math.sin(a) * q.s); ctx.lineTo(-Math.cos(a) * q.s, -Math.sin(a) * q.s); } ctx.stroke(); ctx.restore();
      });
    },
    bubbles(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 9); n--;) L.p.push({ x: cx + rnd(-.6, .6) * R, y: cy + R * rnd(.6, 1), vy: -rnd(35, 70) * k, s: rnd(.03, .09) * R, ph: rnd(0, TAU), age: 0, life: rnd(2, 3.4) });
      step(L, dt, (q, u) => {
        q.y += q.vy * dt; const x = q.x + Math.sin(t * 2 + q.ph) * 10 * k;
        ctx.globalAlpha = (1 - u) * .8; ctx.strokeStyle = rgba(col[1], 1); ctx.lineWidth = Math.max(1, R * .006);
        ctx.beginPath(); ctx.arc(x, q.y, q.s, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(col[2], 1); ctx.beginPath(); ctx.arc(x - q.s * .3, q.y - q.s * .3, q.s * .2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      });
    },
    lightning(ctx, L, cx, cy, R, dt, t, col) {
      L.cd = (L.cd || 0) - dt; const bolts = L.p || (L.p = []);
      if (L.cd <= 0) {
        L.cd = rnd(.07, .28);
        const a = rnd(0, TAU), r0 = R * rnd(.45, .7), r1 = R * rnd(1.05, 1.4), pts = []; const n = 8;
        for (let i = 0; i <= n; i++) { const u = i / n, r = r0 + (r1 - r0) * u, aa = a + (i && i < n ? rnd(-.22, .22) : 0); pts.push([cx + Math.cos(aa) * r, cy + Math.sin(aa) * r]); }
        bolts.push({ pts, age: 0, life: .16 });
      }
      step(L, dt, (q, u) => {
        const a = 1 - u; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const [w, c, al] of [[R * .05, col[0], .25], [R * .02, col[0], .8], [R * .008, col[2], 1]]) {
          ctx.strokeStyle = rgba(c, al * a); ctx.lineWidth = w; ctx.beginPath(); q.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        }
      });
    },
    rings(ctx, L, cx, cy, R, dt, t, col) {
      L.cd = (L.cd || 0) - dt;
      if (L.cd <= 0) { L.cd = .75; (L.p || (L.p = [])).push({ age: 0, life: 2.1 }); }
      step(L, dt, (q, u) => { const r = R * (.3 + 1.3 * Math.sqrt(u)); ctx.strokeStyle = rgba(mix(col[0], col[2], u), (1 - u) * .8); ctx.lineWidth = R * .025 * (1 - u) + 1; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .96, 0, 0, TAU); ctx.stroke(); });
    },
    shards(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 7); n--;) L.p.push({ x: cx + rnd(-.9, .9) * R, y: cy + R * rnd(.6, 1.1), vy: -rnd(20, 55) * k, rot: rnd(0, TAU), vr: rnd(-2, 2), s: rnd(.05, .12) * R, c: Math.random() < .5 ? 0 : 1, age: 0, life: rnd(2, 3.4) });
      step(L, dt, (q, u) => {
        q.y += q.vy * dt; q.rot += q.vr * dt;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, (1 - u) * 1.8);
        ctx.fillStyle = rgba(col[q.c], .85); ctx.beginPath(); ctx.moveTo(0, -q.s); ctx.lineTo(q.s * .45, q.s * .3); ctx.lineTo(-q.s * .5, q.s * .7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(col[2], .9); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      });
    },
    orbit(ctx, L, cx, cy, R, dt, t, col) {
      const n = 6;
      for (let i = 0; i < n; i++) for (let tr = 7; tr >= 0; tr--) {
        const a = t * 1.5 + i * TAU / n - tr * .07, x = cx + Math.cos(a) * R * .95, y = cy + Math.sin(a) * R * .38 * (i % 2 ? 1 : -1) + Math.sin(a * 2) * R * .08;
        if (!tr) { ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2); ctx.fillStyle = rgba(col[i % 2], 1); ctx.beginPath(); const s = R * .075; ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * .7, 0); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s * .7, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(col[2], 1); ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); dot(ctx, col[0], x, y, R * .18, .35); }
        else dot(ctx, col[i % 2], x, y, R * .05 * (1 - tr / 9), .35 * (1 - tr / 8));
      }
    },
    stars(ctx, L, cx, cy, R, dt, t, col) {
      if (!L.s) L.s = Array.from({ length: 20 }, () => ({ a: rnd(0, TAU), r: rnd(.35, 1.35), ph: rnd(0, TAU), sp: rnd(1.5, 3.5), z: rnd(.5, 1.2) }));
      for (const s of L.s) {
        const tw = Math.max(0, Math.sin(t * s.sp + s.ph)), x = cx + Math.cos(s.a + t * .08) * R * s.r, y = cy + Math.sin(s.a + t * .08) * R * s.r * .95;
        dot(ctx, col[1], x, y, R * .08 * s.z, tw * .5); ctx.fillStyle = rgba(col[2], tw); star4(ctx, x, y, R * .05 * s.z * (.4 + tw), 0);
      }
    },
    sparkle(ctx, L, cx, cy, R, dt, t, col) {
      for (let n = emit(L, dt, 26); n--;) { const a = rnd(0, TAU), r = rnd(.2, 1.15); (L.p || (L.p = [])).push({ x: cx + Math.cos(a) * R * r, y: cy + Math.sin(a) * R * r, s: rnd(.03, .08) * R, age: 0, life: rnd(.4, .9) }); }
      step(L, dt, (q, u) => { const a = Math.sin(u * Math.PI); dot(ctx, [255, 240, 170], q.x, q.y, q.s * 3, a * .5); ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; star4(ctx, q.x, q.y, q.s * 1.6 * a, u * 2); });
    },
    rays(ctx, L, cx, cy, R, dt, t, col) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = t * .25 + i * TAU / n, w = .09 + .03 * Math.sin(t * 2 + i);
        const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * R * 1.8, cy + Math.sin(a) * R * 1.8);
        g.addColorStop(0, rgba(col[i % 2 ? 1 : 0], .3)); g.addColorStop(1, rgba(col[0], 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - w) * R * 1.8, cy + Math.sin(a - w) * R * 1.8); ctx.lineTo(cx + Math.cos(a + w) * R * 1.8, cy + Math.sin(a + w) * R * 1.8); ctx.fill();
      }
    },
    eye(ctx, L, cx, cy, R, dt, t, col) {
      L.bl = (L.bl || 0) - dt; if (L.bl < -3.5) L.bl = .18;
      const open = L.bl > 0 ? Math.abs(L.bl - .09) / .09 : 1, w = R * .85, h = R * .34 * open, y = cy - R * .08, pulse = .55 + .15 * Math.sin(t * 2);
      ctx.save(); ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.quadraticCurveTo(cx, y - h * 2, cx + w, y); ctx.quadraticCurveTo(cx, y + h * 2, cx - w, y); ctx.clip();
      const ix = cx + Math.sin(t * .6) * w * .25, iy = y + Math.cos(t * .5) * h * .2;
      const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, R * .3); g.addColorStop(0, rgba(col[2], 1)); g.addColorStop(.4, rgba(col[0], 1)); g.addColorStop(1, rgba(col[1], 1));
      ctx.fillStyle = g; ctx.fillRect(cx - w, y - h * 2, w * 2, h * 4);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ix, iy, R * .045, R * .16 * open + 1, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = rgba(col[2], pulse); ctx.lineWidth = R * .012; ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.quadraticCurveTo(cx, y - h * 2, cx + w, y); ctx.quadraticCurveTo(cx, y + h * 2, cx - w, y); ctx.stroke();
    },
    moon(ctx, L, cx, cy, R, dt, t, col) {
      const y = cy - R * .12, r = R * .52, lit = lum(col[1]) > .6;
      const g = ctx.createRadialGradient(cx, y, r * .8, cx, y, r * 2.1); g.addColorStop(0, rgba(col[0], lit ? .45 : .9)); g.addColorStop(.35, rgba(col[0], .25)); g.addColorStop(1, rgba(col[0], 0));
      ctx.fillStyle = g; ctx.fillRect(cx - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      ctx.globalCompositeOperation = 'source-over';
      if (lit) { const lg = ctx.createRadialGradient(cx - r * .3, y - r * .3, r * .1, cx, y, r); lg.addColorStop(0, rgba(col[2], 1)); lg.addColorStop(1, rgba(col[1], 1)); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(col[0], .25); for (const [dx, dy, rr] of [[-.3, -.1, .16], [.25, .2, .12], [.1, -.35, .09]]) { ctx.beginPath(); ctx.arc(cx + dx * r, y + dy * r, rr * r, 0, TAU); ctx.fill(); } }
      else { ctx.fillStyle = '#04030a'; ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(col[2], .95); ctx.lineWidth = R * .012; ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
    },
    galaxy(ctx, L, cx, cy, R, dt, t, col) {
      if (!L.s) L.s = Array.from({ length: 300 }, (_, i) => { const arm = i % 3, r = Math.pow(Math.random(), .7); return { arm, r, th: arm * TAU / 3 + r * 5 + rnd(-.25, .25), z: rnd(.5, 1.3) }; });
      for (const s of L.s) {
        const a = s.th + t * (.5 / (.25 + s.r)) * .5, rr = s.r * R * 1.25, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .55;
        dot(ctx, mix(col[2], s.r < .5 ? col[0] : col[1], s.r), x, y, R * .055 * s.z + 1, .9 - s.r * .3);
      }
      dot(ctx, col[2], cx, cy, R * .5, .45); dot(ctx, col[0], cx, cy, R * .9, .25);
    },
    void(ctx, L, cx, cy, R, dt, t, col) {
      const r = R * .5;
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(cx, cy, r * .2, cx, cy, r * 1.5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * .3) * .12 - .25);
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgba(i ? col[2] : col[0], .8 - i * .25); ctx.lineWidth = R * (.05 - i * .015); ctx.beginPath(); ctx.ellipse(0, 0, r * (1.15 + i * .18), r * (.35 + i * .06), 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
      const k = R / 200;
      for (let n = emit(L, dt, 40); n--;) (L.p || (L.p = [])).push({ a: rnd(0, TAU), r: R * rnd(1.1, 1.5), age: 0, life: rnd(.9, 1.6) });
      step(L, dt, (q, u) => { const rr = q.r * (1 - u) + r * .5 * u, a = q.a + u * 3.5, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .6; dot(ctx, col[u > .6 ? 2 : 0], x, y, R * .035 + 1, (1 - u * .6) * .9); });
    },
    glitch(ctx, L, cx, cy, R, dt, t, col) {
      L.cd = (L.cd || 0) - dt;
      if (L.cd <= 0) { L.cd = rnd(.04, .12); L.r = Array.from({ length: Math.floor(rnd(5, 11)) }, () => ({ x: cx + rnd(-1.1, 1.1) * R, y: cy + rnd(-1.1, 1.1) * R, w: rnd(.1, .7) * R, h: rnd(.015, .09) * R, c: Math.random() < .5 ? 0 : 1, a: rnd(.25, .7) })); }
      for (const q of L.r || []) { ctx.fillStyle = rgba(col[q.c], q.a); ctx.fillRect(q.x, q.y, q.w, q.h); }
      ctx.globalAlpha = .12; ctx.fillStyle = rgba(col[2], 1);
      for (let y = cy - R * 1.2; y < cy + R * 1.2; y += R * .07) ctx.fillRect(cx - R * 1.1, y + ((t * 40) % (R * .07)), R * 2.2, 1);
      ctx.globalAlpha = 1;
      for (let n = emit(L, dt, 14); n--;) (L.p || (L.p = [])).push({ x: cx + rnd(-.9, .9) * R, y: cy + rnd(.2, .9) * R, s: rnd(.02, .05) * R, c: Math.random() < .5 ? 0 : 1, age: 0, life: rnd(.5, 1.1) });
      step(L, dt, (q, u) => { q.y -= R * .3 * dt; ctx.fillStyle = rgba(col[q.c], 1 - u); ctx.fillRect(q.x, q.y, q.s, q.s); });
    },
    serpent(ctx, L, cx, cy, R, dt, t, col) {
      const n = 46, pts = [];
      for (let i = 0; i < n; i++) {
        const a = t * 1.0 - i * .115, rr = R * (.92 + .14 * Math.sin(i * .35 - t * 2));
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a * 1.0) * rr * .42 + Math.sin(a * 2 + t) * R * .25, z: Math.sin(a), i });
      }
      for (let i = n - 1; i >= 0; i--) {
        const p = pts[i], u = i / n, s = R * (.17 - u * .1) * (.8 + .25 * p.z);
        dot(ctx, mix(col[0], col[1], u), p.x, p.y, s * 1.9, .8 + .2 * p.z); dot(ctx, col[0], p.x, p.y, s * 1.1, .6);
        if (i % 3 === 0) dot(ctx, col[2], p.x, p.y - s * .2, s * .6, .35);
      }
      const h = pts[0]; dot(ctx, col[2], h.x, h.y, R * .16, .7);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(h.x + R * .02, h.y - R * .02, R * .018, 0, TAU); ctx.fill();
      for (let k = 0; k < 2; k++) { ctx.strokeStyle = rgba(col[2], .8); ctx.lineWidth = R * .01; ctx.beginPath(); ctx.moveTo(h.x, h.y - R * .04); ctx.lineTo(h.x - R * .1, h.y - R * (.14 + .06 * k)); ctx.stroke(); }
    },
    aurora(ctx, L, cx, cy, R, dt, t, col) {
      const cols = [col[0], col[1], col[2]];
      for (let b = 0; b < 3; b++) {
        const c = cols[b];
        for (let x = -R * 1.2; x <= R * 1.2; x += 4) {
          const u = x / (R * 1.2), y0 = cy - R * (.55 + b * .1) + Math.sin(x * .012 + t * (.8 + b * .3) + b) * R * .25, len = R * (.9 + .25 * Math.sin(x * .02 + t + b * 2)), fade = 1 - u * u;
          const g = ctx.createLinearGradient(0, y0 - len, 0, y0 + len * .2); g.addColorStop(0, rgba(c, 0)); g.addColorStop(.7, rgba(c, .5 * fade)); g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g; ctx.fillRect(cx + x, y0 - len, 4.5, len * 1.2);
        }
      }
    },
    clock(ctx, L, cx, cy, R, dt, t, col) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(col[0], .85); ctx.lineWidth = R * .02; ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba(col[2], .5); ctx.lineWidth = R * .008; ctx.beginPath(); ctx.arc(cx, cy, R * .86, 0, TAU); ctx.stroke();
      for (let i = 0; i < 60; i++) { const a = i * TAU / 60 - Math.PI / 2, big = i % 5 === 0, r0 = R * (big ? .9 : .95), r1 = R * 1.0; ctx.strokeStyle = rgba(col[big ? 2 : 0], big ? .95 : .5); ctx.lineWidth = R * (big ? .016 : .007); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .4); ctx.strokeStyle = rgba(col[0], .4); ctx.lineWidth = R * .01; ctx.setLineDash([R * .06, R * .05]); ctx.beginPath(); ctx.arc(0, 0, R * 1.12, 0, TAU); ctx.stroke(); ctx.restore();
      for (const [sp, len, w] of [[1.2, .78, .022], [.1, .56, .03]]) { const a = t * sp - Math.PI / 2; ctx.strokeStyle = rgba(col[2], .95); ctx.lineWidth = R * w; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * len, cy + Math.sin(a) * R * len); ctx.stroke(); }
      dot(ctx, col[0], cx, cy, R * .12, .6);
    },
    halo(ctx, L, cx, cy, R, dt, t, col) {
      const g = ctx.createLinearGradient(cx, cy - R * 1.6, cx, cy + R); g.addColorStop(0, rgba(col[0], .0)); g.addColorStop(.25, rgba(col[0], .25)); g.addColorStop(1, rgba(col[1], 0));
      ctx.fillStyle = g; ctx.fillRect(cx - R * .35, cy - R * 1.6, R * .7, R * 2.6);
      const y = cy - R * (1.02 + .02 * Math.sin(t * 2));
      for (const [w, c, a] of [[R * .06, col[0], .35], [R * .025, col[1], .9], [R * .01, col[2], 1]]) { ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(cx, y, R * .36, R * .09, 0, 0, TAU); ctx.stroke(); }
      dot(ctx, col[2], cx, y, R * .5, .25);
    },
    blades(ctx, L, cx, cy, R, dt, t, col) {
      for (let ring = 0; ring < 2; ring++) {
        const n = ring ? 10 : 8, dir = ring ? -1 : 1, rr = R * (ring ? 1.12 : .88);
        for (let i = 0; i < n; i++) {
          const a = dir * t * (ring ? .6 : .9) + i * TAU / n; ctx.save(); ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8); ctx.rotate(a + Math.PI / 2 * dir);
          const len = R * (ring ? .26 : .34), w = R * .045;
          ctx.fillStyle = rgba(col[ring], .9); ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(w, -len * .1); ctx.lineTo(w * .5, len * .45); ctx.lineTo(-w * .5, len * .45); ctx.lineTo(-w, -len * .1); ctx.closePath(); ctx.fill();
          ctx.fillStyle = rgba(col[2], 1); ctx.fillRect(-w * 1.6, len * .45, w * 3.2, w * .6); ctx.fillRect(-w * .35, len * .5, w * .7, len * .3);
          ctx.restore(); dot(ctx, col[ring], cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8, R * .12, .3);
        }
      }
    },
    prism(ctx, L, cx, cy, R, dt, t, col) {
      const seg = 48;
      for (let i = 0; i < seg; i++) {
        const a0 = i * TAU / seg + t * .5, a1 = a0 + TAU / seg + .02;
        ctx.strokeStyle = 'hsla(' + ((i * 360 / seg + t * 70) % 360) + ',100%,62%,.7)'; ctx.lineWidth = R * .13;
        ctx.beginPath(); ctx.arc(cx, cy, R * .92, a0, a1); ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1); g.addColorStop(0, 'hsla(' + ((t * 50) % 360) + ',100%,70%,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
    },
    rift(ctx, L, cx, cy, R, dt, t, col) {
      L.cd = (L.cd || 0) - dt;
      if (L.cd <= 0 || !L.j) { L.cd = rnd(.05, .14); L.j = Array.from({ length: 16 }, () => rnd(-1, 1)); }
      const pts = L.j.map((j, i) => [cx + j * R * .1 + Math.sin(t * 3 + i) * R * .02, cy - R * 1.25 + (i / 15) * R * 2.5]);
      const wid = [R * .22, R * .09, R * .03], cc = [col[1], col[0], col[2]], al = [.3, .85, 1];
      for (let p = 0; p < 3; p++) { ctx.strokeStyle = rgba(cc[p], al[p]); ctx.lineWidth = wid[p]; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); }
      for (let n = emit(L, dt, 30); n--;) (L.p || (L.p = [])).push({ x: cx + rnd(-.05, .05) * R, y: cy + rnd(-1.1, 1.1) * R, vx: rnd(-1, 1) * R * .9, vy: rnd(-.3, .3) * R, s: rnd(.02, .05) * R, age: 0, life: rnd(.4, .9) });
      step(L, dt, (q, u) => { q.x += q.vx * dt; q.y += q.vy * dt; dot(ctx, col[Math.random() < .5 ? 0 : 2], q.x, q.y, q.s * 3, 1 - u); });
    },
    infinity(ctx, L, cx, cy, R, dt, t, col) {
      const pt = a => { const d = 1 + Math.sin(a) * Math.sin(a); return [cx + R * 1.25 * Math.cos(a) / d, cy + R * .95 * Math.sin(a) * Math.cos(a) / d - R * .05]; };
      for (let pass = 0; pass < 2; pass++) for (let i = 70; i >= 0; i--) {
        const a = (pass ? -1 : 1) * t * 1.4 - i * .045 + pass * Math.PI, [x, y] = pt(a);
        dot(ctx, mix(col[pass], col[2], i / 70), x, y, R * (.09 - i * .0009), (1 - i / 75) * .8);
      }
    },
    singularity(ctx, L, cx, cy, R, dt, t, col) {
      const r = R * .42;
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = rgba(col[2], .45 - i * .09); ctx.lineWidth = R * .02; ctx.beginPath(); ctx.arc(cx, cy, r * (1.5 + i * .35 + .05 * Math.sin(t * 2 + i)), 0, TAU); ctx.stroke(); }
      for (let n = emit(L, dt, 90); n--;) (L.p || (L.p = [])).push({ a: rnd(0, TAU), r: R * rnd(1.2, 1.9), age: 0, life: rnd(.8, 1.5), c: Math.random() < .4 ? 2 : 0 });
      step(L, dt, (q, u) => { const e = u * u, rr = q.r * (1 - e) + r * e, a = q.a + e * 5, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; dot(ctx, q.c === 2 ? col[2] : [255, 255, 255], x, y, R * .035 + 1, (1 - u) * .9); });
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = R * .03; ctx.shadowColor = '#fff'; ctx.shadowBlur = R * .15; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';
    },
    rain(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 70); n--;) L.p.push({ x: cx + rnd(-1.3, 1.3) * R, y: cy - R * 1.3, vy: rnd(500, 800) * k, len: rnd(.08, .16) * R, age: 0, life: rnd(.35, .5) });
      step(L, dt, (q, u) => { q.y += q.vy * dt; q.x -= 60 * k * dt; ctx.strokeStyle = rgba(col[0], .55 * (1 - u * .4)); ctx.lineWidth = Math.max(1, R * .006); ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + 7 * k, q.y - q.len); ctx.stroke(); });
    },
    voidcore(ctx, L, cx, cy, R, dt, t, col) {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(cx, cy, R * .1, cx, cy, R * 1.05); g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(.7, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(col[0], .75); ctx.lineWidth = R * .018; ctx.setLineDash([R * .12, R * .07]); ctx.lineDashOffset = -t * R * .2; ctx.beginPath(); ctx.arc(cx, cy, R * .98, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    },
    // ---- v1.1 layers ----
    wings(ctx, L, cx, cy, R, dt, t, col) {
      const flap = Math.sin(t * 1.7) * .13, n = 7;
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1), a = -1.25 + u * 1.55 + flap, len = R * (1.05 - u * .42);
          const sx = cx + side * R * .09, sy = cy - R * .2 + u * R * .12;
          const tx = sx + side * Math.cos(a + .35) * len * .92, ty = sy + Math.sin(a + .35) * len * .92 + R * .1;
          const mx = sx + side * Math.cos(a) * len * .55, my = sy + Math.sin(a) * len * .55 - R * .12;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx + side * R * .08, my - R * .05, tx, ty); ctx.quadraticCurveTo(mx - side * R * .06, my + R * .12, sx, sy + R * .05);
          ctx.fillStyle = rgba(col[i % 2 ? 1 : 0], .22 + .08 * (1 - u)); ctx.fill();
          ctx.strokeStyle = rgba(col[2], .35); ctx.lineWidth = Math.max(1, R * .008); ctx.stroke();
        }
      }
    },
    vortex(ctx, L, cx, cy, R, dt, t, col) {
      L.rot = (L.rot || 0) + dt * 2.2;
      for (let n = emit(L, dt, 120); n--;) L.p.push({ a: L.rot + Math.floor(rnd(0, 3)) * TAU / 3 + rnd(-.22, .22), s: rnd(.018, .04) * R, c: Math.random(), age: 0, life: rnd(1.5, 2.2) });
      step(L, dt, (q, u) => {
        const r = R * (1.2 * Math.pow(1 - u, 1.3) + .12), a = q.a + q.age * 3.4 - L.rot * 0;
        dot(ctx, mix(col[0], col[1], q.c), cx + Math.cos(a) * r, cy + Math.sin(a) * r * .5 + R * .05, q.s * (1.6 - u), Math.sin(Math.min(1, u * 1.4) * Math.PI) * .95);
      });
    },
    runes(ctx, L, cx, cy, R, dt, t, col) {
      const r = R * .98, y = cy - R * .02;
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, R * .012);
      ctx.strokeStyle = rgba(col[0], .75); ctx.shadowColor = rgba(col[0], 1); ctx.shadowBlur = R * .08;
      ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, y, r * .82, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      // rotating glyph ring
      ctx.strokeStyle = rgba(col[1], .8); ctx.lineWidth = Math.max(1.4, R * .014);
      for (let i = 0; i < 18; i++) {
        const a = t * .5 + i * TAU / 18, r1 = r * .86, r2 = r * .95, k = i % 3;
        ctx.beginPath();
        if (k === 0) { ctx.moveTo(cx + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, y + Math.sin(a) * r2); }
        else if (k === 1) { ctx.moveTo(cx + Math.cos(a - .05) * r1, y + Math.sin(a - .05) * r1); ctx.lineTo(cx + Math.cos(a + .05) * r2, y + Math.sin(a + .05) * r2); ctx.moveTo(cx + Math.cos(a + .05) * r1, y + Math.sin(a + .05) * r1); ctx.lineTo(cx + Math.cos(a - .05) * r2, y + Math.sin(a - .05) * r2); }
        else { ctx.arc(cx, y, (r1 + r2) / 2, a - .06, a + .06); }
        ctx.stroke();
      }
      // counter-rotating star
      ctx.strokeStyle = rgba(col[2], .6); ctx.lineWidth = Math.max(1, R * .01);
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) { const a = -t * .35 + (i * 2 % 5) * TAU / 5; const px = cx + Math.cos(a) * r * .8, py = y + Math.sin(a) * r * .8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.lineCap = 'butt';
    },
    comets(ctx, L, cx, cy, R, dt, t, col) {
      const k = R / 200;
      for (let n = emit(L, dt, 3.2); n--;) { const x0 = cx + rnd(-.2, 1.5) * R, y0 = cy - R * rnd(1, 1.4); L.p.push({ x: x0, y: y0, vx: -rnd(380, 560) * k, vy: rnd(300, 440) * k, s: rnd(.05, .09) * R, c: Math.random() * 1, age: 0, life: rnd(.8, 1.3) }); }
      step(L, dt, (q, u) => {
        q.x += q.vx * dt; q.y += q.vy * dt;
        const c = mix(col[0], col[2], q.c), tl = .45;
        const g = ctx.createLinearGradient(q.x, q.y, q.x - q.vx * tl, q.y - q.vy * tl); g.addColorStop(0, rgba(c, .85)); g.addColorStop(1, rgba(c, 0));
        ctx.strokeStyle = g; ctx.lineWidth = q.s * .9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * tl, q.y - q.vy * tl); ctx.stroke(); ctx.lineCap = 'butt';
        dot(ctx, mix(c, [255, 255, 255], .6), q.x, q.y, q.s * 2.2, 1 - u * .4);
      });
    },
    helix(ctx, L, cx, cy, R, dt, t, col) {
      const n = 26, h = R * 1.5;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), y = cy - h / 2 + u * h, ph = u * 7 + t * 2.2, amp = R * .3 * (.6 + .4 * Math.sin(u * Math.PI));
        const x1 = cx + Math.sin(ph) * amp, x2 = cx - Math.sin(ph) * amp, z1 = Math.cos(ph), z2 = -z1;
        if (i % 2 === 0) { ctx.strokeStyle = rgba(col[2], .22); ctx.lineWidth = Math.max(1, R * .008); ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
        dot(ctx, col[0], x1, y, R * (.05 + .02 * z1), .55 + .4 * z1);
        dot(ctx, col[1], x2, y, R * (.05 + .02 * z2), .55 + .4 * z2);
      }
    },
    crown(ctx, L, cx, cy, R, dt, t, col) {
      const u = R / 200, y = cy - 126 * u + Math.sin(t * 2) * 3 * u, w = 36 * u, hh = 26 * u;
      ctx.beginPath(); ctx.moveTo(cx - w, y + hh);
      for (let i = 0; i < 5; i++) { const x = cx - w + i * w / 2; ctx.lineTo(x, y); ctx.lineTo(x + w / 4, y + hh * .5); }
      ctx.lineTo(cx + w, y + hh); ctx.closePath();
      ctx.fillStyle = rgba(col[0], .4); ctx.fill();
      ctx.shadowColor = rgba(col[0], 1); ctx.shadowBlur = 14 * u; ctx.strokeStyle = rgba(col[2], .95); ctx.lineWidth = 2.2 * u; ctx.stroke(); ctx.shadowBlur = 0;
      for (let i = 0; i < 5; i++) dot(ctx, col[2], cx - w + i * w / 2, y, 6 * u + 2 * u * Math.sin(t * 4 + i), .9);
      dot(ctx, col[1], cx, y - 14 * u, 40 * u, .22 + .1 * Math.sin(t * 3));
    },
    fireflies(ctx, L, cx, cy, R, dt, t, col) {
      if (!L.f) L.f = Array.from({ length: 26 }, () => ({ a: rnd(0, TAU), r: rnd(.3, 1.1), sp: rnd(.2, .7), ph: rnd(0, TAU), y: rnd(-.8, .9) }));
      for (const q of L.f) {
        q.a += q.sp * dt * .6;
        const x = cx + Math.cos(q.a) * R * q.r + Math.sin(t * 1.3 + q.ph) * R * .06, y = cy + q.y * R * .8 + Math.sin(t * 1.7 + q.ph) * R * .07;
        const b = Math.max(0, Math.sin(t * 2.4 + q.ph * 3)); dot(ctx, mix(col[0], col[1], b), x, y, R * (.025 + .05 * b), .25 + .75 * b);
      }
    },
    slashes(ctx, L, cx, cy, R, dt, t, col) {
      for (let n = emit(L, dt, 7); n--;) { const a = rnd(-1.3, 1.3) + (Math.random() < .5 ? 0 : Math.PI), r = rnd(.7, 1.4) * R; L.p.push({ x: cx + rnd(-.45, .45) * R * .6, y: cy + rnd(-.4, .4) * R * .7, a, len: r, w: rnd(.05, .1) * R, c: Math.random() < .6 ? 0 : 1, age: 0, life: rnd(.3, .5) }); }
      step(L, dt, (q, u) => {
        const e = Math.min(1, u * 3.5), x0 = q.x - Math.cos(q.a) * q.len / 2, y0 = q.y - Math.sin(q.a) * q.len / 2, x1 = x0 + Math.cos(q.a) * q.len * e, y1 = y0 + Math.sin(q.a) * q.len * e;
        const nx = -Math.sin(q.a) * q.w, ny = Math.cos(q.a) * q.w, f = Math.min(1, (1 - u) * 1.6);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny, x1, y1); ctx.quadraticCurveTo((x0 + x1) / 2 - nx * .2, (y0 + y1) / 2 - ny * .2, x0, y0);
        ctx.fillStyle = rgba(col[q.c], f); ctx.shadowColor = rgba(col[q.c], 1); ctx.shadowBlur = q.w * 1.6; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(col[2], f * .9); ctx.lineWidth = Math.max(1, q.w * .12); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + nx * .35, (y0 + y1) / 2 + ny * .35, x1, y1); ctx.stroke();
      });
    },
  };

  function variantColors(aura, variant) {
    let cols = aura.c.map(hex);
    if (variant === 'shiny') cols = cols.map(c => mix(c, [255, 235, 170], .28));
    else if (variant === 'inverted') cols = cols.map(c => [255 - c[0], 255 - c[1], 255 - c[2]]).map(c => lum(c) < .12 ? [40, 20, 60] : c);
    else if (variant === 'void') cols = cols.map(c => mix(c, [120, 70, 255], .55));
    return cols;
  }

  class AuraFX {
    constructor() { this.aura = null; this.t = 0; this.pop = 1; }
    set(aura, variant) {
      this.aura = aura; this.variant = variant || 'normal'; this.col = variantColors(aura, this.variant);
      this.layers = aura.layers.map(n => ({ n, L: { p: [] } }));
      if (this.variant === 'shiny') this.layers.push({ n: 'sparkle', L: { p: [] } });
      if (this.variant === 'void') this.layers.unshift({ n: 'voidcore', L: { p: [] } });
      this.pop = 0;
    }
    // pass: 'back' draws behind the figure, 'front' in front of it
    draw(ctx, cx, cy, R, dt, pass) {
      if (!this.aura) return;
      dt = Math.min(dt, .05);
      if (pass === 'back') { this.t += dt; this.pop = Math.min(1, this.pop + dt * 2.6); }
      const e = 1 - Math.pow(1 - this.pop, 3), rr = R * (.6 + .4 * e) * (1 + (1 - e) * .15);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e;
      for (const { n, L } of this.layers) {
        if ((BACK[n] ? 'back' : 'front') !== pass) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
        LAYERS[n](ctx, L, cx, cy, rr, dt, this.t, this.col);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // the little avatar the auras are drawn around
  function figure(ctx, cx, cy, R, col, bob) {
    const y = cy + (bob || 0), u = R / 200;
    ctx.save(); ctx.translate(cx, y);
    const body = new Path2D();
    body.arc(0, -78 * u, 26 * u, 0, TAU);                                  // head
    body.moveTo(-34 * u, -36 * u);
    body.quadraticCurveTo(0, -52 * u, 34 * u, -36 * u);
    body.lineTo(46 * u, 40 * u); body.lineTo(34 * u, 44 * u); body.lineTo(30 * u, -4 * u); // right arm
    body.lineTo(24 * u, 120 * u); body.lineTo(4 * u, 120 * u); body.lineTo(0, 46 * u);
    body.lineTo(-4 * u, 120 * u); body.lineTo(-24 * u, 120 * u); body.lineTo(-30 * u, -4 * u);
    body.lineTo(-34 * u, 44 * u); body.lineTo(-46 * u, 40 * u); body.closePath();
    const g = ctx.createLinearGradient(0, -100 * u, 0, 120 * u);
    g.addColorStop(0, '#1e2638'); g.addColorStop(1, '#0a0e18');
    ctx.fillStyle = g; ctx.fill(body, 'nonzero');
    ctx.shadowColor = rgba(col || [150, 170, 200], .9); ctx.shadowBlur = 14 * u;
    ctx.strokeStyle = rgba(col || [150, 170, 200], .75); ctx.lineWidth = 2 * u; ctx.stroke(body);
    ctx.shadowBlur = 10 * u; ctx.fillStyle = col ? rgba(mix(col, [255, 255, 255], .6), .95) : 'rgba(190,205,230,.8)';
    ctx.fillRect(-12 * u, -82 * u, 8 * u, 3.5 * u); ctx.fillRect(4 * u, -82 * u, 8 * u, 3.5 * u);
    ctx.restore();
  }

  return { AuraFX, figure, hex, rgba, mix, dot, rnd, TAU, variantColors };
})();
