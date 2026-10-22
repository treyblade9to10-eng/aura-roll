'use strict';
// ---- game state, rolling math, economy, saving ----

const SAVE_KEY = 'auraroll.save.v1';
const DAILY_MS = 20 * 3600 * 1000;

function freshState() {
  return {
    v: 2, coins: 0, rolls: 0, inv: {}, index: {}, variantsSeen: {},
    equipped: null,            // 'auraId:variant'
    up: { luck: 0, speed: 0, coins: 0, auto: 0, skip: 0 },
    potions: {},               // id -> count owned
    active: [],                // [{id, kind, mult, left}]
    ach: {}, best: null, bestOdds: 0, play: 0, created: Date.now(),
    settings: { sound: true, quick: false, auto: false, cine: 'full' },
    seen: {},                  // keys revealed at least once (for index NEW badges)
    admin: { luck: 1, nocd: false, used: false },   // owner tools; only honored while Cloud.admin is true
  };
}

const Game = {
  s: freshState(),
  biome: 'normal', biomeLeft: 0, nextBiome: 90,
  cooldown: 0, busy: false, listeners: {},

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
  emit(ev, a, b) { (this.listeners[ev] || []).forEach(f => f(a, b)); },

  setState(d) {
    const f = freshState();
    this.s = Object.assign(f, d); this.s.up = Object.assign(freshState().up, d.up); this.s.settings = Object.assign(freshState().settings, d.settings); this.s.admin = Object.assign(freshState().admin, d.admin);
    this.s.active = (this.s.active || []).filter(p => p.left > 0);
    this.save(true);
  },
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) this.setState(JSON.parse(raw)); } catch (e) { console.warn('save load failed', e); }
  },
  // quiet = periodic background save (does not count as a change worth sending to the cloud)
  save(quiet) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { }
    if (!quiet) this.emit('changed');
  },
  exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.s)))); },
  importCode(code) {
    try { const d = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if (typeof d.coins !== 'number' || !d.inv) return false; this.setState(d); this.save(); return true; } catch (e) { return false; }
  },
  reset() { this.s = freshState(); this.save(); },

  // ---- owner tools (only work while the signed-in account is verified as the owner) ----
  isAdmin() { return typeof Cloud !== 'undefined' && Cloud.admin === true; },
  adminLuck() { return this.isAdmin() ? Math.max(1, this.s.admin.luck || 1) : 1; },

  // ---- multipliers ----
  potionMult(kind) { let m = 1; for (const p of this.s.active) if (p.kind === kind) m = Math.max(m, p.mult); return m; },
  equippedAura() { const k = this.s.equipped; return k ? AURA_BY_ID[k.split(':')[0]] : null; },
  equippedBonus() { const a = this.equippedAura(); return a ? Math.log10(a.odds) * 0.04 * (1 + (VARIANT_BY_ID[this.s.equipped.split(':')[1]].mult > 1 ? .5 : 0)) : 0; },
  luck() { return (1 + this.s.up.luck * 0.06) * this.potionMult('luck') * BIOMES[this.biome].luck * (1 + this.equippedBonus()) * this.adminLuck(); },
  coinMult() { const a = this.equippedAura(); return (1 + this.s.up.coins * 0.12) * (a ? 1 + Math.log10(a.odds) * 0.05 : 1); },
  cooldownSecs() { return this.isAdmin() && this.s.admin.nocd ? 0 : rollCooldown(this.s.up.speed) / this.potionMult('speed'); },

  // ---- the roll ----
  pickAura(luck, biome) {
    // check from rarest to most common; each aura wins with chance luck/odds
    const pool = AURAS.filter(a => !a.biome || a.biome === biome).sort((x, y) => y.odds - x.odds);
    for (const a of pool) if (Math.random() < Math.min(1, luck / a.odds)) return a;
    return AURA_BY_ID.faint;
  },
  pickVariant(luck) {
    // luck helps a little with variants (square-rooted so it can't get silly)
    const l = Math.sqrt(luck);
    for (let i = VARIANTS.length - 1; i > 0; i--) if (Math.random() < Math.min(1, l / VARIANTS[i].chance)) return VARIANTS[i];
    return VARIANTS[0];
  },
  coinsFor(aura, variant) { return Math.max(1, Math.ceil(Math.pow(aura.odds, 0.55) * variant.mult * this.coinMult() * 0.8)); },
  sellValue(aura, variant) { return Math.max(1, Math.ceil(Math.pow(aura.odds, 0.7) * variant.mult * 1.5)); },

  rollNow() {
    if (this.forced && this.isAdmin()) {
      const f = this.forced; this.forced = null;
      const aura = AURA_BY_ID[f.id], variant = VARIANT_BY_ID[f.variant] || VARIANTS[0];
      if (aura) return { aura, variant, key: aura.id + ':' + variant.id };
    }
    const luck = this.luck(), aura = this.pickAura(luck, this.biome), variant = this.pickVariant(luck);
    return { aura, variant, key: aura.id + ':' + variant.id };
  },
  award(res) {
    const s = this.s, { aura, variant, key } = res;
    const coins = this.coinsFor(aura, variant);
    const isNew = !s.index[aura.id], isNewVariant = !s.inv[key] && !s.seen[key];
    s.rolls++; s.coins += coins; s.inv[key] = (s.inv[key] || 0) + 1; s.seen[key] = 1;
    s.index[aura.id] = (s.index[aura.id] || 0) + 1;
    if (variant.id !== 'normal') s.variantsSeen[variant.id] = 1;
    const eff = aura.odds * variant.chance;
    if (eff > s.bestOdds) { s.bestOdds = eff; s.best = key; }
    res.coins = coins; res.isNew = isNew; res.isNewVariant = isNewVariant; res.eff = eff;
    if (!s.equipped) s.equipped = key;
    this.checkAch();
    this.save();
    return res;
  },
  checkAch() {
    for (const a of ACHIEVEMENTS) if (!this.s.ach[a.id] && a.check(this.s)) { this.s.ach[a.id] = Date.now(); this.s.coins += a.reward; this.emit('ach', a); }
  },

  adminCoins(n) { if (!this.isAdmin()) return; this.s.coins += n; this.s.admin.used = true; this.save(); },
  adminGive(key, n) {
    if (!this.isAdmin()) return; const [id, v] = key.split(':'), s = this.s, aura = AURA_BY_ID[id], variant = VARIANT_BY_ID[v]; if (!aura || !variant) return;
    s.inv[key] = (s.inv[key] || 0) + n; s.seen[key] = 1; s.index[id] = (s.index[id] || 0) + 1;
    if (v !== 'normal') s.variantsSeen[v] = 1;
    const eff = aura.odds * variant.chance; if (eff > s.bestOdds) { s.bestOdds = eff; s.best = key; }
    if (!s.equipped) s.equipped = key;
    s.admin.used = true; this.checkAch(); this.save();
  },

  // ---- inventory ----
  equip(key) { if ((this.s.inv[key] || 0) > 0) { this.s.equipped = key; this.save(); this.emit('equip', key); return true; } return false; },
  sellExtras(key) {
    const n = (this.s.inv[key] || 0) - 1; if (n <= 0) return 0;
    const [id, v] = key.split(':'), total = n * this.sellValue(AURA_BY_ID[id], VARIANT_BY_ID[v]);
    this.s.inv[key] = 1; this.s.coins += total; this.save(); return total;
  },

  // ---- shop ----
  upgradeCost(id) { const u = UPGRADES.find(x => x.id === id), l = this.s.up[id]; return l >= u.max ? Infinity : Math.ceil(u.base * Math.pow(u.grow, l)); },
  buyUpgrade(id) { const c = this.upgradeCost(id); if (this.s.coins < c) return false; this.s.coins -= c; this.s.up[id]++; this.save(); return true; },
  buyPotion(id) { const p = POTIONS.find(x => x.id === id); if (this.s.coins < p.cost) return false; this.s.coins -= p.cost; this.s.potions[id] = (this.s.potions[id] || 0) + 1; this.save(); return true; },
  usePotion(id) {
    if (!(this.s.potions[id] > 0)) return false;
    const p = POTIONS.find(x => x.id === id), cur = this.s.active.find(a => a.id === id);
    this.s.potions[id]--;
    if (cur) cur.left += p.secs; else this.s.active.push({ id, kind: p.kind, mult: p.mult, left: p.secs });
    this.save(); return true;
  },

  claimDaily() {
    if (Date.now() - (this.s.daily || 0) < DAILY_MS) return 0;
    const g = Math.max(500, Math.floor(this.s.rolls * 4)); this.s.daily = Date.now(); this.s.coins += g; this.s.potions.luck1 = (this.s.potions.luck1 || 0) + 1; this.save(); return g;
  },

  // ---- time-based stuff ----
  tick(dt) {
    const s = this.s; s.play += dt;
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    for (const p of s.active) p.left -= dt;
    const n = s.active.length; s.active = s.active.filter(p => p.left > 0); if (n !== s.active.length) this.emit('potionEnd');
    // biomes
    if (this.biome === 'normal') {
      this.nextBiome -= dt;
      if (this.nextBiome <= 0) {
        const opts = Object.values(BIOMES).filter(b => b.weight), tot = opts.reduce((a, b) => a + b.weight, 0); let r = Math.random() * tot, pick = opts[0];
        for (const b of opts) { r -= b.weight; if (r <= 0) { pick = b; break; } }
        this.setBiome(pick.id);
      }
    } else {
      this.biomeLeft -= dt;
      if (this.biomeLeft <= 0) { this.setBiome('normal'); this.nextBiome = 45 + Math.random() * 90; }
    }
  },
  setBiome(id) {
    const b = BIOMES[id]; this.biome = id; this.biomeLeft = b.dur[0] + Math.random() * (b.dur[1] - b.dur[0]); this.emit('biome', id);
  },
};
