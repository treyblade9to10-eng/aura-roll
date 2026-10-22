'use strict';
// ---- owner admin panel (opens only for the verified owner account) ----

const Admin = {
  coinSteps: [['+1K', 1e3], ['+1M', 1e6], ['+1B', 1e9], ['+1T', 1e12], ['+1Qa', 1e15]],
  luckSteps: [1, 5, 25, 100, 1000, 1000000],

  open() {
    if (!Game.isAdmin()) { UI.toast('Owner only', 'Unlock owner mode in MORE', '#ff4d6a'); return; }
    const s = Game.s, a = s.admin;
    const auraOpts = AURAS.slice().sort((x, y) => x.odds - y.odds).map(x => '<option value="' + x.id + '">' + esc(x.name) + ' (' + fmtOdds(x.odds) + ')</option>').join('');
    const varOpts = VARIANTS.map(v => '<option value="' + v.id + '">' + (v.name || 'Normal') + '</option>').join('');
    const biomeOpts = Object.values(BIOMES).map(b => '<option value="' + b.id + '"' + (b.id === Game.biome ? ' selected' : '') + '>' + b.name + '</option>').join('');
    UI.openDialog('Admin Panel',
      '<p class="sub">Only you can see this. The server confirmed your account.</p>' +
      '<div class="asec">Coins</div><div class="chips">' + this.coinSteps.map(c => '<button class="chip on" data-ad="coins" data-v="' + c[1] + '" style="--tc:var(--gold)">' + c[0] + '</button>').join('') + '</div>' +
      '<div class="arow"><input class="search" id="adCoins" inputmode="numeric" placeholder="Any amount" style="margin:0"><button class="btn gold" data-ad="coinsCustom">ADD</button></div>' +
      '<div class="asec">Luck boost</div><div class="chips">' + this.luckSteps.map(l => '<button class="chip' + (a.luck === l ? ' on' : '') + '" data-ad="luck" data-v="' + l + '">x' + l.toLocaleString() + '</button>').join('') + '</div>' +
      '<div class="arow"><span>No roll cooldown</span><button class="btn' + (a.nocd ? '' : ' ghost') + '" data-ad="nocd">' + (a.nocd ? 'ON' : 'OFF') + '</button></div>' +
      '<div class="asec">Aura</div><select id="adAura" class="search">' + auraOpts + '</select><select id="adVar" class="search">' + varOpts + '</select>' +
      '<div class="arow"><button class="btn" data-ad="forceRoll" style="flex:1">ROLL IT<small>with the full reveal</small></button><button class="btn gold" data-ad="give" style="flex:1">ADD TO BAG<small>instantly</small></button></div>' +
      '<div class="arow"><button class="btn ghost" data-ad="cine" style="flex:1">PREVIEW CUTSCENE<small>no roll, nothing changes</small></button></div>' +
      '<div class="asec">World</div><div class="arow"><select id="adBiome" class="search" style="margin:0">' + biomeOpts + '</select><button class="btn" data-ad="biome">SET BIOME</button></div>' +
      '<div class="asec">Quick unlocks</div><div class="arow"><button class="btn" data-ad="potions" style="flex:1">5 OF EACH POTION</button><button class="btn" data-ad="shop" style="flex:1">AUTO + FAST</button></div>' +
      '<div class="arow"><button class="btn" data-ad="all" style="flex:1">UNLOCK EVERY AURA<small>one of each</small></button></div>' +
      '<div class="acts"><button class="btn ghost" id="adClose">CLOSE</button></div>', false);
    $('#mbox').classList.add('admin');
    $('#adClose').onclick = () => UI.closeModal();
    $('#mbox').onclick = e => { const t = e.target.closest('[data-ad]'); if (t) this.act(t.dataset.ad, t.dataset.v); };
  },

  act(k, v) {
    const s = Game.s, a = s.admin; if (!Game.isAdmin()) return;
    Sound.init();
    if (k === 'coins') { Game.adminCoins(+v); Sound.coin(); UI.toast('+' + fmtN(+v) + ' coins', '', '#ffc83a'); }
    else if (k === 'coinsCustom') { const n = Math.floor(+String($('#adCoins').value).replace(/[, ]/g, '')); if (n > 0 && n < 1e18) { Game.adminCoins(n); Sound.coin(); UI.toast('+' + fmtN(n) + ' coins', '', '#ffc83a'); } else Sound.deny(); }
    else if (k === 'luck') { a.luck = +v; a.used = true; Game.save(); this.open(); }
    else if (k === 'nocd') { a.nocd = !a.nocd; a.used = true; Game.cooldown = 0; Game.save(); this.open(); }
    else if (k === 'give') { const key = $('#adAura').value + ':' + $('#adVar').value; Game.adminGive(key, 1); Sound.buy(); UI.toast('Added to your bag', info(key).name, info(key).tier.color); if (UI.tab === 'bag') UI.renderBag(); if (UI.tab === 'index') UI.renderIndex(); UI.refreshEquipped(); }
    else if (k === 'forceRoll') { Game.forced = { id: $('#adAura').value, variant: $('#adVar').value }; a.used = true; Game.cooldown = 0; UI.closeModal(); UI.closePanel(); UI.roll(); }
    else if (k === 'cine') { const id = $('#adAura').value, vid = $('#adVar').value, aura = AURA_BY_ID[id], v = VARIANT_BY_ID[vid]; UI.replayCine(id + ':' + vid, { aura, variant: v, key: id + ':' + vid, eff: aura.odds * v.chance, isNew: false }); }
    else if (k === 'biome') { const id = $('#adBiome').value; a.used = true; Game.setBiome(id); if (id === 'normal') Game.nextBiome = 60; }
    else if (k === 'potions') { for (const p of POTIONS) s.potions[p.id] = (s.potions[p.id] || 0) + 5; a.used = true; Game.save(); Sound.buy(); UI.toast('5 of each potion added', '', '#4de28a'); }
    else if (k === 'shop') { s.up.auto = 1; s.up.skip = 1; a.used = true; Game.save(); UI.refreshToggles(); Sound.buy(); UI.toast('Auto Roll and Fast Reveals unlocked', '', '#4de28a'); }
    else if (k === 'all') { for (const x of AURAS) if (!s.index[x.id]) Game.adminGive(x.id + ':normal', 1); Sound.ach(); UI.toast('Every aura unlocked', '', '#ffc83a'); UI.refreshHud(); }
    UI.refreshHud();
  },
};
