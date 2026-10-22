'use strict';
// ---- cloud save (Google sign-in + Firebase) and owner verification ----
// Saves live at aura/saves/{uid} and only that account can read or write them.
// Owner mode: the editor code is never in this file. Firebase's rules compare it, so a wrong code is simply refused.

const Cloud = (() => {
  const CONFIG = {
    apiKey: 'AIzaSyDkw-xjR0eAkCPR3BRQyKk0Rnusu3pbEmw',
    authDomain: 'cardio-game-3713.firebaseapp.com',
    databaseURL: 'https://cardio-game-3713-default-rtdb.firebaseio.com',
    projectId: 'cardio-game-3713',
  };
  const SDK = ['app', 'auth', 'database'].map(n => 'https://www.gstatic.com/firebasejs/9.23.0/firebase-' + n + '-compat.js');
  const META = 'auraroll.cloud';

  // status: off (cannot reach Firebase) | out (not signed in) | sync (checking) | saving | saved | denied (rules not set up) | error
  const C = { status: 'out', user: null, admin: false, savedAt: 0, error: '', listeners: [] };
  let db = null, pushT = null, pushing = false, again = false, keyRef = null, conflictOpen = false, started = false;

  const getMeta = () => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch (e) { return {}; } };
  const setMeta = o => { try { localStorage.setItem(META, JSON.stringify(Object.assign(getMeta(), o))); } catch (e) { } };
  if (!getMeta().dev) setMeta({ dev: Math.random().toString(36).slice(2, 10) });
  const dev = getMeta().dev;

  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return h; };
  // what counts as "changed" (play time and potion timers tick constantly, so they are left out)
  const stateKey = () => JSON.stringify(Object.assign({}, Game.s, { play: 0, active: [] }));
  const dirty = () => { const m = getMeta(); return !(C.user && m.uid === C.user.uid && m.hash === hash(stateKey())); };
  const summary = d => ({ rolls: d.rolls || 0, found: Object.keys(d.index || {}).length, coins: d.coins || 0 });

  function set(status, msg) { C.status = status; C.error = msg || ''; C.listeners.forEach(f => f()); }
  function toast(a, b, c) { if (typeof UI !== 'undefined') UI.toast(a, b, c); }

  function loadSdk() {
    return SDK.reduce((p, src) => p.then(() => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load Firebase')); document.head.appendChild(s);
    })), Promise.resolve());
  }

  async function init() {
    if (started) return; started = true;
    try { await loadSdk(); } catch (e) { set('off', 'No connection to the cloud right now.'); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(CONFIG);
      db = firebase.database();
      firebase.auth().getRedirectResult().catch(() => { });
      firebase.auth().onAuthStateChanged(u => {
        C.user = u || null; watchKey(u);
        if (u) resolve(); else { clearTimeout(pushT); pushT = null; set('out'); }
      });
    } catch (e) { set('off', e.message); return; }
    Game.on('changed', schedule);
    document.addEventListener('visibilitychange', () => {
      if (!C.user || !db) return;
      if (document.hidden) { if (dirty()) { clearTimeout(pushT); pushT = null; push(); } }
      else if (!pushing && !conflictOpen) check();
    });
    addEventListener('pagehide', () => { if (C.user && db && dirty()) push(); });
  }

  // ---------- sign in / out ----------
  function signIn() {
    if (!db) { toast('Cloud is not available right now', 'Check your connection and try again', '#ff4d6a'); return; }
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    firebase.auth().signInWithPopup(p).catch(e => {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) firebase.auth().signInWithRedirect(p);
      else if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('Sign in did not work', e.message || '', '#ff4d6a');
    });
  }
  async function signOut() {
    if (!db) return;
    if (C.user && dirty()) await push();
    await firebase.auth().signOut();
  }

  // ---------- saving ----------
  function schedule() {
    if (!C.user || !db || C.status === 'denied' || conflictOpen || pushT) return;
    if (!dirty()) return;
    pushT = setTimeout(() => { pushT = null; push(); }, 5000);
  }
  async function push(force) {
    if (!C.user || !db || C.status === 'denied') return false;
    if (pushing) { again = true; return false; }
    pushing = true; again = false; set('saving');
    const uid = C.user.uid, m = getMeta(), at = Date.now(), data = JSON.stringify(Game.s), h = hash(stateKey()), s = summary(Game.s);
    let conflict = null, ok = false;
    try {
      const res = await db.ref('aura/saves/' + uid).transaction(cur => {
        if (cur && !force && !(m.uid === uid && m.at === cur.at) && cur.dev !== dev) { conflict = cur; return; }
        return { at, dev, rolls: s.rolls, data };
      }, null, false);
      if (res.committed) { setMeta({ uid, at, hash: h }); C.savedAt = at; ok = true; set('saved'); }
      else if (conflict) { set('saved'); showConflict(conflict); }
      else set('saved');
    } catch (e) {
      if (e && (e.code === 'PERMISSION_DENIED' || /permission_denied/i.test(e.message || ''))) set('denied', 'Cloud saving is not switched on yet (Firebase rules).');
      else set('error', e.message || 'Could not save');
    }
    pushing = false;
    if (again || (ok && dirty())) schedule();
    return ok;
  }

  // first look after sign-in: decide whether cloud or this device wins
  async function resolve() {
    set('sync');
    let remote;
    try { remote = (await db.ref('aura/saves/' + C.user.uid).once('value')).val(); }
    catch (e) {
      if (e && (e.code === 'PERMISSION_DENIED' || /permission_denied/i.test(e.message || ''))) set('denied', 'Cloud saving is not switched on yet (Firebase rules).');
      else set('error', e.message || 'Could not reach the cloud');
      return;
    }
    const m = getMeta(), s = Game.s, empty = !s.rolls && !s.coins;
    if (!remote) { push(true); return; }
    if (m.uid === C.user.uid && m.at === remote.at) { set('saved'); if (dirty()) schedule(); return; }
    if (empty) { applyRemote(remote, 'Loaded your cloud save'); return; }
    if (m.uid === C.user.uid && !dirty()) { applyRemote(remote, 'Loaded your newest save'); return; }
    showConflict(remote);
  }
  // when the tab comes back to the front, see if another device saved in the meantime
  async function check() {
    let remote;
    try { remote = (await db.ref('aura/saves/' + C.user.uid).once('value')).val(); } catch (e) { return; }
    const m = getMeta();
    if (!remote || (m.uid === C.user.uid && m.at === remote.at) || remote.dev === dev) return;
    if (!dirty()) applyRemote(remote, 'Updated from your other device'); else showConflict(remote);
  }

  function applyRemote(remote, msg) {
    let d; try { d = JSON.parse(remote.data); } catch (e) { set('error', 'Cloud save was unreadable'); return; }
    Game.setState(d);
    setMeta({ uid: C.user.uid, at: remote.at, hash: hash(stateKey()) });
    C.savedAt = remote.at; set('saved');
    if (typeof UI !== 'undefined') { UI.refreshEquipped(); UI.refreshHud(true); UI.refreshToggles(); if (UI.tab) { const t = UI.tab; UI.tab = null; UI.openTab(t); } }
    toast(msg, summary(d).rolls.toLocaleString() + ' rolls, ' + summary(d).found + ' auras', '#4de28a');
  }
  function loadCloudNow() { return db && C.user ? resolveForce() : null; }
  async function resolveForce() {
    set('sync');
    try { const r = (await db.ref('aura/saves/' + C.user.uid).once('value')).val(); if (r) applyRemote(r, 'Loaded your cloud save'); else { set('saved'); toast('No cloud save yet', '', '#8c98b0'); } }
    catch (e) { set('error', e.message); }
  }

  function showConflict(remote) {
    if (conflictOpen) return; conflictOpen = true;
    let d = {}; try { d = JSON.parse(remote.data); } catch (e) { }
    const a = summary(Game.s), b = summary(d), fmt = n => n.toLocaleString();
    UI.openDialog('Two saves found',
      '<p class="sub">Your cloud save and this device have different progress. Pick the one to keep. The other one is replaced.</p>' +
      '<div class="cmp"><div><b>CLOUD</b><span>' + fmt(b.rolls) + ' rolls</span><span>' + b.found + ' auras</span></div><div><b>THIS DEVICE</b><span>' + fmt(a.rolls) + ' rolls</span><span>' + a.found + ' auras</span></div></div>' +
      '<div class="acts"><button class="btn" id="cfCloud">USE CLOUD</button><button class="btn gold" id="cfLocal">USE THIS DEVICE</button></div>', true);
    const done = () => { conflictOpen = false; UI.closeModal(); };
    $('#cfCloud').onclick = () => { done(); applyRemote(remote, 'Loaded your cloud save'); };
    $('#cfLocal').onclick = () => { done(); push(true); toast('Saving this device to the cloud', '', '#36e6ff'); };
  }

  // ---------- owner mode ----------
  function watchKey(u) {
    if (keyRef) { keyRef.off(); keyRef = null; }
    const was = C.admin; C.admin = false;
    if (!u || !db) { if (was) changed(); return; }
    keyRef = db.ref('aurakeys/' + u.uid);
    keyRef.on('value', s => { const now = s.val() != null; if (now !== C.admin) { C.admin = now; changed(); } }, () => { if (C.admin) { C.admin = false; changed(); } });
  }
  function changed() { C.listeners.forEach(f => f()); if (typeof UI !== 'undefined') UI.refreshAdminBits(); }
  async function unlock(code) {
    if (!C.user || !db) throw new Error('Sign in with Google first');
    code = String(code || '').trim(); if (!code) throw new Error('Type the code first');
    try { await db.ref('aurakeys/' + C.user.uid).set(code); }
    catch (e) { throw new Error('That did not work. Wrong code, or the Firebase rules are not set up yet.'); }
    C.admin = true; changed();
  }
  async function lock() { if (!C.user || !db) return; try { await db.ref('aurakeys/' + C.user.uid).remove(); } catch (e) { } C.admin = false; changed(); }

  Object.assign(C, { init, signIn, signOut, push, unlock, lock, loadCloudNow, onChange: f => C.listeners.push(f), dirty,
    saveNow: () => { clearTimeout(pushT); pushT = null; return push(); } });
  return C;
})();
