'use strict';
// ---- flex card: a shareable picture of one of your auras ----

const Flex = (() => {
  const W = 1080, H = 1350, TAU = Math.PI * 2;
  const firstName = () => (Cloud.user && Cloud.user.displayName ? Cloud.user.displayName.trim().split(/\s+/)[0].slice(0, 16) : '');

  // text with manual letter spacing (works in every browser)
  function spaced(c, text, x, y, sp, align) {
    const w = [...text].reduce((a, ch) => a + c.measureText(ch).width + sp, -sp);
    let px = align === 'center' ? x - w / 2 : x;
    for (const ch of text) { c.fillText(ch, px, y); px += c.measureText(ch).width + sp; }
    return w;
  }
  function fitFont(c, text, maxW, size, weight, family) {
    for (; size > 40; size -= 4) { c.font = weight + ' ' + size + 'px ' + family; if (c.measureText(text).width <= maxW) break; }
    return size;
  }

  async function render(key) {
    const i = info(key), a = i.aura, vid = i.variant.id, col = FX.variantColors(a, vid), tcol = FX.hex(i.tier.color);
    try { await Promise.all([document.fonts.load('900 italic 100px "Barlow Condensed"'), document.fonts.load('700 30px "Barlow"')]); } catch (e) { }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const HD = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif', BD = '"Barlow", Arial, sans-serif';

    // background
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05070e'); bg.addColorStop(.6, FX.rgba(FX.mix([8, 12, 24], col[1], .22), 1)); bg.addColorStop(1, '#04060c');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 130; k++) { c.fillStyle = 'rgba(255,255,255,' + (Math.random() * .6 + .1) + ')'; const s = Math.random() * 2.2 + .5; c.fillRect(Math.random() * W, Math.random() * H * .8, s, s); }
    const cx = W / 2, cy = 560, R = 360;
    // ground glow
    c.save(); c.translate(cx, cy + R * .62); c.scale(1, .2); const gg = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.5); gg.addColorStop(0, FX.rgba(col[0], .6)); gg.addColorStop(1, FX.rgba(col[0], 0)); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, R * 1.5, 0, TAU); c.fill(); c.restore();
    // warm the effect up for a couple of seconds so the particles are all over the place, then draw the frame we keep
    const fx = new FX.AuraFX(); fx.set(a, vid);
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tc = tmp.getContext('2d');
    for (let f = 0; f < 70; f++) { tc.clearRect(0, 0, W, H); fx.draw(tc, cx, cy, R, 1 / 30, 'back'); fx.draw(tc, cx, cy, R, 1 / 30, 'front'); if (f % 14 === 0) await new Promise(r => setTimeout(r, 0)); }
    tc.clearRect(0, 0, W, H); c.save(); c.globalCompositeOperation = 'source-over';
    fx.draw(c, cx, cy, R, 1 / 60, 'back'); c.globalCompositeOperation = 'source-over'; FX.figure(c, cx, cy, R, col[0], 0); fx.draw(c, cx, cy, R, 1 / 60, 'front'); c.restore();
    c.globalCompositeOperation = 'source-over';
    // vignette
    const vg = c.createRadialGradient(cx, cy, R * .9, cx, cy, H * .85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);

    // frame
    c.strokeStyle = FX.rgba(tcol, .85); c.lineWidth = 6; c.strokeRect(30, 30, W - 60, H - 60); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.strokeRect(44, 44, W - 88, H - 88);
    // top label
    c.textBaseline = 'alphabetic'; c.fillStyle = i.tier.color; c.font = '900 italic 40px ' + HD; spaced(c, i.tier.name.toUpperCase() + (vid !== 'normal' ? '  -  ' + i.variant.name.toUpperCase() : ''), cx, 125, 14, 'center');
    // name
    const nm = a.name.toUpperCase(), size = fitFont(c, nm, W - 140, 190, '900 italic', HD); c.font = '900 italic ' + size + 'px ' + HD; c.textAlign = 'center';
    c.shadowColor = FX.rgba(col[0], .9); c.shadowBlur = 40;
    if (i.tier.id === 'transcendent') { const g = c.createLinearGradient(cx - 400, 0, cx + 400, 0); ['#ff5b5b', '#ffd84a', '#5bff9a', '#5bc8ff', '#c05bff'].forEach((x, k) => g.addColorStop(k / 4, x)); c.fillStyle = g; }
    else if (i.tier.id === 'exalted') { const g = c.createLinearGradient(cx - 400, 0, cx + 400, 0); g.addColorStop(0, '#27f0e0'); g.addColorStop(1, '#8fffa8'); c.fillStyle = g; }
    else c.fillStyle = '#fff';
    c.fillText(nm, cx, 1000); c.shadowBlur = 0;
    // odds
    c.fillStyle = FX.rgba(tcol, 1); c.font = '800 italic 62px ' + HD; c.textAlign = 'left'; spaced(c, fmtOdds(i.eff).toUpperCase(), cx, 1090, 8, 'center');
    // bottom strip
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(120, 1135, W - 240, 2);
    const who = firstName(), s = Game.s;
    c.fillStyle = '#cdd6e8'; c.font = '700 34px ' + BD;
    const left = who ? 'ROLLED BY ' + who.toUpperCase() : 'ROLLED IN AURA ROLL';
    c.textAlign = 'left'; spaced(c, left, 120, 1198, 5, 'left');
    if (Cloud.admin) { const tw = c.measureText(left).width + left.length * 5 + 20; c.fillStyle = '#ffc83a'; c.fillRect(120 + tw, 1166, 130, 42); c.fillStyle = '#1a1000'; c.font = '900 italic 30px ' + HD; spaced(c, 'OWNER', 120 + tw + 14, 1198, 5, 'left'); }
    c.fillStyle = '#8c98b0'; c.font = '600 30px ' + BD; c.textAlign = 'left';
    spaced(c, s.rolls.toLocaleString() + ' ROLLS   ' + Object.keys(s.index).length + '/' + AURAS.length + ' AURAS' + (s.rebirths ? '   REBIRTH ' + s.rebirths : ''), 120, 1245, 3, 'left');
    c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = '900 italic 56px ' + HD; c.fillText('AURA ROLL', W - 120, 1198);
    c.fillStyle = '#8c98b0'; c.font = '600 26px ' + BD; c.fillText('treyblade9to10-eng.github.io/aura-roll', W - 120, 1245);
    return cv;
  }

  async function open(key) {
    if (!key || !(Game.s.inv[key] > 0 || Game.s.seen[key])) { UI.toast('Nothing to flex yet', 'Roll an aura first', '#ff4d6a'); return; }
    UI.openDialog('Flex card', '<p class="sub">Making your card...</p>', false);
    let cv; try { cv = await render(key); } catch (e) { console.warn(e); UI.closeModal(); UI.toast('Could not make the card', e.message || '', '#ff4d6a'); return; }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), url = URL.createObjectURL(blob), nm = info(key).name.replace(/[^\w]+/g, '-').toLowerCase();
    const file = new File([blob], 'aura-roll-' + nm + '.png', { type: 'image/png' }), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    UI.openDialog('Flex card', '<img class="flexpic" src="' + url + '" alt="Your aura card"><p class="sub" style="margin:8px 0">' + (canShare ? 'Share it straight to your friends, or save it.' : 'Tap SAVE. On a phone you can also press and hold the picture.') + '</p>' +
      '<div class="acts">' + (canShare ? '<button class="btn" id="fxShare">SHARE</button>' : '') + '<a class="btn gold" id="fxSave" href="' + url + '" download="' + file.name + '">SAVE</a><button class="btn ghost" id="fxClose">CLOSE</button></div>', false);
    $('#fxClose').onclick = () => { UI.closeModal(); URL.revokeObjectURL(url); };
    const sh = $('#fxShare'); if (sh) sh.onclick = () => navigator.share({ files: [file], title: 'My aura in Aura Roll', text: 'I rolled ' + info(key).name + ' (' + fmtOdds(info(key).eff) + ') in Aura Roll!' }).catch(() => { });
    Flex.last = { cv, blob };
  }
  return { open, render, last: null };
})();
