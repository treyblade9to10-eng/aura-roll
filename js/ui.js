'use strict';
// ---- everything you click: HUD, panels, reveal cards, modals ----

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
function fmtN(n) {
  if (n < 10000) return Math.floor(n).toLocaleString();
  let i = 0; while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  let t = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  if (t.includes('.')) t = t.replace(/\.?0+$/, '');
  return t + SUFFIX[i];
}
const fmtOdds = o => '1 in ' + (o >= 1e6 ? fmtN(o) : Math.round(o).toLocaleString());
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmtPlay(s) { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + 'h ' + m + 'm' : m + 'm ' + Math.floor(s % 60) + 's'; }

function info(key) {
  const [id, vid] = key.split(':'), aura = AURA_BY_ID[id], variant = VARIANT_BY_ID[vid];
  return { key, aura, variant, tier: aura.tier, eff: aura.odds * variant.chance, name: (variant.name ? variant.name + ' ' : '') + aura.name };
}
const tcStyle = a => '--tc:' + a.tier.color + ';--g1:' + a.c[0] + ';';
const BIOME_COL = { night: '#6a7bff', storm: '#7aa8ff', blizzard: '#9fe8ff', bloodmoon: '#ff3d5e', glitched: '#00ff9d', eclipse: '#ff9a2e', rainbow: '#7affc8' };

const UI = {
  stage: null, tab: null, prev: null, busy: false, revealTimer: 0, lastRes: null, bag: { tier: 'all', sort: 'rare', q: '' }, badge: {},

  init(stage) {
    this.stage = stage;
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { Sound.init(); Sound.click(); this.openTab(b.dataset.tab); });
    $('#panelClose').onclick = () => this.closePanel();
    $('#panelBody').addEventListener('click', e => this.panelClick(e));
    $('#panelBody').addEventListener('toggle', e => { if (e.target.id === 'ownerDet') this._ownerOpen = e.target.open; }, true);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.locked) this.closeModal(); });
    $('#auto').onclick = () => this.toggleAuto();
    $('#quick').onclick = () => this.toggleQuick();
    Game.on('ach', a => this.toast(a.name, 'Goal complete: +' + fmtN(a.reward) + ' coins', '#ffc83a', true));
    Game.on('biome', id => this.onBiome(id));
    Game.on('potionEnd', () => this.toast('Potion expired', '', '#8c98b0'));
    $('#cloudPill').onclick = () => { Sound.init(); if (Cloud.user) this.openTab('more'); else Cloud.signIn(); };
    $('#startSignIn').onclick = () => Cloud.signIn();
    $('.ownertag').onclick = () => Admin.open();
    Cloud.onChange(() => this.refreshCloud());
    this.refreshHud(true); this.refreshEquipped(); this.refreshToggles(); this.refreshCloud(); this.refreshAdminBits();
    // swipe the sheet down to close it (phones)
    let sy = null; const ph = $('.phead');
    ph.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive: true });
    ph.addEventListener('touchend', e => { if (sy !== null && e.changedTouches[0].clientY - sy > 50) this.closePanel(); sy = null; });
  },

  // ---------- cloud + owner bits ----------
  refreshCloud() {
    const pill = $('#cloudPill'), t = { off: ['LOCAL', 'off'], out: ['SIGN IN', 'out'], sync: ['SYNC', 'busy'], saving: ['SAVING', 'busy'], saved: ['SAVED', 'ok'], denied: ['SETUP', 'warn'], error: ['RETRY', 'warn'] }[Cloud.status];
    pill.className = 'stat cloud ' + t[1]; pill.querySelector('b').textContent = t[0];
    pill.title = Cloud.user ? 'Cloud save: ' + (Cloud.user.email || 'signed in') : 'Tap to sign in and save online';
    const ss = $('#startSave'); if (ss && Cloud.user) ss.dataset.who = Cloud.user.email || '';
    const si = $('#startSignIn');
    if (si) { si.textContent = Cloud.user ? 'Cloud save on: ' + (Cloud.user.email || 'signed in') : 'SIGN IN WITH GOOGLE TO SAVE ONLINE'; si.classList.toggle('on', !!Cloud.user); si.disabled = !!Cloud.user; si.style.display = Cloud.status === 'off' ? 'none' : ''; }
    if (this.tab === 'more') this.refreshAccount();
  },
  // update just the account / owner boxes so open sections and typing are left alone
  refreshAccount() {
    const a = $('#acctBox'), o = $('#ownerBox'); if (!a || !o) return;
    a.innerHTML = this.accountHtml();
    const key = (!!Cloud.user) + ':' + Cloud.admin;
    if (key !== this._ownerKey) { this._ownerKey = key; o.innerHTML = this.ownerHtml(); }
  },
  refreshAdminBits() {
    $('.ownertag').classList.toggle('hidden', !Cloud.admin);
    if (this.tab === 'more') this.refreshAccount();
  },
  // redraw everything after the game state was changed from outside (cloud load, owner gifts)
  refreshAll() {
    this.refreshEquipped(); this.refreshHud(true); this.refreshToggles();
    if (this.tab) { const t = this.tab; this.tab = null; this.openTab(t); }
  },
  openDialog(title, body, locked) {
    this.closeModal(); const m = $('#modal'); m.classList.remove('hidden'); m.dataset.locked = locked ? '1' : '';
    $('#mbox').style.setProperty('--tc', '#ffc83a');
    $('#mbox').innerHTML = '<div class="mbody"><h3>' + esc(title) + '</h3>' + body + '</div>';
  },

  // ---------- HUD ----------
  refreshHud(force) {
    const s = Game.s;
    $('#coins').textContent = fmtN(s.coins);
    $('#luck').textContent = 'x' + Game.luck().toFixed(Game.luck() >= 100 ? 0 : 2);
    $('#rolls').textContent = s.rolls.toLocaleString();
    // biome badge
    const b = BIOMES[Game.biome], bb = $('#biomeBadge');
    if (Game.biome === 'normal') bb.style.display = 'none';
    else { bb.style.display = 'block'; bb.style.setProperty('--bc', BIOME_COL[Game.biome]); bb.innerHTML = '<span class="bl">' + fmtTime(Game.biomeLeft) + '</span>' + esc(b.name.toUpperCase()) + '<small>x' + b.luck + ' luck</small>'; }
    // potions
    $('#potions').innerHTML = Live.badge() + s.active.map(p => { const d = POTION_BY_ID[p.id] || { name: p.name || 'Boost', color: '#ffc83a' }, n = potionStacks(p); return '<div class="pot" style="--pc:' + d.color + '">' + esc(d.name) + (n > 1 ? ' <b>x' + n + '</b>' : '') + ' <span>' + fmtTime(p.left) + '</span></div>'; }).join('');
    if (this.tab === 'shop') this.updateShopButtons();
    $('#tabs [data-tab=bag] .dot')?.remove();
    if (this.badge.bag && this.tab !== 'bag') $('#tabs [data-tab=bag]').insertAdjacentHTML('beforeend', '<i class="dot"></i>');
    $('#tabs [data-tab=goals] .dot')?.remove();
    const q = Game.ensureQuests(); if (this.tab !== 'goals' && (q.list.some(x => x.have >= x.need && !x.claimed) || (q.list.every(x => x.claimed) && !q.bonus))) $('#tabs [data-tab=goals]').insertAdjacentHTML('beforeend', '<i class="dot"></i>');
    const rb = $('.rbtag'); if (rb) { rb.textContent = s.rebirths ? 'R' + s.rebirths : ''; rb.classList.toggle('hidden', !s.rebirths); }
  },
  refreshEquipped() {
    const k = Game.s.equipped, e = $('#equipped');
    if (!k) { e.innerHTML = 'Roll to get your first aura'; return; }
    const i = info(k);
    e.style.setProperty('--tc', i.tier.color);
    e.innerHTML = 'Equipped <b class="nmx t-' + i.tier.id + '">' + esc(i.name) + '</b> &middot; +' + (Game.equippedBonus() * 100).toFixed(0) + '% luck';
    this.stage.setAura(i.aura, i.variant.id);
  },
  refreshToggles() {
    const s = Game.s, a = $('#auto'), q = $('#quick');
    a.classList.toggle('locked', !s.up.auto); a.classList.toggle('on', !!s.up.auto && s.settings.auto);
    q.classList.toggle('on', s.settings.quick);
  },
  toggleAuto() {
    Sound.init();
    if (!Game.s.up.auto) { Sound.deny(); this.toast('Auto Roll is locked', 'Buy it in the SHOP for 3,000 coins', '#ff4d6a'); return; }
    Game.s.settings.auto = !Game.s.settings.auto; Game.save(); Sound.click(); this.refreshToggles();
  },
  toggleQuick() { Sound.init(); Game.s.settings.quick = !Game.s.settings.quick; Game.save(); Sound.click(); this.refreshToggles(); },
  pushRecent(res) {
    const r = $('#recent'); r.insertAdjacentHTML('afterbegin', '<i style="--tc:' + res.aura.tier.color + '" title="' + esc(info(res.key).name) + '"></i>');
    while (r.children.length > 10) r.lastChild.remove();
  },

  toast(title, sub, color, ach) {
    const t = document.createElement('div'); t.className = 'toast'; t.style.setProperty('--tc', color || '#36e6ff');
    t.innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : ''); const tb = $('#toasts'); tb.appendChild(t); while (tb.children.length > 4) tb.firstChild.remove();
    if (ach) Sound.ach();
    setTimeout(() => t.remove(), 3700);
  },
  onBiome(id) {
    this.stage.setBiome(id);
    if (id === 'normal') { this.toast('Back to the Meadow', 'Luck returns to normal', '#8c98b0'); return; }
    const b = BIOMES[id]; Sound.biome(id === 'glitched' || id === 'bloodmoon');
    this.toast(b.name.toUpperCase() + ' has begun', b.desc, BIOME_COL[id]);
  },
  coinPop(n) {
    const r = $('#roll').getBoundingClientRect(), d = document.createElement('div'); d.className = 'coinpop';
    d.textContent = '+' + fmtN(n); d.style.left = (r.left + r.width / 2 - 20 + (Math.random() - .5) * 60) + 'px'; d.style.top = (r.top - 10) + 'px'; $('#app').appendChild(d); setTimeout(() => d.remove(), 1200);
  },

  // ---------- rolling ----------
  chargeSecs(tier) {
    let d = [.4, .5, .7, 1.2, 1.8, 2.6, 3.4, 4.4][tier];
    if (Game.s.settings.quick) d = Math.min(d, tier >= 5 ? 1.2 : .4);
    else if (Game.s.up.skip) d *= tier <= 3 ? .5 : .8;
    return Math.max(.28, d);
  },
  colorOf(res) { return res.variant.color || res.aura.c[0]; },
  roll(auto) {
    if (this.busy || Game.cooldown > 0) return false;
    Sound.init(); this.busy = true; this.hideReveal(true);
    const res = Game.rollNow(), tier = Math.min(7, tierIndex(res.aura.odds * res.variant.chance)), dur = this.chargeSecs(tier), col = this.colorOf(res);
    $('#roll').classList.add('busy'); $('#rollTxt').textContent = 'ROLLING';
    this.stage.startCharge(tier >= 2 ? col : '#9fb8ff', .25 + tier * .1);
    if (tier >= 4) this.stage.setDim(.2 + tier * .06);
    Sound.charge(tier, dur);
    // the name slot spins, slows down, then locks on
    const slot = document.createElement('div'); slot.className = 'slot'; $('#reveal').innerHTML = ''; $('#reveal').appendChild(slot); $('#reveal').classList.remove('hidden');
    const names = AURAS.filter(a => !a.biome || a.biome === Game.biome), t0 = performance.now(); let i = 0;
    const spin = () => {
      const u = (performance.now() - t0) / (dur * 1000);
      if (u >= 1) return;
      const a = names[Math.floor(Math.random() * names.length)];
      slot.textContent = a.name.toUpperCase(); slot.style.setProperty('--tc', u > .7 ? res.aura.tier.color : a.tier.color); Sound.tick(i++);
      setTimeout(spin, 55 + u * u * 220);
    };
    spin();
    setTimeout(() => this.finishRoll(res, tier, auto), dur * 1000);
    return true;
  },
  finishRoll(res, tier, auto) {
    const st = this.stage, col = this.colorOf(res);
    Game.award(res);
    const cine = tier >= 5 && !(auto && tier < 6) && (Game.s.settings.cine || 'full') !== 'off';
    st.endCharge(); st.setDim(0); if (!cine) { st.reveal(tier, col); Sound.reveal(tier); }
    this.refreshEquipped(); this.refreshHud(); this.pushRecent(res); this.coinPop(res.coins);
    if (res.isNew || res.isNewVariant) this.badge.bag = true;
    this.lastRes = res;
    $('#roll').classList.remove('busy'); $('#rollTxt').textContent = 'ROLL';
    Game.cooldown = Game.cooldownSecs(); Game.cooldownTotal = Game.cooldown;
    if (cine) { this.hideReveal(true); this.showCine(res, tier); }
    else { this.showCard(res); this.busy = false; }
    if (this.tab === 'bag') this.renderBag();
    if (this.tab === 'index') this.renderIndex();
  },
  showCard(res, small) {
    const i = info(res.key), v = res.variant, box = $('#reveal'); box.classList.remove('hidden');
    const equipped = Game.s.equipped === res.key;
    box.innerHTML = '<div class="rv t-' + i.tier.id + '" style="--tc:' + i.tier.color + ';--vc:' + (v.color || '#fff') + '">' +
      '<div class="rt">' + i.tier.name.toUpperCase() + '</div>' +
      '<div class="rn nmx t-' + i.tier.id + '">' + esc(i.aura.name) + '</div>' +
      '<div class="ro">' + fmtOdds(i.aura.odds) + (v.id !== 'normal' ? ' &middot; with variant ' + fmtOdds(res.eff) : '') + '</div>' +
      '<div class="rx">' + (v.id !== 'normal' ? '<span class="vtag">' + v.name + '</span>' : '') + (res.isNew ? '<span class="newtag">NEW</span>' : '') + (res.fused ? '<span class="vtag" style="background:#36e6ff">FUSED</span>' : '<span>+' + fmtN(res.coins) + ' coins</span>') + '</div>' +
      (equipped ? '' : '<button class="btn eqb" id="eqBtn">EQUIP <small>E</small></button>') + '</div>';
    const b = $('#eqBtn'); if (b) b.onclick = () => this.equipLast();
    clearTimeout(this.revealTimer); this.revealTimer = setTimeout(() => this.hideReveal(), 5200);
  },
  hideReveal(instant) {
    clearTimeout(this.revealTimer); const box = $('#reveal'), rv = box.firstElementChild;
    if (!rv || instant) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    rv.classList.add('out'); setTimeout(() => { if (box.firstElementChild === rv) { box.classList.add('hidden'); box.innerHTML = ''; } }, 360);
  },
  equipLast() {
    if (!this.lastRes) return; Game.equip(this.lastRes.key); Sound.click(); this.refreshEquipped(); this.refreshHud();
    if (this.tab === 'bag') this.renderBag(); this.showCard(this.lastRes);
  },
  showCine(res, tier) {
    Cutscene.play(res, tier, () => { if (this.lastRes === res) this.showCard(res); this.busy = false; });
  },
  // watch the cutscene of an aura you own again (no rewards, no roll)
  replayCine(key, res) {
    if (this.busy) return; const i = info(key), tier = Math.max(5, Math.min(7, tierIndex(i.eff)));
    this.closeModal(); this.closePanel(); this.hideReveal(true); this.busy = true;
    Cutscene.play(res || { aura: i.aura, variant: i.variant, key, eff: i.eff, isNew: false }, tier, () => { this.busy = false; }, { replay: true });
  },

  // ---------- panel ----------
  openTab(tab) {
    if (this.tab === tab) { this.closePanel(); return; }
    this.tab = tab; $('#panelBody').scrollTop = 0; $('#app').classList.add('open'); $('#panel').classList.remove('closed');
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'bag') this.badge.bag = false;
    ({ bag: () => this.renderBag(true), index: () => this.renderIndex(), shop: () => this.renderShop(), goals: () => this.renderGoals(), trade: () => this.renderTrade(), more: () => this.renderMore() })[tab]();
    this.refreshHud();
  },
  closePanel() {
    this.tab = null; $('#app').classList.remove('open'); $('#panel').classList.add('closed');
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
  },
  panelClick(e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act, v = t.dataset.v;
    Sound.init();
    if (this.extraAct && this.extraAct(act, v, t)) return;
    if (act === 'card') this.openDetail(v);
    else if (act === 'idx') this.openAuraView(v);
    else if (act === 'tier') { this.bag.tier = v; this.renderBag(true); }
    else if (act === 'sort') { this.bag.sort = v; this.renderBag(true); }
    else if (act === 'up') { if (Game.buyUpgrade(v)) { Sound.buy(); this.refreshToggles(); } else Sound.deny(); this.renderShop(); this.refreshHud(); }
    else if (act === 'daily') { const g = Game.claimDaily(); if (g) { Sound.ach(); this.toast('Daily Gift claimed', '+' + fmtN(g) + ' coins and a Luck Potion', '#ffc83a'); } this.renderShop(); this.refreshHud(); }
    else if (act === 'buyp') { if (Game.buyPotion(v)) Sound.buy(); else Sound.deny(); this.renderShop(); this.refreshHud(); }
    else if (act === 'usep') { if (Game.usePotion(v)) { Sound.buy(); this.toast('Potion active', '', '#4de28a'); } this.renderShop(); this.refreshHud(); }
    else if (act === 'cine') { const o = ['full', 'short', 'off']; Game.s.settings.cine = o[(o.indexOf(Game.s.settings.cine || 'full') + 1) % 3]; Game.save(); Sound.click(); this.renderMore(); }
    else if (act === 'sound') { Game.s.settings.sound = Sound.toggle(); Game.save(); this.renderMore(); }
    else if (act === 'export') { const ta = $('#codeBox'); ta.value = Game.exportCode(); ta.select(); try { navigator.clipboard.writeText(ta.value); this.toast('Save code copied', 'Paste it somewhere safe', '#36e6ff'); } catch (x) { } }
    else if (act === 'import') { if (Game.importCode($('#codeBox').value)) { this.toast('Save loaded', '', '#4de28a'); this.refreshEquipped(); this.refreshHud(); this.refreshToggles(); this.renderMore(); } else { Sound.deny(); this.toast('That code did not work', 'Copy the whole thing', '#ff4d6a'); } }
    else if (act === 'signin') Cloud.signIn();
    else if (act === 'signout') Cloud.signOut();
    else if (act === 'savenow') Cloud.saveNow().then(ok => { if (ok) this.toast('Saved to the cloud', '', '#4de28a'); });
    else if (act === 'loadcloud') Cloud.loadCloudNow();
    else if (act === 'unlock') Cloud.unlock($('#ownerCode').value).then(() => { Sound.ach(); this.toast('Owner verified', 'Welcome back', '#ffc83a', true); }).catch(e => { Sound.deny(); this.toast('Owner code', e.message, '#ff4d6a'); });
    else if (act === 'lock') Cloud.lock().then(() => this.toast('Owner mode locked', '', '#8c98b0'));
    else if (act === 'admin') Admin.open();
    else if (act === 'reset') { if (t.dataset.arm) { Game.reset(); location.reload(); } else { t.dataset.arm = 1; t.textContent = 'TAP AGAIN TO ERASE EVERYTHING'; } }
  },
  setPanel(title, html) { $('#panelTitle').textContent = title; $('#panelBody').innerHTML = html; },

  // ---- bag ----
  renderBag(full) {
    if (full) {
      const chips = ['all', ...TIERS.map(t => t.id)].map(id => { const t = TIERS.find(x => x.id === id); return '<button class="chip' + (this.bag.tier === id ? ' on' : '') + '" data-act="tier" data-v="' + id + '" style="--tc:' + (t ? t.color : '#fff') + '">' + (t ? t.name : 'All') + '</button>'; }).join('');
      this.setPanel('BAG', '<div class="prog" id="bagProg"></div><input class="search" id="bagQ" placeholder="Search auras" value="' + esc(this.bag.q) + '"><div class="chips">' + chips + '</div><div class="chips"><button class="chip' + (this.bag.sort === 'rare' ? ' on' : '') + '" data-act="sort" data-v="rare">Rarest first</button><button class="chip' + (this.bag.sort === 'count' ? ' on' : '') + '" data-act="sort" data-v="count">Most owned</button><button class="chip' + (this.bag.sort === 'new' ? ' on' : '') + '" data-act="sort" data-v="new">Common first</button></div><div class="grid" id="bagGrid"></div>');
      $('#bagQ').oninput = e => { this.bag.q = e.target.value; this.renderBag(); };
    }
    const s = Game.s, d = Object.keys(s.index).length, tot = AURAS.length;
    $('#bagProg').innerHTML = '<div class="bar"><i style="width:' + (d / tot * 100) + '%"></i></div><small><span>DISCOVERED ' + d + ' / ' + tot + '</span><span>' + Object.values(s.inv).reduce((a, b) => a + b, 0).toLocaleString() + ' AURAS OWNED</span></small>';
    let list = Object.keys(s.inv).filter(k => s.inv[k] > 0).map(info);
    if (this.bag.tier !== 'all') list = list.filter(i => i.tier.id === this.bag.tier);
    const q = this.bag.q.trim().toLowerCase(); if (q) list = list.filter(i => i.name.toLowerCase().includes(q));
    list.sort(this.bag.sort === 'count' ? (a, b) => s.inv[b.key] - s.inv[a.key] : this.bag.sort === 'new' ? (a, b) => a.eff - b.eff : (a, b) => b.eff - a.eff);
    $('#bagGrid').innerHTML = list.length ? list.map(i => {
      const v = i.variant;
      return '<button class="acard' + (s.equipped === i.key ? ' eq' : '') + '" data-act="card" data-v="' + i.key + '" style="' + tcStyle(i.aura) + '--vc:' + (v.color || '#fff') + '">' +
        (s.equipped === i.key ? '<span class="eqt">EQUIPPED</span>' : '') +
        '<div class="nm nmx t-' + i.tier.id + '">' + esc(i.aura.name) + '</div><div class="od">' + fmtOdds(i.aura.odds) + '</div>' +
        (v.id !== 'normal' ? '<span class="vt">' + v.name + '</span>' : '') + (auraLock(i.aura) ? '<div class="bt">' + auraLock(i.aura) + '</div>' : '') +
        '<span class="ct">x' + s.inv[i.key].toLocaleString() + '</span></button>';
    }).join('') : '<div class="empty" style="grid-column:1/-1">' + (Object.keys(s.inv).length ? 'Nothing matches that filter.' : 'Your bag is empty. Hit ROLL!') + '</div>';
  },
  openDetail(key) {
    const i = info(key), s = Game.s, n = s.inv[key] || 0, eq = s.equipped === key;
    const lb = Math.log10(i.aura.odds) * 0.04 * (i.variant.mult > 1 ? 1.5 : 1), cb = Math.log10(i.aura.odds) * 0.05, sell = Game.sellValue(i.aura, i.variant);
    this.openModal(i, '<div class="kv"><span>Rarity</span><span>' + i.tier.name + '</span><span>Odds</span><span>' + fmtOdds(i.aura.odds) + '</span>' +
      (i.variant.id !== 'normal' ? '<span>With variant</span><span>' + fmtOdds(i.eff) + '</span>' : '') +
      '<span>Owned</span><span>x' + n.toLocaleString() + '</span><span>Luck while equipped</span><span>+' + (lb * 100).toFixed(1) + '%</span><span>Coin bonus while equipped</span><span>+' + (cb * 100).toFixed(1) + '%</span><span>Coins per roll as this</span><span>' + fmtN(Game.coinsFor(i.aura, i.variant)) + '</span><span>Sell value (each extra)</span><span>' + fmtN(sell) + '</span></div>' +
      '<div class="acts"><button class="btn" id="mEq"' + (eq ? ' disabled' : '') + '>' + (eq ? 'EQUIPPED' : 'EQUIP') + '</button>' + (n > 1 ? '<button class="btn gold" id="mSell">SELL ' + (n - 1) + ' EXTRA<small>+' + fmtN(sell * (n - 1)) + ' coins</small></button>' : '') + (tierIndex(i.eff) >= 5 ? '<button class="btn ghost" id="mCine">WATCH CUTSCENE</button>' : '') + (Game.canFuse(key) ? '<button class="btn" id="mFuse">FUSE x' + FUSE_COST + '<small>into a rarer aura</small></button>' : '') + '<button class="btn ghost" id="mFlex">FLEX CARD</button><button class="btn ghost" id="mClose">CLOSE</button></div>');
    const mf = $('#mFuse'); if (mf) mf.onclick = () => this.doFuse(key);
    $('#mFlex').onclick = () => Flex.open(key);
    const mc = $('#mCine'); if (mc) mc.onclick = () => this.replayCine(key);
    $('#mEq').onclick = () => { Game.equip(key); Sound.click(); this.refreshEquipped(); this.refreshHud(); if (this.tab === 'bag') this.renderBag(); this.closeModal(); };
    const sb = $('#mSell'); if (sb) sb.onclick = () => { const g = Game.sellExtras(key); Sound.coin(); this.toast('Sold for ' + fmtN(g) + ' coins', '', '#ffc83a'); this.refreshHud(); if (this.tab === 'bag') this.renderBag(); this.closeModal(); };
    $('#mClose').onclick = () => this.closeModal();
  },
  openAuraView(id) {
    const a = AURA_BY_ID[id], owned = Object.keys(Game.s.inv).filter(k => k.startsWith(id + ':') && Game.s.inv[k] > 0);
    if (owned.length) { this.openDetail(owned.sort((x, y) => info(y).eff - info(x).eff)[0]); return; }
  },
  openModal(i, body) {
    this.closeModal(); const m = $('#modal'); m.classList.remove('hidden');
    $('#mbox').style.setProperty('--tc', i.tier.color);
    $('#mbox').innerHTML = '<canvas id="pv"></canvas><div class="mbody"><h3 class="nmx t-' + i.tier.id + '">' + esc(i.name) + '</h3><div class="lore">' + esc(i.aura.lore) + (i.aura.biome ? ' (Only rolls during ' + BIOMES[i.aura.biome].name + ')' : i.aura.rb ? ' (Unlocked by Rebirth ' + i.aura.rb + ')' : i.aura.hours ? ' (Only rolls at night, 10 PM to 5 AM your time)' : '') + '</div>' + body + '</div>';
    this.prev = new Preview($('#pv')); this.prev.show(i.aura, i.variant.id);
  },
  closeModal() { if (this.prev) { this.prev.stop(); this.prev = null; } $('#modal').dataset.locked = ''; $('#modal').classList.add('hidden'); },

  // ---- index ----
  renderIndex() {
    const s = Game.s, list = AURAS.slice().sort((a, b) => a.odds - b.odds), d = Object.keys(s.index).length;
    let html = '<div class="prog"><div class="bar"><i style="width:' + (d / AURAS.length * 100) + '%"></i></div><small><span>AURA INDEX</span><span>' + d + ' / ' + AURAS.length + '</span></small></div>', last = null;
    for (const a of list) {
      if (a.tier.id !== last) { if (last) html += '</div>'; last = a.tier.id; html += '<div class="sec" style="color:' + a.tier.color + '">' + a.tier.name + '</div><div class="grid">'; }
      const got = !!s.index[a.id];
      html += '<button class="acard' + (got ? '' : ' unk') + '" ' + (got ? 'data-act="idx" data-v="' + a.id + '"' : '') + ' style="' + tcStyle(a) + '">' +
        '<div class="nm nmx t-' + a.tier.id + '">' + (got ? esc(a.name) : '???') + '</div><div class="od">' + fmtOdds(a.odds) + '</div>' + (auraLock(a) ? '<div class="bt">' + auraLock(a) + '</div>' : '') + (got ? '<span class="ct">x' + s.index[a.id].toLocaleString() + '</span>' : '') + '</button>';
    }
    this.setPanel('INDEX', html + '</div>');
  },

  // ---- shop ----
  renderShop() {
    if (this.shopTab === 'market' || this.shopTab === 'quick') return this.renderMarket();
    const s = Game.s, sc = $('#panelBody').scrollTop;
    const left = DAILY_MS - (Date.now() - (s.daily || 0)), ready = left <= 0;
    let h = '<div class="row" style="--rc:var(--gold)"><div class="info"><div class="t" style="color:var(--gold)">Daily Gift</div><div class="d">A Luck Potion plus coins. Comes back every 20 hours.</div>' + (ready ? '' : '<div class="v">Ready in ' + Math.ceil(left / 3600000) + 'h</div>') + '</div><button class="btn gold" data-act="daily"' + (ready ? '' : ' disabled') + '>CLAIM</button></div><div class="sec">Upgrades</div>';
    for (const u of UPGRADES) {
      const lvl = s.up[u.id], maxed = lvl >= u.max, cost = Game.upgradeCost(u.id);
      h += '<div class="row"><div class="info"><div class="t">' + u.name + (u.max > 1 ? ' <span style="color:var(--dim);font-size:14px">LV ' + lvl + '/' + u.max + '</span>' : '') + '</div><div class="d">' + u.desc + '</div><div class="v">' + u.fmt(lvl) + '</div></div>' +
        (maxed ? '<button class="btn" disabled>' + (u.max === 1 ? 'OWNED' : 'MAX') + '</button>' : '<button class="btn gold" data-act="up" data-v="' + u.id + '" data-cost="' + cost + '"' + (s.coins < cost ? ' disabled' : '') + '>BUY<small>' + fmtN(cost) + '</small></button>') + '</div>';
    }
    h += '<div class="sec">Potions</div>';
    for (const p of POTIONS) {
      const own = s.potions[p.id] || 0;
      h += '<div class="row" style="--rc:' + p.color + '"><div class="info"><div class="t" style="color:' + p.color + '">' + p.name + '</div><div class="d">' + p.desc + '</div><div class="v">Owned: ' + own + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn gold" data-act="buyp" data-v="' + p.id + '" data-cost="' + p.cost + '"' + (s.coins < p.cost ? ' disabled' : '') + '>BUY<small>' + fmtN(p.cost) + '</small></button>' +
        '<button class="btn" data-act="usep" data-v="' + p.id + '"' + (own ? '' : ' disabled') + '>USE</button></div></div>';
    }
    const ownM = MARKET_POTIONS.concat(QUICK_POTIONS).filter(p => (s.potions[p.id] || 0) > 0);
    if (ownM.length) { h += '<div class="sec">Market potions you own</div>' + ownM.map(p => '<div class="row" style="--rc:' + p.color + '"><div class="info"><div class="t" style="color:' + p.color + '">' + p.name + '</div><div class="d">' + p.desc + '</div><div class="v">Owned: ' + s.potions[p.id] + '</div></div><button class="btn" data-act="usep" data-v="' + p.id + '">USE</button></div>').join(''); }
    this.setPanel('SHOP', this.subTabs('shop', [['shop', 'SHOP'], ['quick', 'QUICK'], ['market', 'MARKET']]) + h); $('#panelBody').scrollTop = sc;
  },
  updateShopButtons() { const c = Game.s.coins; document.querySelectorAll('#panelBody [data-cost]').forEach(b => b.disabled = c < +b.dataset.cost); },

  // ---- goals ----
  renderGoals() {
    if (this.goalsTab === 'quests' || !this.goalsTab) return this.renderQuests();
    if (this.goalsTab === 'ranks') return this.renderRanks();
    const s = Game.s, done = ACHIEVEMENTS.filter(a => s.ach[a.id]).length;
    let h = '<div class="prog"><div class="bar"><i style="width:' + (done / ACHIEVEMENTS.length * 100) + '%"></i></div><small><span>GOALS</span><span>' + done + ' / ' + ACHIEVEMENTS.length + '</span></small></div>';
    h += ACHIEVEMENTS.slice().sort((a, b) => !!s.ach[a.id] - !!s.ach[b.id]).map(a => '<div class="row' + (s.ach[a.id] ? ' done' : '') + '"><div class="info"><div class="t">' + a.name + '</div><div class="d">' + a.desc + '</div></div><div class="v" style="color:var(--gold);white-space:nowrap">+' + fmtN(a.reward) + '</div></div>').join('');
    this.setPanel('GOALS', this.subTabs('goals', [['quests', 'QUESTS'], ['goals', 'GOALS'], ['ranks', 'RANKS']]) + h);
  },

  // ---- more ----
  accountHtml() {
    const u = Cloud.user, st = Cloud.status, who = u ? esc(u.email || u.displayName || 'your account') : '';
    const line = { off: 'Cannot reach the cloud right now. Your game still saves on this device.', out: 'Sign in with Google and your game saves online by itself. Open it on any phone or computer and pick up where you left off.',
      sync: 'Checking your cloud save...', saving: 'Saving...', saved: 'Saved online' + (Cloud.savedAt ? ' at ' + new Date(Cloud.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '') + '. It keeps saving by itself.',
      denied: 'Cloud saving is not switched on yet. Your game still saves on this device.', error: 'Could not save: ' + esc(Cloud.error) }[st];
    let h = '<div class="sec" style="margin-top:0">Account</div><div class="acct ' + st + '"><div class="who">' + (u ? who : 'Not signed in') + '</div><p class="sub" style="margin:4px 0 10px">' + line + '</p>' + (u ? '<p class="sub" style="margin:-4px 0 10px;font-size:12px">The game owner can see your name and progress, and can send you gifts and messages.</p>' : '');
    h += u ? '<div style="display:flex;gap:8px"><button class="btn" data-act="savenow" style="flex:1">SAVE NOW</button><button class="btn ghost" data-act="loadcloud" style="flex:1">LOAD CLOUD</button><button class="btn ghost" data-act="signout" style="flex:0 0 auto;min-width:0">SIGN OUT</button></div>'
      : '<button class="btn gold" data-act="signin" style="width:100%"' + (st === 'off' ? ' disabled' : '') + '>SIGN IN WITH GOOGLE</button>';
    return h + '</div>';
  },
  ownerHtml() {
    const u = Cloud.user, who = u ? esc(u.email || u.displayName || 'your account') : '', open = this._ownerOpen ? ' open' : '';
    let h = '';
    if (Cloud.admin) h += '<div class="acct owner"><div class="who"><span class="ownertag static">OWNER</span> Verified' + (u && u.email ? ' as ' + esc(u.email) : '') + '</div><p class="sub" style="margin:4px 0 10px">Confirmed by the server, not just this page.</p><div style="display:flex;gap:8px"><button class="btn gold" data-act="admin" style="flex:1">OPEN ADMIN PANEL</button><button class="btn ghost" data-act="lock" style="flex:0 0 auto;min-width:0">LOCK</button></div></div>';
    else if (u) h += '<details class="adv" id="ownerDet"' + open + '><summary>Owner access</summary><p class="sub">For the creator. Enter the owner code to prove it is you and unlock the admin tools.</p><div style="display:flex;gap:8px"><input class="search" id="ownerCode" type="password" inputmode="numeric" autocomplete="off" placeholder="Owner code" style="margin:0;flex:1"><button class="btn" data-act="unlock" style="flex:0 0 auto">UNLOCK</button></div></details>';
    return h;
  },
  renderMore() {
    const sc = $('#panelBody').scrollTop;
    const s = Game.s, best = s.best ? info(s.best) : null, eqb = Game.equippedBonus();
    const rows = (a) => a.map(([k, v]) => '<span>' + k + '</span><span>' + v + '</span>').join('');
    this._ownerKey = (!!Cloud.user) + ':' + Cloud.admin;
    this.setPanel('MORE', '<div id="acctBox">' + this.accountHtml() + '</div><div id="ownerBox">' + this.ownerHtml() + '</div>' + this.rebirthHtml() +
      '<div class="sec">Your luck</div><div class="kv">' + rows([
        ['Lucky Charm', 'x' + (1 + s.up.luck * .06).toFixed(2)], ['Potion', 'x' + Game.potionMult('luck')], ['Biome (' + BIOMES[Game.biome].name + ')', 'x' + BIOMES[Game.biome].luck],
        ['Equipped aura', 'x' + (1 + eqb).toFixed(2)], ['TOTAL', 'x' + Game.luck().toFixed(2)]]) + '</div>' +
      '<div class="sec">Stats</div><div class="kv">' + rows([
        ['Total rolls', s.rolls.toLocaleString()], ['Auras discovered', Object.keys(s.index).length + ' / ' + AURAS.length], ['Rarest roll', best ? esc(best.name) + ' (' + fmtOdds(best.eff) + ')' : 'None yet'],
        ['Coin multiplier', 'x' + Game.coinMult().toFixed(2)], ['Roll cooldown', Game.cooldownSecs().toFixed(2) + 's'], ['Time played', fmtPlay(s.play)]]) + '</div>' +
      '<div class="sec">Variants</div><p class="sub">Any roll can also be a variant: Shiny 1 in 30, Inverted 1 in 300, Void 1 in 3,000. They multiply your coins and their odds stack on top of the aura.</p>' +
      '<div class="sec">Settings</div><div class="row"><div class="info"><div class="t">Sound</div></div><button class="btn' + (Sound.on ? '' : ' ghost') + '" data-act="sound">' + (Sound.on ? 'ON' : 'OFF') + '</button></div>' +
      '<div class="row"><div class="info"><div class="t">Cutscenes</div><div class="d">For Mythic and above. Tap to skip any time.</div></div><button class="btn' + (s.settings.cine === 'off' ? ' ghost' : '') + '" data-act="cine">' + ({ full: 'FULL', short: 'SHORT', off: 'OFF' }[s.settings.cine || 'full']) + '</button></div>' +
      '<details class="adv"><summary>Backup code (advanced)</summary><p class="sub">Only needed if you do not want to sign in. Copy the code to move your game by hand.</p><textarea class="code" id="codeBox" placeholder="Paste a save code here to load it"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-act="export" style="flex:1">COPY CODE</button><button class="btn gold" data-act="import" style="flex:1">LOAD CODE</button></div></details>' +
      '<div style="margin-top:22px"><button class="btn red" data-act="reset" style="width:100%">RESET GAME</button></div>');
    $('#panelBody').scrollTop = sc;
  },
};
