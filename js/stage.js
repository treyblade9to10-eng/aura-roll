'use strict';
// ---- the main stage: sky, weather, avatar, charge-up and reveal effects ----

class Stage {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.fx = new FX.AuraFX();
    this.t = 0; this.w = 0; this.h = 0;
    this.biome = 'normal'; this.skyFrom = BIOMES.normal.sky.map(FX.hex); this.skyTo = this.skyFrom; this.skyT = 1;
    this.weather = []; this.acc = 0; this.shoot = [];
    this.bg = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * .7, s: Math.random() * 1.4 + .3, ph: Math.random() * 6.28 }));
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: .08 + Math.random() * .22, s: .18 + Math.random() * .2, v: .004 + Math.random() * .006 }));
    this.charge = 0; this.chargeTarget = 0; this.chargeCol = [255, 255, 255]; this.cp = []; this.bursts = []; this.rings = []; this.pillars = [];
    this.shakeAmt = 0; this.flashA = 0; this.flashC = [255, 255, 255]; this.dim = 0; this.dimTarget = 0; this.hasAura = false;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
  }
  resize() {
    const r = (this.cv.parentElement || this.cv).getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(200, r.width); this.h = Math.max(200, r.height);
    this.cv.width = this.w * dpr; this.cv.height = this.h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setBiome(id) {
    if (id === this.biome) return;
    // blend from whatever sky is on screen right now
    this.skyFrom = this.curSky(); this.skyTo = BIOMES[id].sky.map(FX.hex); this.skyT = 0; this.biome = id;
  }
  curSky() { const e = Math.min(1, this.skyT); return this.skyFrom.map((c, i) => FX.mix(c, this.skyTo[i], e)); }
  setAura(aura, variant) { if (aura) { this.fx.set(aura, variant); this.hasAura = true; } else { this.fx.aura = null; this.hasAura = false; } }
  startCharge(hex, level) { this.chargeCol = FX.hex(hex); this.chargeTarget = level; }
  endCharge() { this.chargeTarget = 0; }
  setDim(v) { this.dimTarget = v; }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  flash(hex, a) { this.flashC = FX.hex(hex); this.flashA = Math.max(this.flashA, a); }

  reveal(tier, hex) {
    const c = FX.hex(hex), n = 40 + tier * 45, cx = this.w / 2, cy = this.cy();
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 160 + Math.random() * (500 + tier * 160); this.bursts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 2 + Math.random() * 4, c: Math.random() < .35 ? [255, 255, 255] : c, age: 0, life: .7 + Math.random() * (.8 + tier * .15) }); }
    for (let i = 0; i < Math.min(5, 1 + tier); i++) this.rings.push({ age: -i * .09, life: 1 + tier * .08, c, max: this.R() * (2.2 + tier * .5) });
    if (tier >= 3) this.pillars.push({ age: 0, life: 1.4 + tier * .25, c, w: this.R() * (.35 + tier * .08) });
    this.flash(hex, .2 + tier * .1); this.shake(3 + tier * 5);
  }
  R() { return Math.min(this.h * .3, this.w * .34); }
  cy() { return this.h * (this.w < this.h ? .46 : .5); }

  frame(dt) {
    dt = Math.min(dt, .05); this.t += dt; const ctx = this.ctx, w = this.w, h = this.h, t = this.t;
    this.skyT = Math.min(1, this.skyT + dt / 2.5);
    this.charge += (this.chargeTarget - this.charge) * Math.min(1, dt * 5); this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 4);
    const sky = this.curSky(), R = this.R(), cx = w / 2, cy = this.cy();
    const sh = this.shakeAmt; this.shakeAmt = Math.max(0, this.shakeAmt - dt * 22);
    ctx.save();
    if (sh > .1) ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, FX.rgba(sky[0], 1)); g.addColorStop(.55, FX.rgba(sky[1], 1)); g.addColorStop(1, FX.rgba(sky[2], 1));
    ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, h + 40);
    const dark = 1 - Math.min(1, (sky[0][0] + sky[0][1] + sky[0][2]) / 150);
    for (const s of this.bg) { const a = (.25 + .75 * dark) * (.5 + .5 * Math.sin(t * 1.4 + s.ph)); ctx.fillStyle = 'rgba(255,255,255,' + a * .9 + ')'; ctx.fillRect(s.x * w, s.y * h, s.s, s.s); }
    this.skyBodies(ctx, w, h, t);
    this.mountains(ctx, w, h, sky);
    ctx.globalAlpha = .5; for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.3) c.x = -.3; FX.dot(ctx, FX.mix(sky[1], [0, 0, 0], .35), c.x * w, c.y * h, c.s * w * .6, .6); } ctx.globalAlpha = 1;

    // ground
    const gy = cy + R * .6;
    const gg = ctx.createLinearGradient(0, gy - 4, 0, h); gg.addColorStop(0, FX.rgba(FX.mix(sky[2], [0, 0, 0], .72), 1)); gg.addColorStop(1, '#05070b');
    ctx.fillStyle = gg; ctx.fillRect(-20, gy, w + 40, h - gy + 20);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(-20, gy, w + 40, 1.5);
    const gc = this.hasAura ? this.fx.col[0] : [120, 140, 180], pulse = 1 + this.charge * .8;
    ctx.save(); ctx.translate(cx, gy + 6); ctx.scale(1, .22);
    const ge = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.5 * pulse); ge.addColorStop(0, FX.rgba(gc, .6)); ge.addColorStop(1, FX.rgba(gc, 0));
    ctx.fillStyle = ge; ctx.beginPath(); ctx.arc(0, 0, R * 1.5 * pulse, 0, 6.283); ctx.fill(); ctx.restore();

    // pillars of light behind everything for big reveals
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i]; p.age += dt; if (p.age > p.life) { this.pillars.splice(i, 1); continue; }
      const u = p.age / p.life, a = (1 - u) * (u < .1 ? u * 10 : 1), pw = p.w * (1 - u * .5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pg = ctx.createLinearGradient(cx - pw, 0, cx + pw, 0); pg.addColorStop(0, FX.rgba(p.c, 0)); pg.addColorStop(.5, FX.rgba(p.c, .75 * a)); pg.addColorStop(1, FX.rgba(p.c, 0));
      ctx.fillStyle = pg; ctx.fillRect(cx - pw, 0, pw * 2, gy + 10);
      const pg2 = ctx.createLinearGradient(cx - pw * .3, 0, cx + pw * .3, 0); pg2.addColorStop(0, 'rgba(255,255,255,0)'); pg2.addColorStop(.5, 'rgba(255,255,255,' + a + ')'); pg2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = pg2; ctx.fillRect(cx - pw * .3, 0, pw * .6, gy + 10); ctx.restore();
    }

    this.weatherStep(ctx, dt, w, h, sky);

    // charge glow
    const bob = Math.sin(t * 1.6) * R * .018 - this.charge * R * .05;
    if (this.charge > .02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cg = ctx.createRadialGradient(cx, cy, R * .1, cx, cy, R * (1 + this.charge * .8)); cg.addColorStop(0, FX.rgba(this.chargeCol, .5 * this.charge)); cg.addColorStop(1, FX.rgba(this.chargeCol, 0));
      ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
      this.chargeStep(ctx, dt, cx, cy, R); ctx.restore();
    }

    // aura + avatar
    const jx = this.charge > .3 ? (Math.random() - .5) * this.charge * R * .02 : 0;
    this.fx.draw(ctx, cx + jx, cy + bob, R, dt, 'back');
    FX.figure(ctx, cx + jx, cy, R, this.hasAura ? this.fx.col[0] : null, bob);
    this.fx.draw(ctx, cx + jx, cy + bob, R, dt, 'front');

    // burst, rings
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.age += dt; if (b.age > b.life) { this.bursts.splice(i, 1); continue; }
      b.vx *= 1 - dt * 1.6; b.vy = b.vy * (1 - dt * 1.6) + 120 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const u = b.age / b.life; ctx.strokeStyle = FX.rgba(b.c, 1 - u); ctx.lineWidth = b.s * (1 - u * .6); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .03, b.y - b.vy * .03); ctx.stroke();
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.age += dt; if (r.age > r.life) { this.rings.splice(i, 1); continue; } if (r.age < 0) continue;
      const u = r.age / r.life; ctx.strokeStyle = FX.rgba(r.c, (1 - u) * .9); ctx.lineWidth = 2 + 16 * (1 - u); ctx.beginPath(); ctx.arc(cx, cy, r.max * (1 - Math.pow(1 - u, 3)), 0, 6.283); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // vignette, dim, flash
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (.5 + this.dim * .4) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    if (this.dim > .01) { ctx.fillStyle = 'rgba(0,0,0,' + this.dim * .45 + ')'; ctx.fillRect(0, 0, w, h); }
    if (this.flashA > .01) { ctx.fillStyle = FX.rgba(this.flashC, Math.min(1, this.flashA)); ctx.fillRect(0, 0, w, h); this.flashA -= dt * 1.6; }
    if (this.biome === 'glitched') this.glitchOverlay(ctx, w, h);
  }

  skyBodies(ctx, w, h, t) {
    const b = this.biome, a = Math.min(1, this.skyT * 1.2);
    if (b === 'night' || b === 'bloodmoon') {
      const bm = b === 'bloodmoon', x = w * .8, y = h * .2, r = Math.min(w, h) * (bm ? .09 : .06);
      ctx.save(); ctx.globalAlpha = a; FX.dot(ctx, bm ? [255, 40, 60] : [190, 210, 255], x, y, r * 3.2, .5);
      ctx.fillStyle = bm ? '#ff4d5e' : '#eaf0ff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = bm ? 'rgba(120,0,20,.35)' : 'rgba(120,140,190,.25)'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .1, r * .22, 0, 6.283); ctx.arc(x + r * .35, y + r * .3, r * .15, 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (b === 'eclipse') {   // black sun with a burning rim
      const x = w * .72, y = h * .2, r = Math.min(w, h) * .085; ctx.save(); ctx.globalAlpha = a;
      FX.dot(ctx, [255, 170, 60], x, y, r * 4.2, .6); FX.dot(ctx, [255, 230, 170], x, y, r * 1.9, .55 + .1 * Math.sin(t * 2));
      ctx.fillStyle = '#020006'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,140,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 6.283); ctx.stroke(); ctx.restore();
    }
    if (b === 'rainbow') {   // a big soft arc behind the mountains
      const cx = w * .5, cy = this.cy() + this.R() * .6 + h * .05, R0 = Math.min(w * .62, h * .6), cols = ['#ff4d4d', '#ff9a2e', '#ffe14a', '#4dff88', '#4dc8ff', '#7a5cff'];
      ctx.save(); ctx.globalAlpha = a * (.3 + .06 * Math.sin(t * .8)); ctx.lineWidth = R0 * .07;
      cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(cx, cy, R0 - i * R0 * .07, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }); ctx.restore();
    }
    if (b === 'night' || b === 'normal') { // shooting stars
      if (Math.random() < .004) this.shoot.push({ x: Math.random() * w, y: Math.random() * h * .3, age: 0, life: .7 });
    }
    for (let i = this.shoot.length - 1; i >= 0; i--) {
      const s = this.shoot[i]; s.age += .016; if (s.age > s.life) { this.shoot.splice(i, 1); continue; }
      const u = s.age / s.life, x = s.x + u * 260, y = s.y + u * 120; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - u) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 50, y - 23); ctx.stroke();
    }
  }
  mountains(ctx, w, h, sky) {
    const gy = this.cy() + this.R() * .6;
    for (let l = 0; l < 2; l++) {
      ctx.fillStyle = FX.rgba(FX.mix(sky[1], [0, 0, 0], .45 + l * .2), 1); ctx.beginPath(); ctx.moveTo(-10, gy);
      for (let x = -10; x <= w + 10; x += 14) ctx.lineTo(x, gy - (30 + l * -10 + Math.sin(x * .006 + l * 2) * 26 + Math.sin(x * .017 + l) * 12 + Math.abs(Math.sin(x * .004 + l * 5)) * 40) * (h / 520));
      ctx.lineTo(w + 10, gy); ctx.closePath(); ctx.fill();
    }
  }
  weatherStep(ctx, dt, w, h, sky) {
    const fxk = BIOMES[this.biome].fx, W = this.weather;
    const rate = { rain: 240, snow: 100, ash: 36, glitch: 5 }[fxk] || 0;
    this.acc += rate * dt; let n = Math.floor(this.acc); this.acc -= n; n = Math.min(n, 14);
    while (n--) {
      if (fxk === 'rain') W.push({ k: 'r', x: Math.random() * (w + 200), y: -20, vx: -140, vy: 900 + Math.random() * 300, age: 0, life: 1.6 });
      else if (fxk === 'snow') W.push({ k: 's', x: Math.random() * (w + 300), y: -10, vx: -90 - Math.random() * 60, vy: 70 + Math.random() * 90, s: 1 + Math.random() * 2.4, ph: Math.random() * 6, age: 0, life: 9 });
      else if (fxk === 'ash') W.push({ k: 'a', x: Math.random() * w, y: h + 10, vx: 0, vy: -(30 + Math.random() * 50), s: 1 + Math.random() * 2, ph: Math.random() * 6, age: 0, life: 9 });
      else if (fxk === 'glitch') W.push({ k: 'g', x: Math.random() * w, y: Math.random() * h, s: 6 + Math.random() * 60, hh: 2 + Math.random() * 6, age: 0, life: .12 + Math.random() * .2 });
    }
    ctx.save();
    for (let i = W.length - 1; i >= 0; i--) {
      const p = W[i]; p.age += dt; if (p.age > p.life || p.y > h + 20 || p.y < -30) { W[i] = W[W.length - 1]; W.pop(); continue; }
      if (p.k === 'r') { p.x += p.vx * dt; p.y += p.vy * dt; ctx.strokeStyle = 'rgba(170,200,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y - 20); ctx.stroke(); }
      else if (p.k === 's') { p.x += (p.vx + Math.sin(this.t + p.ph) * 30) * dt; p.y += p.vy * dt; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
      else if (p.k === 'a') { p.x += Math.sin(this.t + p.ph) * 20 * dt; p.y += p.vy * dt; FX.dot(ctx, [255, 60, 70], p.x, p.y, p.s * 3, .7); }
      else { ctx.fillStyle = Math.random() < .5 ? 'rgba(0,255,157,.35)' : 'rgba(255,0,85,.3)'; ctx.fillRect(p.x, p.y, p.s, p.hh); }
    }
    ctx.restore();
    if (fxk === 'rain' && Math.random() < .006) { this.flash('#bcd4ff', .22); this.shake(2); }
  }
  chargeStep(ctx, dt, cx, cy, R) {
    const n = Math.floor(this.charge * 55 * dt * 6 * Math.random() + this.charge * 3);
    for (let i = 0; i < n && this.cp.length < 220; i++) { const a = Math.random() * 6.283, r = R * (1.6 + Math.random() * 1.3); this.cp.push({ a, r, age: 0, life: .5 + Math.random() * .4, s: 1.5 + Math.random() * 2.5 }); }
    for (let i = this.cp.length - 1; i >= 0; i--) {
      const p = this.cp[i]; p.age += dt; if (p.age > p.life) { this.cp.splice(i, 1); continue; }
      const u = p.age / p.life, rr = p.r * (1 - u * u) + R * .15, a = p.a + u * 1.2, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * .8;
      ctx.strokeStyle = FX.rgba(this.chargeCol, u); ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(x, y); const rr2 = rr + R * .12, a2 = a - .06; ctx.lineTo(cx + Math.cos(a2) * rr2, cy + Math.sin(a2) * rr2 * .8); ctx.stroke();
    }
  }
  glitchOverlay(ctx, w, h) {
    if (Math.random() < .15) { ctx.fillStyle = 'rgba(0,255,157,.08)'; ctx.fillRect(0, Math.random() * h, w, 3 + Math.random() * 20); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  }
}

// small preview of one aura (inventory detail / index)
class Preview {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.fx = new FX.AuraFX(); this.t = 0; this.on = false; this.last = 0; }
  show(aura, variant) {
    this.fx.set(aura, variant); this.on = true; this.last = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.w = r.width; this.h = r.height; this.cv.width = this.w * dpr; this.cv.height = this.h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const loop = now => { if (!this.on) return; const dt = (now - this.last) / 1000; this.last = now; this.draw(dt); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  stop() { this.on = false; }
  draw(dt) {
    const ctx = this.ctx, w = this.w, h = this.h, R = Math.min(w, h) * .36, cx = w / 2, cy = h * .52;
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#05070d'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    this.fx.draw(ctx, cx, cy, R, dt, 'back');
    FX.figure(ctx, cx, cy, R, this.fx.col[0], Math.sin(this.fx.t * 1.6) * R * .018);
    this.fx.draw(ctx, cx, cy, R, dt, 'front');
  }
}
