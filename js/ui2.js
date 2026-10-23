'use strict';
// ---- v1.4 screens: rotating Market, daily Quests + streak, Rebirth, fusion ----

function fmtClock(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function fmtLong(ms) { const m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? h + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm'; }

Object.assign(UI, {
  shopTab: 'shop', goalsTab: 'quests',

  subTabs(which, list) {
    const cur = which === 'shop' ? this.shopTab : this.goalsTab;
    return '<div class="subtabs">' + list.map(([id, l]) => '<button class="' + (cur === id ? 'on' : '') + '" data-act="sub" data-v="' + which + ':' + id + '">' + l + '</button>').join('') + '</div>';
  },

  // ---------------------------------------------------------------- clicks for everything in this file
  extraAct(act, v, t) {
    if (act === 'sub') { const [w, id] = v.split(':'); this[w + 'Tab'] = id; this.panelBodyTop(); if (w === 'shop') this.renderShop(); else this.renderGoals(); return true; }
    if (act === 'qclaim') { const g = Game.claimQuest(+v); if (g) { Sound.coin(); this.toast('Quest reward', '+' + fmtN(g) + ' coins', '#ffc83a'); } this.renderQuests(); this.refreshHud(); return true; }
    if (act === 'qbonus') { if (Game.claimQuestBonus()) { Sound.ach(); this.toast('All quests done!', 'Bonus coins and 2 Luck Potions', '#ffc83a', true); } this.renderQuests(); this.refreshHud(); return true; }
    if (act === 'mbuy') {
      const [w, id] = v.split('|'), r = Game.buyMarket(id, w);
      if (r === 'ok') { Sound.buy(); const it = (w === 'quick' ? Game.quickStock() : Game.marketStock()).find(x => x.id === id); this.toast('Bought', it.type === 'potion' ? POTION_BY_ID[it.pid].name : info(it.key).name, '#4de28a'); this.refreshEquipped(); } else Sound.deny();
      this.renderMarket(); this.refreshHud(); return true;
    }
    if (act === 'rebirth') {
      if (!Game.canRebirth()) { Sound.deny(); return true; }
      if (!t.dataset.arm) { t.dataset.arm = 1; t.textContent = 'TAP AGAIN TO REBIRTH'; return true; }
      Game.rebirth(); this.rebirthFx(); this.refreshAll(); return true;
    }
    if (act === 'flexEq') { if (Game.s.equipped) Flex.open(Game.s.equipped); else Sound.deny(); return true; }
    return this.socialAct ? this.socialAct(act, v, t) : false;
  },
  panelBodyTop() { $('#panelBody').scrollTop = 0; },

  // ---------------------------------------------------------------- market
  renderMarket() {
    const q = this.shopTab === 'quick', w = q ? 'quick' : 'market', s = Game.s, stock = q ? Game.quickStock() : Game.marketStock(), sc = $('#panelBody').scrollTop;
    this._mkKey = q ? Game.quickKey() : Game.marketKey();
    let h = q ? '<div class="mkhead"><div><b>Quick Market</b><small>Small, cheap deals that change every 10 minutes. Same for everyone. Keep an eye out for a rare find.</small></div><div class="mkt"><span>NEW STOCK IN</span><b id="mkTimer">' + fmtClock(Game.quickEndsIn()) + '</b></div></div>'
      : '<div class="mkhead"><div><b>Rotating Market</b><small>Stronger potions and aura deals than the shop. The stock is the same for everyone and changes every 6 hours.</small></div><div class="mkt"><span>NEW STOCK IN</span><b id="mkTimer">' + fmtLong(Game.marketEndsIn()) + '</b></div></div>';
    h += '<p class="sub" style="margin:0 0 6px">Potions stack: drink different ones and their luck multiplies. Drink the same one again and you get more time and more of its bonus.</p>';
    h += '<div class="sec">Potions</div>';
    for (const it of stock.filter(x => x.type === 'potion')) {
      const p = POTION_BY_ID[it.pid], left = it.stock - Game.marketBought(it.id, w), own = s.potions[p.id] || 0;
      h += '<div class="row" style="--rc:' + p.color + '"><div class="info"><div class="t" style="color:' + p.color + '">' + esc(p.name) + (it.rare ? ' <span class="rarefind">RARE FIND</span>' : '') + '</div><div class="d">' + esc(p.desc) + '</div><div class="v">' + (left > 0 ? left + ' left' : 'Sold out') + (own ? ' &middot; you own ' + own : '') + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn gold" data-act="mbuy" data-v="' + w + '|' + it.id + '" data-cost="' + it.price + '"' + (left > 0 && s.coins >= it.price ? '' : ' disabled') + '>' + (left > 0 ? 'BUY<small>' + fmtN(it.price) + '</small>' : 'SOLD OUT') + '</button>' + (own ? '<button class="btn" data-act="usep" data-v="' + p.id + '">USE</button>' : '') + '</div></div>';
    }
    h += '<div class="sec">Aura deals</div>';
    for (const it of stock.filter(x => x.type === 'aura')) {
      const i = info(it.key), left = it.stock - Game.marketBought(it.id, w), own = s.inv[it.key] || 0;
      h += '<div class="row" style="--rc:' + i.tier.color + '"><div class="info"><div class="t nmx t-' + i.tier.id + '" style="color:' + i.tier.color + '">' + esc(i.name) + '</div><div class="d">' + i.tier.name + ' &middot; ' + fmtOdds(i.eff) + '</div><div class="v">' + (left > 0 ? (it.stock > 1 ? left + ' left' : 'One available') : 'Sold out') + (own ? ' &middot; you own ' + own : '') + '</div></div>' +
        '<button class="btn gold" data-act="mbuy" data-v="' + w + '|' + it.id + '" data-cost="' + it.price + '"' + (left > 0 && s.coins >= it.price ? '' : ' disabled') + '>' + (left > 0 ? 'BUY<small>' + fmtN(it.price) + '</small>' : 'SOLD OUT') + '</button></div>';
    }
    this.setPanel('SHOP', this.subTabs('shop', [['shop', 'SHOP'], ['quick', 'QUICK'], ['market', 'MARKET']]) + h); $('#panelBody').scrollTop = sc;
  },
  // runs every refresh while the shop is open: re-enable buy buttons, tick the clock, rotate the stock when its time is up
  updateShopButtons() {
    const c = Game.s.coins; document.querySelectorAll('#panelBody [data-cost]').forEach(b => { if (!/SOLD OUT/.test(b.textContent)) b.disabled = c < +b.dataset.cost; });
    if (this.shopTab === 'market') { const el = $('#mkTimer'); if (el) el.textContent = fmtLong(Game.marketEndsIn()); if (this._mkKey !== Game.marketKey()) this.renderMarket(); }
    else if (this.shopTab === 'quick') { const el = $('#mkTimer'); if (el) el.textContent = fmtClock(Game.quickEndsIn()); if (this._mkKey !== Game.quickKey()) this.renderMarket(); }
  },

  // ---------------------------------------------------------------- daily quests
  renderQuests() {
    const q = Game.ensureQuests(), s = Game.s, n = Game.streakN(), cyc = n === 0 ? 0 : ((n - 1) % 7) + 1, sc = $('#panelBody').scrollTop;
    const untilNew = 86400000 - (Date.now() % 86400000);
    let h = '<div class="acct ' + (n ? 'saved' : 'out') + '"><div class="who">' + (n ? n + ' day streak' : 'No streak yet') + '</div><div class="pips">' +
      Array.from({ length: 7 }, (_, i) => '<i class="' + (i < cyc ? 'on' : '') + (i === 6 ? ' big' : '') + '"></i>').join('') + '</div>' +
      '<p class="sub" style="margin:8px 0 0">Claim a quest every day to grow your streak. Rewards go up 10% per day, and day 7 gives a Greater Luck Potion.</p></div>';
    h += '<div class="sec">Today\'s quests <span style="float:right;letter-spacing:.04em;text-transform:none;font-weight:600">new in ' + fmtLong(untilNew) + '</span></div>';
    q.list.forEach((it, i) => {
      const d = Game.questDef(it.id), done = it.have >= it.need, pct = Math.min(100, it.have / it.need * 100), rw = Game.questReward(it);
      h += '<div class="row' + (it.claimed ? ' done' : '') + '"><div class="info"><div class="t">' + esc(d.text(it.need)) + '</div><div class="qbar"><i style="width:' + pct + '%"></i></div><div class="v">' + it.have + ' / ' + it.need + ' &middot; <span style="color:var(--gold)">+' + fmtN(rw) + ' coins</span></div></div>' +
        (it.claimed ? '' : '<button class="btn gold" data-act="qclaim" data-v="' + i + '"' + (done ? '' : ' disabled') + '>CLAIM</button>') + '</div>';
    });
    const all = q.list.every(x => x.claimed);
    h += '<div class="row' + (q.bonus ? ' done' : '') + '" style="--rc:var(--gold)"><div class="info"><div class="t" style="color:var(--gold)">Daily bonus</div><div class="d">Finish and claim all three quests</div><div class="v">2 Luck Potions + ' + fmtN(Math.max(1000, s.rolls * 4)) + ' coins</div></div>' + (q.bonus ? '' : '<button class="btn gold" data-act="qbonus"' + (all ? '' : ' disabled') + '>CLAIM</button>') + '</div>';
    this.setPanel('GOALS', this.subTabs('goals', [['quests', 'QUESTS'], ['goals', 'GOALS'], ['ranks', 'RANKS']]) + h); $('#panelBody').scrollTop = sc;
  },

  // ---------------------------------------------------------------- rebirth (lives in the MORE tab)
  rebirthHtml() {
    const s = Game.s, n = s.rebirths || 0, req = Game.rebirthReq(), can = Game.canRebirth(), pct = Math.max(0, Math.min(100, Math.log10(Math.max(1, s.rbBest || 1)) / Math.log10(req) * 100));
    const unlocks = {}; AURAS.filter(a => a.rb).forEach(a => (unlocks[a.rb] = unlocks[a.rb] || []).push(a));
    let h = '<div class="sec">Rebirth</div><div class="acct ' + (can ? 'owner' : 'out') + '"><div class="who">Rebirths: ' + n + '</div>' +
      '<div class="kv" style="margin:6px 0 8px"><span>Permanent luck</span><span>x' + (1 + REBIRTH.luckPer * n).toFixed(2) + '</span><span>Permanent coins</span><span>x' + (1 + REBIRTH.coinPer * n).toFixed(2) + '</span></div>' +
      '<p class="sub" style="margin:0 0 8px">Roll an aura rarer than <b>1 in ' + fmtN(req) + '</b> since your last rebirth to be able to rebirth. You restart with 2,500 coins and just your best aura. You keep your Index, goals, stats and cutscenes, and every rebirth adds <b>+' + Math.round(REBIRTH.luckPer * 100) + '% luck</b> and <b>+' + Math.round(REBIRTH.coinPer * 100) + '% coins</b> forever.</p>' +
      '<div class="prog" style="margin-bottom:8px"><div class="bar"><i style="width:' + pct + '%"></i></div><small><span>RAREST SINCE LAST REBIRTH</span><span>' + (s.rbBest ? '1 in ' + fmtN(s.rbBest) : 'none') + '</span></small></div>' +
      '<button class="btn ' + (can ? 'gold' : '') + '" data-act="rebirth" style="width:100%"' + (can ? '' : ' disabled') + '>' + (can ? 'REBIRTH' : 'NOT YET') + '</button></div>';
    h += '<details class="adv"><summary>Rebirth-only auras</summary>' + Object.keys(unlocks).sort((a, b) => a - b).map(r => '<p class="sub" style="margin:4px 0"><b style="color:' + (n >= r ? 'var(--good)' : '#fff') + '">Rebirth ' + r + (n >= r ? ' (unlocked)' : '') + ':</b> ' + unlocks[r].map(a => (s.index[a.id] || n >= r ? esc(a.name) : '???') + ' (' + fmtOdds(a.odds) + ')').join(', ') + '</p>').join('') + '</details>';
    h += '<div class="sec">Flex</div><p class="sub">Make a shareable card of your equipped aura.</p><button class="btn ghost" data-act="flexEq" style="width:100%">MAKE FLEX CARD</button>';
    return h;
  },
  rebirthFx() {
    const d = document.createElement('div'); d.className = 'rbfx';
    d.innerHTML = '<div class="r1">REBIRTH</div><div class="r2">REBORN</div><div class="r3">+' + Math.round(REBIRTH.luckPer * 100) + '% luck &middot; +' + Math.round(REBIRTH.coinPer * 100) + '% coins, forever</div>';
    $('#app').appendChild(d); Sound.reveal(7); this.stage.flash('#ffffff', 1.4); this.stage.shake(26); this.stage.reveal(7, '#ffd24a');
    setTimeout(() => d.remove(), 3600);
  },

  // ---------------------------------------------------------------- fusion
  doFuse(key) {
    const res = Game.fuse(key); if (!res) { Sound.deny(); return; }
    this.closeModal(); this.lastRes = res; this.hideReveal(true);
    const tier = Math.min(7, tierIndex(res.eff));
    this.refreshEquipped(); this.refreshHud(); if (this.tab === 'bag') this.renderBag(); if (this.tab === 'index') this.renderIndex();
    if (tier >= 5 && (Game.s.settings.cine || 'full') !== 'off') { this.busy = true; Cutscene.play(res, tier, () => { this.showCard(res); this.busy = false; }); }
    else { this.stage.reveal(tier, this.colorOf(res)); Sound.reveal(tier); this.showCard(res); }
    if (res.isNew) this.badge.bag = true;
  },
});

Game.on('questDone', it => { const d = Game.questDef(it.id); UI.toast('Quest complete', d.text(it.need) + ' - claim it in GOALS', '#ffc83a', true); });
Game.on('streak7', () => UI.toast('7 day streak!', 'A Greater Luck Potion was added to your bag', '#ffc83a', true));
