'use strict';
// ---- v1.4 systems on top of Game: daily quests + streak, rotating market, rebirth, fusion ----

// small seeded random so every player sees the same quests and market for the same time window
function seeded(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

Object.assign(Game, {
  // ------------------------------------------------------------ daily quests
  dayNum() { return Math.floor(Date.now() / 86400000); },
  ensureQuests() {
    const s = this.s, day = this.dayNum();
    if (s.q && s.q.day === day) return s.q;
    // a new day: 3 different quests, same for everyone, the amount scales a little with how much you have played
    const rnd = seeded(day * 7919 + 13), pool = QUEST_DEFS.slice(), list = [];
    const scale = s.rolls > 3000 ? 2 : s.rolls > 500 ? 1 : 0;
    while (list.length < 3 && pool.length) {
      const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0], step = Math.min(d.need.length - 1, Math.max(0, Math.floor(rnd() * 2) + scale - 1));
      list.push({ id: d.id, need: d.need[step], have: 0, claimed: false, w: d.w });
    }
    s.q = { day, list, bonus: false };
    return s.q;
  },
  questDef(id) { return QUEST_DEFS.find(d => d.id === id); },
  questReward(q) { return Math.max(300, Math.round((250 + this.s.rolls * 1.5) * q.w * (1 + Math.min(this.streakN(), 7) * 0.1))); },
  streakN() { const st = this.s.streak, d = this.dayNum(); return st && (st.last === d || st.last === d - 1) ? st.n : 0; },
  questProgress(kind, n) {
    const q = this.ensureQuests(); let hit = false;
    for (const it of q.list) { const d = this.questDef(it.id); if (d && d.kind === kind && it.have < it.need) { it.have = Math.min(it.need, it.have + (n || 1)); hit = true; if (it.have >= it.need) this.emit('questDone', it); } }
    if (hit) this.save(true);
  },
  claimQuest(i) {
    const q = this.ensureQuests(), it = q.list[i]; if (!it || it.claimed || it.have < it.need) return 0;
    const g = this.questReward(it); it.claimed = true; this.s.coins += g;
    // streak: one claim per day extends it
    const st = this.s.streak, d = this.dayNum();
    if (st.last !== d) { st.n = st.last === d - 1 ? st.n + 1 : 1; st.last = d; if (st.n % 7 === 0) { this.s.potions.luck2 = (this.s.potions.luck2 || 0) + 1; this.emit('streak7'); } }
    this.save(); return g;
  },
  claimQuestBonus() {
    const q = this.ensureQuests(); if (q.bonus || !q.list.every(x => x.claimed)) return false;
    q.bonus = true; this.s.potions.luck1 = (this.s.potions.luck1 || 0) + 2; this.s.coins += Math.max(1000, this.s.rolls * 4); this.save(); return true;
  },

  // ------------------------------------------------------------ rotating market (new stock every 6 hours)
  marketWin() { return Math.floor(Date.now() / MARKET_MS); },
  marketKey() { return this.marketWin() + ':' + (this.s.marketBump || 0); },
  marketEndsIn() { return (this.marketWin() + 1) * MARKET_MS - Date.now(); },
  // 4 potions (better than the shop ones) + a plain aura offer + a Shiny offer
  marketStock() {
    const rnd = seeded(this.marketWin() * 2654435761 + (this.s.marketBump || 0) * 104729), items = [];
    const pool = MARKET_POTIONS.slice(), pot = [];
    while (pot.length < 4) pot.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    pot.sort((a, b) => a.cost - b.cost).forEach(p => items.push({ id: 'p:' + p.id, type: 'potion', pid: p.id, price: p.cost, stock: p.stock }));
    const normal = AURAS.filter(a => !a.biome && !a.rb && !a.hours && a.odds >= 2000 && a.odds <= 3e6), cheap = AURAS.filter(a => !a.biome && !a.rb && !a.hours && a.odds >= 300 && a.odds <= 60000);
    const a1 = normal[Math.floor(rnd() * normal.length)], a2 = cheap[Math.floor(rnd() * cheap.length)];
    items.push({ id: 'a:' + a1.id + ':normal', type: 'aura', key: a1.id + ':normal', price: this.marketPrice(a1, VARIANT_BY_ID.normal), stock: 1 });
    items.push({ id: 'a:' + a2.id + ':shiny', type: 'aura', key: a2.id + ':shiny', price: this.marketPrice(a2, VARIANT_BY_ID.shiny), stock: 1 });
    return items;
  },
  // ---- quick market: same idea, but a new 3-item stock every 10 minutes (and a small chance of a rare find)
  quickWin() { return Math.floor(Date.now() / QUICK_MS); },
  quickKey() { return 'q' + this.quickWin() + ':' + (this.s.marketBump || 0); },
  quickEndsIn() { return (this.quickWin() + 1) * QUICK_MS - Date.now(); },
  quickStock() {
    const rnd = seeded(this.quickWin() * 40503 + 7 + (this.s.marketBump || 0) * 104729), items = [];
    const pool = QUICK_POTIONS.slice(), pot = [];
    while (pot.length < 2) pot.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    pot.sort((a, b) => a.cost - b.cost).forEach(p => items.push({ id: 'p:' + p.id, type: 'potion', pid: p.id, price: p.cost, stock: p.stock }));
    const cheap = AURAS.filter(a => !a.biome && !a.rb && !a.hours && a.odds >= 150 && a.odds <= 8000), a1 = cheap[Math.floor(rnd() * cheap.length)];
    items.push({ id: 'a:' + a1.id + ':normal', type: 'aura', key: a1.id + ':normal', price: Math.ceil(this.marketPrice(a1, VARIANT_BY_ID.normal) * 0.8), stock: 2 });
    if (rnd() < 0.25) { const r = MARKET_POTIONS.filter(p => p.kind !== 'beacon'), p = r[Math.floor(rnd() * r.length)]; items.push({ id: 'r:' + p.id, type: 'potion', pid: p.id, price: Math.ceil(p.cost * 1.4), stock: 1, rare: true }); }
    return items;
  },

  marketPrice(a, v) { return Math.ceil(Math.pow(a.odds, 0.95) * 25 * (v.mult > 1 ? v.mult * 0.7 : 1)); },
  // which = 'market' (6h) or 'quick' (10 min); each keeps its own bought-list in the save
  _mk(which) { const s = this.s; return which === 'quick' ? { slot: (s.quickM = s.quickM || { key: '', bought: {} }), key: this.quickKey(), stock: () => this.quickStock() } : { slot: s.market, key: this.marketKey(), stock: () => this.marketStock() }; },
  marketBought(id, which) { const m = this._mk(which); return m.slot && m.slot.key === m.key ? (m.slot.bought[id] || 0) : 0; },
  buyMarket(id, which) {
    const m = this._mk(which), it = m.stock().find(x => x.id === id); if (!it) return 'gone';
    if (this.marketBought(id, which) >= it.stock) return 'soldout';
    if (this.s.coins < it.price) return 'poor';
    if (m.slot.key !== m.key) { m.slot.key = m.key; m.slot.bought = {}; }
    this.s.coins -= it.price; m.slot.bought[id] = (m.slot.bought[id] || 0) + 1;
    if (it.type === 'potion') this.s.potions[it.pid] = (this.s.potions[it.pid] || 0) + 1; else this.giveAura(it.key, 1);
    this.save(); this.emit('market', it); return 'ok';
  },

  // ------------------------------------------------------------ rebirth
  rebirthReq() { return rebirthReq(this.s.rebirths || 0); },
  canRebirth() { return (this.s.rbBest || 0) >= this.rebirthReq(); },
  // reset the grind for permanent bonuses and new auras. Keeps: the index, goals, settings, stats and your single best aura.
  rebirth(force) {
    if (!force && !this.canRebirth()) return false;
    const s = this.s; s.rebirths = (s.rebirths || 0) + 1;
    const keep = Object.keys(s.inv).filter(k => s.inv[k] > 0).sort((a, b) => info(b).eff - info(a).eff)[0];
    s.inv = keep ? { [keep]: 1 } : {}; s.equipped = keep || null;
    s.coins = 2500 * s.rebirths; s.up = { luck: 0, speed: 0, coins: 0, auto: 0, skip: 0 }; s.potions = {}; s.active = []; s.rbBest = 0; s.forcedNext = null;
    this.cooldown = 0; this.save(); this.emit('rebirth', s.rebirths); return true;
  },

  // ------------------------------------------------------------ fusion: FUSE_COST of the same aura -> one rarer aura
  fuseOptions(key) {
    const [id, v] = key.split(':'), a = AURA_BY_ID[id]; if (!a) return [];
    return AURAS.filter(x => !x.biome && !x.rb && !x.hours && x.odds >= a.odds * 3 && x.odds <= a.odds * 40);
  },
  canFuse(key) { return (this.s.inv[key] || 0) >= FUSE_COST && this.fuseOptions(key).length > 0; },
  fuse(key) {
    if (!this.canFuse(key)) return null;
    const opts = this.fuseOptions(key), v = VARIANT_BY_ID[key.split(':')[1]] || VARIANTS[0];
    // closer (more common) results are likelier, but a big jump can happen
    const w = opts.map(o => 1 / Math.pow(o.odds, 0.7)), tot = w.reduce((a, b) => a + b, 0); let r = Math.random() * tot, pick = opts[0];
    for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) { pick = opts[i]; break; } }
    this.takeAura(key, FUSE_COST);
    const res = { aura: pick, variant: v, key: pick.id + ':' + v.id, fused: true, coins: 0 };
    const s = this.s; res.isNew = !s.index[pick.id]; res.isNewVariant = !s.seen[res.key];
    this.giveAura(res.key, 1);
    res.eff = pick.odds * v.chance; if (res.eff > (s.rbBest || 0)) s.rbBest = res.eff;
    this.save(); this.emit('fused', res); return res;
  },
});

// quest progress listens to what happens in the game
Game.on('rolled', res => {
  const a = res.aura, v = res.variant, t = tierIndex(a.odds);
  Game.questProgress('rolls', 1);
  if (res.isNew) Game.questProgress('new', 1);
  if (t >= 2) Game.questProgress('rare', 1);
  if (t >= 3) Game.questProgress('epic', 1);
  if (v.id !== 'normal') Game.questProgress('variant', 1);
  if (Game.biome !== 'normal') Game.questProgress('biome', 1);
});
Game.on('potion', () => Game.questProgress('potion', 1));
Game.on('sold', () => Game.questProgress('sell', 1));
Game.on('fused', res => { Game.questProgress('fuse', 1); if (res.isNew) Game.questProgress('new', 1); });
