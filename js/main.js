'use strict';
// ---- boot + main loop ----

(function () {
  Game.load();
  if (!Game.s.settings.sound) Sound.toggle();
  Game.nextBiome = 35;
  const stage = new Stage($('#stage'));
  window.stage = stage;
  UI.init(stage);

  const s = Game.s;
  $('#startSave').textContent = s.rolls ? 'Welcome back. ' + s.rolls.toLocaleString() + ' rolls, ' + Object.keys(s.index).length + '/' + AURAS.length + ' auras.' : '';
  $('#startBtn').onclick = () => { Sound.init(); Sound.click(); $('#start').remove(); };

  const rollBtn = $('#roll');
  rollBtn.onclick = () => { UI.roll(); rollBtn.blur(); };

  addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input,textarea')) return;
    if (!$('#start')) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); UI.roll(); }
      else if (e.code === 'KeyA') UI.toggleAuto();
      else if (e.code === 'KeyQ') UI.toggleQuick();
      else if (e.code === 'KeyE') UI.equipLast();
      else if (e.code === 'Escape') { if (!$('#modal').classList.contains('hidden')) UI.closeModal(); else UI.closePanel(); }
      else if (/^Digit[1-5]$/.test(e.code)) UI.openTab(['bag', 'index', 'shop', 'goals', 'more'][+e.code[5] - 1]);
    }
  });

  let last = performance.now(), hudT = 0, saveT = 0;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    stage.frame(dt);
    if (!$('#start')) {
      Game.tick(dt);
      const cd = Game.cooldownTotal ? Game.cooldown / Game.cooldownTotal : 0;
      $('#cdfill').style.transform = 'skewX(9deg) scaleX(' + cd.toFixed(3) + ')';
      rollBtn.disabled = UI.busy || Game.cooldown > 0;
      if (Game.s.settings.auto && Game.s.up.auto && !UI.busy && Game.cooldown <= 0) UI.roll(true);
      hudT += dt; if (hudT > .25) { hudT = 0; UI.refreshHud(); }
      saveT += dt; if (saveT > 10) { saveT = 0; Game.save(); }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  addEventListener('beforeunload', () => Game.save());
})();
