'use strict';
// ---- owner admin panel: ME (your own account), PLAYERS (other accounts), LIVE (server-wide events) ----
// Only opens for the verified owner. Everything sent to other players goes through Firebase rules that only accept the owner.

const Admin = {
  tab: 'me', sel: null,
  coinSteps: [['+1K', 1e3], ['+1M', 1e6], ['+1B', 1e9], ['+1T', 1e12], ['+1Qa', 1e15]],
  luckSteps: [1, 5, 25, 100, 1000, 1000000],

  // ---------- helpers ----------
  auraSelect(id) { return '<select id="' + id + '" class="search">' + AURAS.slice().sort((x, y) => x.odds - y.odds).map(x => '<option value="' + x.id + '">' + esc(x.name) + ' (' + fmtOdds(x.odds) + ')</option>').join('') + '</select>'; },
  varSelect(id) { return '<select id="' + id + '" class="search">' + VARIANTS.map(v => '<option value="' + v.id + '">' + (v.name || 'Normal') + '</option>').join('') + '</select>'; },
  biomeSelect(id, cur) { return '<select id="' + id + '" class="search" style="margin:0">' + Object.values(BIOMES).map(b => '<option value="' + b.id + '"' + (b.id === cur ? ' selected' : '') + '>' + b.name + '</option>').join('') + '</select>'; },
  chips(act, vals, cur, fmt) { return '<div class="chips">' + vals.map(v => '<button class="chip' + (cur === v ? ' on' : '') + '" data-ad="' + act + '" data-v="' + v + '">' + (fmt ? fmt(v) : v) + '</button>').join('') + '</div>'; },
  ago(t) { if (!t) return 'never'; const s = Math.max(0, (Date.now() - t) / 1000); return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; },
  online(p) { return p && p.on && Date.now() - (p.at || 0) < 150000; },
  val(id) { const e = $('#' + id); return e ? e.value : ''; },

  // ---------- frame ----------
  open(tab) {
    if (!Game.isAdmin()) { UI.toast('Owner only', 'Unlock owner mode in MORE', '#ff4d6a'); return; }
    if (tab) this.tab = tab;
    const T = [['me', 'ME'], ['players', 'PLAYERS'], ['live', 'LIVE']];
    UI.openDialog('Admin Panel', '<div class="atabs">' + T.map(t => '<button class="' + (this.tab === t[0] ? 'on' : '') + '" data-ad="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div id="atab"></div>', false);
    $('#mbox').classList.add('admin');
    $('#mbox').onclick = e => { const t = e.target.closest('[data-ad]'); if (t) this.act(t.dataset.ad, t.dataset.v); };
    this.paint();
  },
  paint() {
    const el = $('#atab'); if (!el) return;
    el.innerHTML = this.tab === 'players' ? (this.sel ? this.sheetHtml(this.sel) : this.playersHtml()) : this.tab === 'live' ? this.liveHtml() : this.meHtml();
  },
  // keep the lists fresh while the panel is open (players and feed arrive live)
  liveUpdate() {
    if (this.tab === 'players' && !this.sel && $('#plist')) $('#plist').innerHTML = this.rowsHtml();
    else if (this.tab === 'live' && $('#afeed')) { if ((Live.luckMult() > 1) !== this._party) this.paint(); else $('#afeed').innerHTML = this.feedHtml(); }
  },

  // ---------- ME ----------
  meHtml() {
    const a = Game.s.admin;
    return '<p class="sub">Your own account. Only you can see this.</p>' +
      '<div class="asec">Coins</div><div class="chips">' + this.coinSteps.map(c => '<button class="chip on" data-ad="coins" data-v="' + c[1] + '" style="--tc:var(--gold)">' + c[0] + '</button>').join('') + '</div>' +
      '<div class="arow"><input class="search" id="adCoins" inputmode="numeric" placeholder="Any amount" style="margin:0"><button class="btn gold" data-ad="coinsCustom">ADD</button></div>' +
      '<div class="asec">Luck boost</div>' + this.chips('luck', this.luckSteps, a.luck, v => 'x' + v.toLocaleString()) +
      '<div class="arow"><span>No roll cooldown</span><button class="btn' + (a.nocd ? '' : ' ghost') + '" data-ad="nocd">' + (a.nocd ? 'ON' : 'OFF') + '</button></div>' +
      '<div class="asec">Aura</div>' + this.auraSelect('adAura') + this.varSelect('adVar') +
      '<div class="arow"><button class="btn" data-ad="forceRoll" style="flex:1">ROLL IT<small>with the full reveal</small></button><button class="btn gold" data-ad="give" style="flex:1">ADD TO BAG<small>instantly</small></button></div>' +
      '<div class="arow"><button class="btn ghost" data-ad="cine" style="flex:1">PREVIEW CUTSCENE<small>no roll, nothing changes</small></button></div>' +
      '<div class="asec">World</div><div class="arow">' + this.biomeSelect('adBiome', Game.biome) + '<button class="btn" data-ad="biome">SET BIOME</button></div>' +
      '<div class="asec">Quick unlocks</div><div class="arow"><button class="btn" data-ad="potions" style="flex:1">5 OF EACH POTION</button><button class="btn" data-ad="shop" style="flex:1">AUTO + FAST</button></div>' +
      '<div class="arow"><button class="btn" data-ad="all" style="flex:1">UNLOCK EVERY AURA<small>one of each</small></button></div>' +
      '<div class="acts"><button class="btn ghost" data-ad="close">CLOSE</button></div>';
  },

  // ---------- PLAYERS ----------
  playersHtml() {
    if (Live.playersErr) return '<p class="sub">The player list is not available yet. The Firebase rules need the new <b>players</b>, <b>inbox</b>, <b>events</b> and <b>feed</b> sections.</p><div class="acts"><button class="btn ghost" data-ad="close">CLOSE</button></div>';
    return '<p class="sub">Everyone who has signed in to the game. Tap a player to send them things. It lands instantly if they are playing, or the next time they open the game.</p><div id="plist">' + this.rowsHtml() + '</div><div class="acts"><button class="btn ghost" data-ad="close">CLOSE</button></div>';
  },
  rowsHtml() {
    const list = Object.entries(Live.players).sort((a, b) => (this.online(b[1]) - this.online(a[1])) || ((b[1].at || 0) - (a[1].at || 0)));
    if (!list.length) return '<div class="empty">Nobody else has signed in yet.</div>';
    return list.map(([uid, p]) => {
      const on = this.online(p), me = uid === Live.uid, best = p.best && AURA_BY_ID[p.best.split(':')[0]] ? info(p.best).name : 'none yet';
      return '<button class="prow" data-ad="pick" data-v="' + uid + '"><i class="odot ' + (on ? 'on' : '') + '"></i><b>' + esc(p.name || 'Player') + (me ? ' (you)' : '') + '</b><span>' + (p.rolls || 0).toLocaleString() + ' rolls &middot; ' + (p.found || 0) + '/' + AURAS.length + '</span><small>Rarest: ' + esc(best) + ' &middot; ' + (on ? 'online now' : this.ago(p.at)) + '</small></button>';
    }).join('');
  },
  sheetHtml(uid) {
    const p = Live.players[uid]; if (!p) { this.sel = null; return this.playersHtml(); }
    const on = this.online(p), best = p.best && AURA_BY_ID[p.best.split(':')[0]] ? info(p.best).name : 'none yet';
    return '<div class="arow"><button class="btn ghost" data-ad="back" style="min-width:0">BACK</button><div style="flex:1"><div class="who">' + esc(p.name || 'Player') + '</div><div class="sub" style="margin:0">' + (on ? 'Online now' : 'Last seen ' + this.ago(p.at)) + '</div></div></div>' +
      '<div class="kv" style="margin-bottom:6px"><span>Coins</span><span>' + fmtN(p.coins || 0) + '</span><span>Rolls</span><span>' + (p.rolls || 0).toLocaleString() + '</span><span>Auras found</span><span>' + (p.found || 0) + ' / ' + AURAS.length + '</span><span>Rarest</span><span>' + esc(best) + '</span></div>' +
      '<div class="asec">Coins</div><div class="chips">' + this.coinSteps.map(c => '<button class="chip on" data-ad="pcoins" data-v="' + c[1] + '" style="--tc:var(--gold)">' + c[0] + '</button>').join('') + '</div>' +
      '<div class="arow"><input class="search" id="pCoins" inputmode="numeric" placeholder="Amount" style="margin:0"><button class="btn gold" data-ad="pcoinsAdd">GIVE</button><button class="btn red" data-ad="pcoinsTake">TAKE</button></div>' +
      '<div class="asec">Aura</div>' + this.auraSelect('pAura') + this.varSelect('pVar') +
      '<div class="arow"><button class="btn gold" data-ad="pgive" style="flex:1">GIVE</button><button class="btn red" data-ad="ptake" style="flex:1">TAKE</button></div>' +
      '<div class="arow"><button class="btn" data-ad="pforce" style="flex:1">FORCE NEXT ROLL</button><button class="btn" data-ad="pcine" style="flex:1">SHOW CUTSCENE</button></div>' +
      '<div class="asec">Luck boost</div>' + this.chips('pluck', [2, 5, 10, 50], 0, v => 'x' + v) +
      '<div class="sub" style="margin:-4px 0 8px">Tap a number to send it for 10 minutes.</div>' +
      '<div class="asec">Weather</div><div class="arow">' + this.biomeSelect('pBiome', 'night') + '<button class="btn" data-ad="pbiome">SET</button></div>' +
      '<div class="asec">Message</div><div class="arow"><input class="search" id="pMsg" maxlength="160" placeholder="Say something to them" style="margin:0"><button class="btn" data-ad="pmsg">SEND</button></div>';
  },

  // ---------- LIVE ----------
  liveHtml() {
    const ev = Live.event, on = this._party = Live.luckMult() > 1, online = Object.values(Live.players).filter(p => this.online(p)).length;
    return '<p class="sub">Things that happen to everyone playing right now. ' + (Live.playersErr ? '' : '<b>' + online + '</b> online.') + '</p>' +
      '<div class="asec">Luck party' + (on ? ' - running x' + Live.luckMult() + ', ' + fmtTime((ev.until - Date.now()) / 1000) + ' left' : '') + '</div>' +
      this.chips('lparty', [2, 5, 10, 25], 0, v => 'x' + v) + '<div class="sub" style="margin:-4px 0 8px">Tap a number to start it for 10 minutes.</div>' +
      (on ? '<div class="arow"><button class="btn red" data-ad="lend" style="flex:1">END LUCK PARTY</button></div>' : '') +
      '<div class="asec">Coin rain</div><div class="arow"><input class="search" id="lCoins" inputmode="numeric" placeholder="Coins for everyone" style="margin:0"><button class="btn gold" data-ad="lcoins">SEND</button></div>' +
      '<div class="asec">Weather for everyone</div><div class="arow">' + this.biomeSelect('lBiome', 'night') + '<button class="btn" data-ad="lbiome">SET</button></div>' +
      '<div class="asec">Announcement</div><div class="arow"><input class="search" id="lMsg" maxlength="160" placeholder="Message for everyone" style="margin:0"><button class="btn" data-ad="lmsg">SEND</button></div>' +
      '<div class="asec">Cutscene for everyone</div>' + this.auraSelect('lAura') + this.varSelect('lVar') + '<div class="arow"><button class="btn" data-ad="lcine" style="flex:1">PLAY IT FOR EVERYONE</button></div>' +
      '<div class="asec">Big rolls (Mythic and up)</div><div id="afeed">' + this.feedHtml() + '</div>' +
      '<div class="acts"><button class="btn ghost" data-ad="close">CLOSE</button></div>';
  },
  feedHtml() {
    if (!Live.feed.length) return '<div class="sub">Nothing yet. Big rolls from other players show up here live.</div>';
    return Live.feed.slice(0, 15).map(f => '<div class="frow"><b>' + esc(f.n || 'Player') + '</b> ' + esc((f.v ? f.v + ' ' : '') + f.a) + ' <span>1 in ' + (f.e >= 1e6 ? fmtN(f.e) : Math.round(f.e).toLocaleString()) + ' &middot; ' + this.ago(f.t) + '</span></div>').join('') + '<div class="arow" style="margin-top:6px"><button class="btn ghost" data-ad="lclear" style="min-width:0">CLEAR FEED</button></div>';
  },

  // ---------- actions ----------
  sent(what) { UI.toast('Sent', what, '#4de28a'); Sound.buy(); },
  fail(e) { Sound.deny(); UI.toast('Could not send', e && e.message ? e.message : 'Is the Firebase rules update published?', '#ff4d6a'); },
  async send(cmd, what) { try { await Live.send(this.sel, cmd); this.sent(what + ' to ' + (Live.players[this.sel] ? Live.players[this.sel].name : 'player')); } catch (e) { this.fail(e); } },
  async pulse(obj, what) { try { await Live.pulse(obj); this.sent(what); } catch (e) { this.fail(e); } },
  amount(id) { const n = Math.floor(+String(this.val(id)).replace(/[, ]/g, '')); return n > 0 && n < 1e15 ? n : 0; },

  act(k, v) {
    if (!Game.isAdmin()) return;
    Sound.init(); const s = Game.s, a = s.admin;
    // frame
    if (k === 'close') return UI.closeModal();
    if (k === 'tab') { this.tab = v; this.sel = null; return this.open(); }
    if (k === 'pick') { this.sel = v; return this.paint(); }
    if (k === 'back') { this.sel = null; return this.paint(); }
    // other players
    if (k === 'pcoins') return this.send({ type: 'coins', n: +v }, '+' + fmtN(+v) + ' coins');
    if (k === 'pcoinsAdd' || k === 'pcoinsTake') { const n = this.amount('pCoins'); if (!n) return Sound.deny(); return this.send({ type: 'coins', n: k === 'pcoinsAdd' ? n : -n }, (k === 'pcoinsAdd' ? '+' : '-') + fmtN(n) + ' coins'); }
    if (k === 'pgive' || k === 'ptake' || k === 'pforce' || k === 'pcine') {
      const id = this.val('pAura'), vid = this.val('pVar'), key = id + ':' + vid, nm = info(key).name;
      if (k === 'pgive') return this.send({ type: 'give', key, n: 1 }, nm);
      if (k === 'ptake') return this.send({ type: 'take', key, n: 1 }, 'take ' + nm);
      if (k === 'pforce') return this.send({ type: 'force', id, variant: vid }, 'next roll = ' + nm);
      return this.send({ type: 'cine', aura: id, variant: vid }, 'cutscene ' + nm);
    }
    if (k === 'pluck') return this.send({ type: 'luck', mult: +v, secs: 600 }, 'x' + v + ' luck for 10 min');
    if (k === 'pbiome') return this.send({ type: 'biome', id: this.val('pBiome') }, BIOMES[this.val('pBiome')].name + ' weather');
    if (k === 'pmsg') { const t = this.val('pMsg').trim(); if (!t) return Sound.deny(); this.send({ type: 'msg', text: t }, 'message'); $('#pMsg').value = ''; return; }
    // everyone
    if (k === 'lparty') { Live.luckParty(+v, 10).then(() => { this.sent('x' + v + ' luck party for 10 min'); this.paint(); }).catch(e => this.fail(e)); return; }
    if (k === 'lend') { Live.endLuck().then(() => { this.sent('luck party ended'); this.paint(); }).catch(e => this.fail(e)); return; }
    if (k === 'lcoins') { const n = this.amount('lCoins'); if (!n) return Sound.deny(); return this.pulse({ kind: 'coins', n }, fmtN(n) + ' coins for everyone'); }
    if (k === 'lbiome') return this.pulse({ kind: 'biome', id2: this.val('lBiome') }, BIOMES[this.val('lBiome')].name + ' for everyone');
    if (k === 'lmsg') { const t = this.val('lMsg').trim(); if (!t) return Sound.deny(); this.pulse({ kind: 'msg', text: t }, 'announcement'); $('#lMsg').value = ''; return; }
    if (k === 'lcine') return this.pulse({ kind: 'cine', aura: this.val('lAura'), variant: this.val('lVar') }, 'cutscene for everyone');
    if (k === 'lclear') { Live.clearFeed().catch(e => this.fail(e)); return; }
    // my own account
    if (k === 'coins') { Game.adminCoins(+v); Sound.coin(); UI.toast('+' + fmtN(+v) + ' coins', '', '#ffc83a'); }
    else if (k === 'coinsCustom') { const n = this.amount('adCoins'); if (n) { Game.adminCoins(n); Sound.coin(); UI.toast('+' + fmtN(n) + ' coins', '', '#ffc83a'); } else Sound.deny(); }
    else if (k === 'luck') { a.luck = +v; a.used = true; Game.save(); this.paint(); }
    else if (k === 'nocd') { a.nocd = !a.nocd; a.used = true; Game.cooldown = 0; Game.save(); this.paint(); }
    else if (k === 'give') { const key = this.val('adAura') + ':' + this.val('adVar'); Game.adminGive(key, 1); Sound.buy(); UI.toast('Added to your bag', info(key).name, info(key).tier.color); if (UI.tab === 'bag') UI.renderBag(); if (UI.tab === 'index') UI.renderIndex(); UI.refreshEquipped(); }
    else if (k === 'forceRoll') { Game.forced = { id: this.val('adAura'), variant: this.val('adVar') }; a.used = true; Game.cooldown = 0; UI.closeModal(); UI.closePanel(); UI.roll(); }
    else if (k === 'cine') { const id = this.val('adAura'), vid = this.val('adVar'), aura = AURA_BY_ID[id], vv = VARIANT_BY_ID[vid]; UI.replayCine(id + ':' + vid, { aura, variant: vv, key: id + ':' + vid, eff: aura.odds * vv.chance, isNew: false }); }
    else if (k === 'biome') { const id = this.val('adBiome'); a.used = true; Game.setBiome(id); if (id === 'normal') Game.nextBiome = 60; }
    else if (k === 'potions') { for (const p of POTIONS) s.potions[p.id] = (s.potions[p.id] || 0) + 5; a.used = true; Game.save(); Sound.buy(); UI.toast('5 of each potion added', '', '#4de28a'); }
    else if (k === 'shop') { s.up.auto = 1; s.up.skip = 1; a.used = true; Game.save(); UI.refreshToggles(); Sound.buy(); UI.toast('Auto Roll and Fast Reveals unlocked', '', '#4de28a'); }
    else if (k === 'all') { for (const x of AURAS) if (!s.index[x.id]) Game.adminGive(x.id + ':normal', 1); Sound.ach(); UI.toast('Every aura unlocked', '', '#ffc83a'); UI.refreshHud(); }
    UI.refreshHud();
  },
};
Live.onChange(() => Admin.liveUpdate());
