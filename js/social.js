'use strict';
// ---- social: the public leaderboard (opt-in) and friend trade rooms ----
// aura/board/{uid}      first name + stats, only if the player joined. Everyone signed in can read it.
// aura/trades/{code}    a trade room: host + guest each with an offer. Both confirm the same version -> both clients swap.

const firstNameOf = u => ((u && u.displayName) ? u.displayName.trim().split(/\s+/)[0] : 'Player').replace(/[^\p{L}\p{N}.'-]/gu, '').slice(0, 14) || 'Player';

// ====================================================================== leaderboard
const Board = (() => {
  const B = { data: null, at: 0, err: '', loading: false, sort: 'b', timer: null };
  const ref = p => Cloud.ref(p);
  const mine = () => {
    const s = Game.s, u = Cloud.user, e = { n: firstNameOf(u), r: s.rolls, f: Object.keys(s.index).length, b: Math.round(s.bestOdds || 0), bn: s.best && AURA_BY_ID[s.best.split(':')[0]] ? info(s.best).name.slice(0, 30) : '', rb: s.rebirths || 0, at: Cloud.ts() };
    if (Cloud.admin) e.o = true;
    return e;
  };
  B.on = () => !!(Game.s.settings.board && Cloud.user);
  B.touch = () => { if (!B.on() || B.timer || !Cloud.ref('x') || Date.now() - (B.last || 0) < 30000) return; B.timer = setTimeout(() => { B.timer = null; B.last = Date.now(); B.publish(); }, 8000); };
  B.publish = () => { if (!B.on() || !Cloud.ref('x')) return Promise.resolve(); return ref('aura/board/' + Cloud.user.uid).set(mine()).catch(e => { B.err = 'Leaderboard needs the new Firebase rules.'; }); };
  B.join = async () => { Game.s.settings.board = true; Game.save(); await B.publish(); await B.load(true); };
  B.leave = async () => { Game.s.settings.board = false; Game.save(); if (Cloud.user && Cloud.ref('x')) await ref('aura/board/' + Cloud.user.uid).remove().catch(() => { }); await B.load(true); };
  B.load = async force => {
    if (!Cloud.user || !Cloud.ref('x')) { B.data = null; return; }
    if (!force && B.data && Date.now() - B.at < 20000) return;
    B.loading = true; B.err = '';
    try { B.data = (await ref('aura/board').once('value')).val() || {}; B.at = Date.now(); }
    catch (e) { B.data = null; B.err = 'The leaderboard is not switched on yet (Firebase rules).'; }
    B.loading = false; if (UI.tab === 'goals' && UI.goalsTab === 'ranks') UI.renderRanks();
  };
  Game.on('rolled', B.touch); Game.on('rebirth', B.touch); Game.on('fused', B.touch);
  Cloud.onChange(() => { if (Cloud.status === 'saved') B.touch(); });
  return B;
})();

// ====================================================================== trading
const Trade = (() => {
  const T = { code: '', side: '', room: null, err: '', busy: false };
  let r = null, cb = null, closing = false;
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const path = c => 'aura/trades/' + c;
  const me = () => (T.room && T.room[T.side]) || null, them = () => (T.room && T.room[T.side === 'host' ? 'guest' : 'host']) || null;
  const comb = () => T.room && T.room.host && T.room.guest ? (T.room.host.v || 0) + (T.room.guest.v || 0) : -2;
  const cleanOffer = o => { const out = {}; let n = 0; for (const k of Object.keys(o || {})) { const q = Math.max(0, Math.min(99, Math.floor(+o[k] || 0))); const [id, v] = k.split(':'); if (q > 0 && AURA_BY_ID[id] && VARIANT_BY_ID[v] && n++ < 14) out[k] = q; } return out; };
  const side = () => ref().child(T.side);
  const ref = () => r;

  function listen() {
    r = Cloud.ref(path(T.code)); closing = false;
    cb = snap => {
      const had = !!T.room; T.room = snap.val();
      if (!T.room && had && !closing) { UI.toast('Trade room closed', '', '#8c98b0'); reset(); }
      else check();
      if (UI.tab === 'trade') UI.renderTrade();
    };
    r.on('value', cb, () => { T.err = 'Trading needs the new Firebase rules.'; reset(); if (UI.tab === 'trade') UI.renderTrade(); });
  }
  function reset() { if (r && cb) { try { r.off('value', cb); } catch (e) { } } r = null; cb = null; T.code = ''; T.side = ''; T.room = null; }

  T.create = async () => {
    if (!Cloud.user || !Cloud.ref('x')) return; T.err = '';
    let code = '';
    for (let tries = 0; tries < 8; tries++) {
      code = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
      try { if ((await Cloud.ref(path(code)).once('value')).val() === null) break; } catch (e) { T.err = 'Trading needs the new Firebase rules.'; return; }
      code = '';
    }
    if (!code) { T.err = 'Could not make a room, try again.'; return; }
    try { await Cloud.ref(path(code) + '/host').set({ uid: Cloud.user.uid, n: firstNameOf(Cloud.user), v: 0, ok: -1 }); await Cloud.ref(path(code) + '/at').set(Cloud.ts()); }
    catch (e) { T.err = 'Trading needs the new Firebase rules.'; return; }
    T.code = code; T.side = 'host'; listen();
  };
  T.join = async raw => {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); T.err = '';
    if (code.length !== 4) { T.err = 'Type the 4 letter room code.'; return; }
    if (!Cloud.user || !Cloud.ref('x')) return;
    let room; try { room = (await Cloud.ref(path(code)).once('value')).val(); } catch (e) { T.err = 'Trading needs the new Firebase rules.'; return; }
    if (!room || !room.host) { T.err = 'No room with that code.'; return; }
    const uid = Cloud.user.uid;
    if (room.host.uid === uid) { T.code = code; T.side = 'host'; listen(); return; }
    if (room.guest && room.guest.uid !== uid) { T.err = 'That room already has two players.'; return; }
    if (!room.guest) { try { await Cloud.ref(path(code) + '/guest').set({ uid, n: firstNameOf(Cloud.user), v: 0, ok: -1 }); } catch (e) { T.err = 'Could not join that room.'; return; } }
    T.code = code; T.side = 'guest'; listen();
  };
  T.leave = async () => {
    if (!T.code) return; closing = true; const code = T.code, sd = T.side;
    try { if (sd === 'host') await Cloud.ref(path(code)).remove(); else await Cloud.ref(path(code) + '/guest').remove(); } catch (e) { }
    reset();
  };
  const bump = async patch => { const m = me() || {}; await side().update(Object.assign({ v: (m.v || 0) + 1, ok: -1 }, patch)); };
  T.avail = key => (Game.s.inv[key] || 0) - ((me() && me().offer && me().offer[key]) || 0);
  T.offer = async (key, delta) => {
    if (!T.room || !me()) return; const o = Object.assign({}, cleanOffer(me().offer)); const have = Game.s.inv[key] || 0;
    const q = Math.max(0, Math.min(have, (o[key] || 0) + delta)); if (q > 0) o[key] = q; else delete o[key];
    if (Object.keys(o).length > 14) return;
    await bump({ offer: Object.keys(o).length ? o : null, done: null });
  };
  T.confirm = async () => { const c = comb(); if (c < 0) return; const a = cleanOffer(me().offer), b = cleanOffer(them() && them().offer); if (!Object.keys(a).length && !Object.keys(b).length) return; await side().update({ ok: c }); };
  T.unconfirm = async () => { await side().update({ ok: -1 }); };

  // both sides confirmed the same version -> each client does its own half of the swap, then marks itself done
  function check() {
    const room = T.room; if (!room || !room.host || !room.guest || !me()) return;
    const c = comb(), m = me(), t = them(), id = T.code + ':' + c;
    // finished: reset once the partner is done too (or has already moved on)
    if (m.done != null && (t.done === m.done || c !== m.done) && !T.busy) { T.busy = true; side().update({ offer: null, v: (m.v || 0) + 1, ok: -1, done: null }).finally(() => { T.busy = false; }); return; }
    if (m.ok === c && t.ok === c && m.done == null && !T.busy) {
      const s = Game.s; if (s.tradesDone.includes(id)) return;
      const mine = cleanOffer(m.offer), theirs = cleanOffer(t.offer);
      for (const k of Object.keys(mine)) if ((s.inv[k] || 0) < mine[k]) { UI.toast('Trade stopped', 'You no longer have everything you offered', '#ff4d6a'); side().update({ ok: -1 }); return; }
      T.busy = true;
      for (const k of Object.keys(mine)) Game.takeAura(k, mine[k]);
      for (const k of Object.keys(theirs)) Game.giveAura(k, theirs[k]);
      s.tradesDone.push(id); if (s.tradesDone.length > 30) s.tradesDone.shift(); Game.save();
      const got = Object.keys(theirs).map(k => info(k).name + (theirs[k] > 1 ? ' x' + theirs[k] : '')).join(', ');
      UI.toast('Trade complete', got ? 'You got ' + got : 'Gift sent', '#4de28a', true); UI.refreshAll();
      side().update({ done: c }).finally(() => { T.busy = false; });
    }
  }
  Cloud.onChange(() => { if (!Cloud.user && T.code) reset(); });
  return T;
})();

// ====================================================================== screens
Object.assign(UI, {
  // ---------------- ranks (GOALS > RANKS)
  renderRanks() {
    const sc = $('#panelBody').scrollTop, tabs = this.subTabs('goals', [['quests', 'QUESTS'], ['goals', 'GOALS'], ['ranks', 'RANKS']]);
    let h = '';
    if (!Cloud.user) h = '<div class="acct out"><div class="who">Leaderboard</div><p class="sub" style="margin:4px 0 10px">Sign in with Google to see how you rank against everyone else.</p><button class="btn gold" data-act="signin" style="width:100%">SIGN IN WITH GOOGLE</button></div>';
    else {
      if (!Board.data && !Board.err && !Board.loading) Board.load();
      const joined = Game.s.settings.board;
      h += '<div class="acct ' + (joined ? 'saved' : 'out') + '"><div class="who">' + (joined ? 'You are on the leaderboard' : 'Join the leaderboard') + '</div><p class="sub" style="margin:4px 0 10px">' +
        (joined ? 'Everyone can see your <b>first name</b>, rolls, auras found and rarest roll. Nothing else.' : 'Joining shows your <b>first name</b>, rolls, auras found and rarest roll to everyone who plays. Nothing else is shared. You can leave any time.') + '</p>' +
        '<div style="display:flex;gap:8px"><button class="btn ' + (joined ? 'ghost' : 'gold') + '" data-act="' + (joined ? 'bleave' : 'bjoin') + '" style="flex:1">' + (joined ? 'LEAVE' : 'JOIN') + '</button><button class="btn ghost" data-act="brefresh" style="flex:0 0 auto;min-width:0">REFRESH</button></div></div>';
      const cats = [['b', 'RAREST'], ['r', 'ROLLS'], ['f', 'AURAS'], ['rb', 'REBIRTHS']];
      h += '<div class="subtabs small">' + cats.map(([k, l]) => '<button class="' + (Board.sort === k ? 'on' : '') + '" data-act="bsort" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
      if (Board.err) h += '<p class="sub">' + esc(Board.err) + '</p>';
      else if (!Board.data) h += '<div class="empty">Loading...</div>';
      else {
        const list = Object.entries(Board.data).filter(([, e]) => e && e.n).sort((a, b) => (b[1][Board.sort] || 0) - (a[1][Board.sort] || 0)).slice(0, 30), uid = Cloud.user.uid;
        h += list.length ? list.map(([id, e], i) => {
          const val = Board.sort === 'b' ? (e.b ? '1 in ' + fmtN(e.b) : '-') : Board.sort === 'r' ? (e.r || 0).toLocaleString() : Board.sort === 'f' ? (e.f || 0) + ' / ' + AURAS.length : 'R' + (e.rb || 0);
          return '<div class="lrow' + (id === uid ? ' me' : '') + '"><i class="rk' + (i < 3 ? ' top' + (i + 1) : '') + '">' + (i + 1) + '</i><div class="ln"><b>' + esc(e.n) + '</b>' + (e.o ? '<span class="ownertag static">OWNER</span>' : '') + (e.rb ? '<em>R' + e.rb + '</em>' : '') + '<small>' + (Board.sort === 'b' && e.bn ? esc(e.bn) : (e.r || 0).toLocaleString() + ' rolls &middot; ' + (e.f || 0) + ' auras') + '</small></div><div class="lv">' + val + '</div></div>';
        }).join('') : '<div class="empty">Nobody has joined yet. Be the first!</div>';
      }
    }
    this.setPanel('GOALS', tabs + h); $('#panelBody').scrollTop = sc;
  },

  // ---------------- trade tab
  renderTrade() {
    const sc = $('#panelBody').scrollTop, T = Trade;
    let h = '';
    if (!Cloud.user) h = '<div class="acct out"><div class="who">Trade with friends</div><p class="sub" style="margin:4px 0 10px">Both of you need to be signed in with Google to trade or gift auras.</p><button class="btn gold" data-act="signin" style="width:100%">SIGN IN WITH GOOGLE</button></div>';
    else if (!T.code) {
      h = '<div class="acct out"><div class="who">Trade or gift auras</div><p class="sub" style="margin:4px 0 10px">One of you makes a room and shares the 4 letter code. The other types it in. Put auras in, both tap CONFIRM, and the swap happens. Offer nothing to just gift.</p>' +
        '<button class="btn gold" data-act="tcreate" style="width:100%">CREATE A ROOM</button></div>' +
        '<div class="sec">Join a friend\'s room</div><div class="arow"><input class="search" id="tCode" maxlength="4" placeholder="CODE" style="margin:0;text-transform:uppercase;letter-spacing:.3em;font-size:20px;text-align:center"><button class="btn" data-act="tjoin">JOIN</button></div>' + (T.err ? '<p class="sub" style="color:var(--bad)">' + esc(T.err) + '</p>' : '');
    } else {
      const room = T.room, m = room && room[T.side], t = room && room[T.side === 'host' ? 'guest' : 'host'], c = room && room.host && room.guest ? (room.host.v || 0) + (room.guest.v || 0) : -2;
      const mine = (m && m.offer) || {}, theirs = (t && t.offer) || {}, iOk = m && m.ok === c, tOk = t && t.ok === c, doneNow = m && m.done != null;
      const list = (o, edit) => Object.keys(o).length ? Object.keys(o).map(k => { const i = info(k); return '<div class="trow" style="--tc:' + i.tier.color + '"><div><b class="nmx t-' + i.tier.id + '">' + esc(i.name) + '</b><small>' + fmtOdds(i.eff) + '</small></div>' + (edit ? '<div class="qty"><button data-act="tless" data-v="' + k + '">-</button><span>' + o[k] + '</span><button data-act="toff" data-v="' + k + '">+</button></div>' : '<span class="qn">x' + o[k] + '</span>') + '</div>'; }).join('') : '<div class="sub" style="margin:6px 0">Nothing yet</div>';
      h = '<div class="acct ' + (t ? 'saved' : 'out') + '"><div class="who">Room ' + esc(T.code) + '</div><p class="sub" style="margin:4px 0 0">' + (t ? 'Trading with <b>' + esc(t.n || 'a friend') + '</b>' : 'Waiting for a friend. Tell them the code: <b>' + esc(T.code) + '</b>') + '</p></div>';
      h += '<div class="tcols"><div><div class="sec" style="margin-top:6px">You offer</div>' + list(mine, !iOk && !doneNow) + '</div><div><div class="sec" style="margin-top:6px">' + (t ? esc(t.n || 'They') : 'They') + ' offer' + (tOk ? ' <span style="color:var(--good)">(ready)</span>' : '') + '</div>' + list(theirs, false) + '</div></div>';
      if (t) {
        const any = Object.keys(mine).length || Object.keys(theirs).length;
        h += '<div style="margin:10px 0">' + (doneNow ? '<button class="btn" disabled style="width:100%">TRADE COMPLETE</button>' : iOk ? '<button class="btn ghost" data-act="tunconfirm" style="width:100%">YOU CONFIRMED - TAP TO CHANGE YOUR MIND</button>' : '<button class="btn gold" data-act="tconfirm" style="width:100%"' + (any ? '' : ' disabled') + '>CONFIRM TRADE</button>') + '</div>';
      }
      const keys = Object.keys(Game.s.inv).filter(k => Game.s.inv[k] > 0).map(info).sort((a, b) => b.eff - a.eff);
      if (!iOk && !doneNow) h += '<div class="sec">Your bag - tap to add</div><div class="grid">' + (keys.length ? keys.map(i => { const av = T.avail(i.key); return '<button class="acard' + (av <= 0 ? ' unk' : '') + '" data-act="toff" data-v="' + i.key + '" style="' + tcStyle(i.aura) + '--vc:' + (i.variant.color || '#fff') + '"' + (av <= 0 ? ' disabled' : '') + '><div class="nm nmx t-' + i.tier.id + '">' + esc(i.aura.name) + '</div><div class="od">' + fmtOdds(i.aura.odds) + '</div>' + (i.variant.id !== 'normal' ? '<span class="vt">' + i.variant.name + '</span>' : '') + '<span class="ct">x' + av + '</span></button>'; }).join('') : '<div class="empty" style="grid-column:1/-1">Your bag is empty.</div>') + '</div>';
      h += '<div style="margin-top:14px"><button class="btn red" data-act="tleave" style="width:100%">LEAVE ROOM</button></div>';
    }
    this.setPanel('TRADE', h); $('#panelBody').scrollTop = sc;
  },

  socialAct(act, v, t) {
    const refresh = () => { if (this.tab === 'trade') this.renderTrade(); };
    if (act === 'bjoin') { Board.join(); return true; }
    if (act === 'bleave') { Board.leave(); return true; }
    if (act === 'brefresh') { Board.load(true).then(() => this.renderRanks()); return true; }
    if (act === 'bsort') { Board.sort = v; this.renderRanks(); return true; }
    if (act === 'tcreate') { Trade.create().then(refresh); return true; }
    if (act === 'tjoin') { Trade.join($('#tCode') ? $('#tCode').value : '').then(refresh); return true; }
    if (act === 'toff') { Trade.offer(v, 1); return true; }
    if (act === 'tless') { Trade.offer(v, -1); return true; }
    if (act === 'tconfirm') { Trade.confirm(); return true; }
    if (act === 'tunconfirm') { Trade.unconfirm(); return true; }
    if (act === 'tleave') { Trade.leave().then(refresh); refresh(); return true; }
    return false;
  },
});
