'use strict';
// ---- live play: player list, owner -> player commands, server-wide events, big-roll feed ----
// Players:   aura/players/{uid}      name + progress, written by the player, readable only by the owner
// Inbox:     aura/inbox/{uid}/{id}   commands the OWNER sends (gifts, takes, boosts, messages...). Applied right away if the player is online, otherwise next time they open the game.
// Events:    aura/events/luck|pulse  server-wide luck parties and one-time events (coin rain, biome, announcement, cutscene), written by the owner
// Feed:      aura/feed/{id}          big rolls, readable only by the owner
// Every one of these is guarded by Firebase rules, so only the verified owner can send anything to other players.

const Live = (() => {
  const L = { uid: null, event: null, players: {}, playersErr: '', feed: [], ownerOn: false, listeners: [] };
  let refs = [], hb = null, applied = {}, started = false, ownerAt = 0;
  const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"]/g, '').slice(0, n);
  const num = (v, lim) => Math.max(-lim, Math.min(lim, Math.floor(+v || 0)));
  const ref = p => Cloud.ref(p);
  const notify = () => L.listeners.forEach(f => f());
  const toast = (a, b, c) => { if (typeof UI !== 'undefined') UI.toast(a, b, c || '#ffc83a', true); };

  // ---------- who is online / what is happening ----------
  function sync() {
    const u = Cloud.user, uid = u ? u.uid : null;
    if (uid !== L.uid) { stop(); L.uid = uid; }
    // wait until the save sync has settled, so gifts never land on a half-loaded game
    if (uid && !started && Cloud.resolved && Cloud.ref('x')) start(u);
    if (Cloud.admin && !L.ownerOn && started) startOwner(); else if (!Cloud.admin && L.ownerOn) stopOwner();
  }
  function listen(r, ev, cb, err) { r.on(ev, cb, err || (() => { })); refs.push([r, ev, cb]); }
  function stop() {
    if (L.uid && Cloud.ref('x')) ref('aura/players/' + L.uid).update({ on: false }).catch(() => { });
    refs.forEach(([r, ev, cb]) => { try { r.off(ev, cb); } catch (e) { } }); refs = []; clearInterval(hb); stopOwner(); started = false; L.event = null;
  }
  function start(u) {
    started = true;
    const me = ref('aura/players/' + u.uid);
    const beat = () => {
      if (document.hidden || !Cloud.user) return;
      const s = Game.s;
      me.set({ name: clean(u.displayName || 'Player', 30), at: Cloud.ts(), on: true, rolls: s.rolls, found: Object.keys(s.index).length, coins: s.coins, best: s.best || '', eq: s.equipped || '' }).catch(() => { });
    };
    listen(ref('.info/connected'), 'value', c => { if (c.val()) { try { me.onDisconnect().update({ on: false, at: Cloud.ts() }); } catch (e) { } beat(); } });
    hb = setInterval(beat, 60000);
    // commands from the owner
    const inbox = ref('aura/inbox/' + u.uid);
    listen(inbox, 'child_added', snap => {
      const id = snap.key, c = snap.val();
      if (!applied[id]) { applied[id] = 1; try { apply(c); } catch (e) { console.warn('command failed', e); } }
      ref('aura/inbox/' + u.uid + '/' + id).remove().catch(() => { });
    });
    // server-wide events
    listen(ref('aura/events/luck'), 'value', s => { L.event = s.val(); if (typeof UI !== 'undefined') UI.refreshHud(); notify(); });
    listen(ref('aura/events/pulse'), 'value', s => pulse(s.val()));
    if (Cloud.admin) startOwner();
  }

  // ---------- the owner's view ----------
  function startOwner() {
    L.ownerOn = true; ownerAt = Date.now(); L.playersErr = '';
    const pr = ref('aura/players'), fr = ref('aura/feed').limitToLast(30);
    pr.on('value', s => { L.players = s.val() || {}; L.playersErr = ''; notify(); }, () => { L.playersErr = 'denied'; notify(); });
    fr.on('child_added', s => {
      const f = s.val(); if (!f) return; L.feed.unshift(f); L.feed = L.feed.slice(0, 30); notify();
      if (f.u !== L.uid && f.t > ownerAt - 2000) toast(clean(f.n, 30) + ' rolled ' + clean(f.a, 40), '1 in ' + (f.e >= 1e6 ? fmtN(f.e) : Math.round(f.e).toLocaleString()), '#ff3d6e');
    }, () => { });
    L.ownerRefs = [[pr, 'value'], [fr, 'child_added']];
  }
  function stopOwner() { (L.ownerRefs || []).forEach(([r, ev]) => { try { r.off(ev); } catch (e) { } }); L.ownerRefs = null; L.ownerOn = false; L.players = {}; L.feed = []; }

  L.send = (uid, cmd) => ref('aura/inbox/' + uid).push(Object.assign({ at: Cloud.ts(), by: L.uid }, cmd));
  L.pulse = obj => ref('aura/events/pulse').set(Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), by: L.uid }, obj));
  L.luckParty = (mult, mins) => ref('aura/events/luck').set({ mult, until: Date.now() + mins * 60000, at: Date.now(), by: L.uid });
  L.endLuck = () => ref('aura/events/luck').remove();
  L.clearFeed = () => ref('aura/feed').remove().then(() => { L.feed = []; notify(); });

  // ---------- server-wide luck party ----------
  L.luckMult = () => { const e = L.event; return e && e.mult > 1 && Date.now() < e.until ? Math.min(+e.mult, 1000) : 1; };
  L.badge = () => {
    const e = L.event; if (!e || L.luckMult() <= 1) return '';
    return '<div class="pot" style="--pc:#ffc83a">LUCK PARTY x' + L.luckMult() + ' <span>' + fmtTime((e.until - Date.now()) / 1000) + '</span></div>';
  };

  // ---------- one-time server events ----------
  function pulse(e) {
    if (!e || !e.id) return; const s = Game.s; s.evSeen = s.evSeen || [];
    if (s.evSeen.includes(e.id)) return;
    const age = Date.now() - (e.at || 0);
    if (e.kind === 'cine' && typeof UI !== 'undefined' && (UI.busy || Cutscene.active)) { setTimeout(() => pulse(e), 3000); return; }   // wait for the current roll
    s.evSeen.push(e.id); if (s.evSeen.length > 20) s.evSeen.shift();
    if (age > 15 * 60000) { Game.save(); return; }   // too old to matter
    if (e.kind === 'coins') { const n = num(e.n, 1e15); s.coins = Math.max(0, s.coins + n); toast('Coin rain!', '+' + fmtN(n) + ' coins for everyone'); }
    else if (e.kind === 'biome' && BIOMES[e.id2] && age < 3 * 60000) { Game.setBiome(e.id2); toast('The owner changed the weather', BIOMES[e.id2].name); }
    else if (e.kind === 'msg') { if (e.by === L.uid) toast('Announcement sent', clean(e.text, 60)); else message('Announcement', e.text); }   // the sender keeps their admin panel open
    else if (e.kind === 'cine' && AURA_BY_ID[e.aura] && age < 3 * 60000 && e.by !== L.uid) cine(e.aura, e.variant);
    Game.save(); if (typeof UI !== 'undefined') UI.refreshHud(true);
  }
  function message(title, text) {
    UI.openDialog(title, '<p style="font-size:17px;line-height:1.4;margin:8px 0 14px;word-break:break-word">' + esc(clean(text, 200)) + '</p><div class="acts"><button class="btn" id="msgOk">OK</button></div>');
    $('#msgOk').onclick = () => UI.closeModal(); Sound.ach();
  }
  function cine(id, vid) {
    const aura = AURA_BY_ID[id], v = VARIANT_BY_ID[vid] || VARIANTS[0]; if (!aura) return;
    UI.replayCine(id + ':' + v.id, { aura, variant: v, key: id + ':' + v.id, eff: aura.odds * v.chance, isNew: false });
  }

  // ---------- owner commands sent to this player ----------
  function apply(c) {
    if (!c || !c.type) return; const s = Game.s;
    switch (c.type) {
      case 'coins': { const n = num(c.n, 1e15); s.coins = Math.max(0, s.coins + n); toast(n >= 0 ? 'Gift from the owner' : 'The owner took coins', (n >= 0 ? '+' : '') + fmtN(n) + ' coins'); break; }
      case 'give': { const n = Math.max(1, num(c.n, 1000)); if (Game.giveAura(String(c.key), n)) toast('Gift from the owner', info(c.key).name + (n > 1 ? ' x' + n : '')); break; }
      case 'take': { const took = Game.takeAura(String(c.key), Math.max(1, num(c.n, 1000))); if (took) toast('The owner took an aura', info(c.key).name + (took > 1 ? ' x' + took : ''), '#ff4d6a'); break; }
      case 'luck': {
        const mult = Math.max(1, Math.min(1000, +c.mult || 1)), secs = Math.max(10, Math.min(7200, +c.secs || 60));
        s.active = s.active.filter(p => p.id !== 'owner'); s.active.push({ id: 'owner', name: 'Owner Boost', kind: 'luck', mult, left: secs }); toast('Luck boost from the owner', 'x' + mult + ' luck for ' + Math.round(secs / 60) + ' min'); break;
      }
      case 'force': { if (AURA_BY_ID[c.id]) { s.forcedNext = { id: c.id, variant: VARIANT_BY_ID[c.variant] ? c.variant : 'normal' }; toast('Something is about to happen...', 'Your next roll is special'); } break; }
      case 'biome': { if (BIOMES[c.id]) { Game.setBiome(c.id); } break; }
      case 'msg': message('Message from the owner', c.text); break;
      case 'cine': cine(c.aura, c.variant); break;
      default: return;
    }
    Game.save(); UI.refreshAll();
  }

  // big rolls go to the owner's feed
  Game.on('rolled', res => {
    if (!L.uid || !Cloud.user || res.eff < 1e5) return;
    ref('aura/feed').push({ u: L.uid, n: clean(Cloud.user.displayName || 'Player', 30), a: res.aura.name, v: res.variant.name || '', e: res.eff, t: Cloud.ts() }).catch(() => { });
  });
  Cloud.onChange(sync);
  L.onChange = f => L.listeners.push(f);
  return L;
})();
