// Integration fixture for an isolated local origin. Positioning and direct
// boss damage isolate progression; this is not a human difficulty playthrough.
const out = document.createElement('pre');
out.id = 'qa-results'; out.style = 'position:fixed;z-index:9999;top:0;right:0;background:#fff9edee;color:#372939;font:12px monospace;padding:10px;max-width:510px;max-height:40vh;overflow:auto;white-space:pre-wrap';
document.body.append(out);
const lines = [], errors = [];
const log = message => { lines.push(message); out.textContent = lines.join('\n'); out.scrollTop = out.scrollHeight; };
const ok = (value, message) => { if (!value) throw Error(message); log('PASS ' + message); };
window.addEventListener('error', event => { errors.push(event.message); log('RUNTIME ' + event.message); });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const codes = { Enter: 13, KeyE: 69, KeyJ: 74, KeyK: 75, KeyQ: 81, Space: 32, ArrowRight: 39, Escape: 27 };
function key(code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, keyCode: codes[code], which: codes[code], bubbles: true })); }
async function tap(code, ms = 35) { key(code, true); await wait(ms); key(code, false); await wait(60); }
async function dismiss(scene) { for (let n = 0; n < 6 && scene.mode === 'dialogue'; n++) await tap('KeyE'); }
const button = document.createElement('button'); button.textContent = 'Run seven-stage checks'; button.style = 'position:fixed;z-index:10000;top:0;left:0'; document.body.append(button);
button.onclick = async () => {
  button.disabled = true;
  try {
    const game = window.__snowball;
    ok(game?.scene.isActive('Menu'), 'menu booted');
    const stages = ['home', 'rooftop', 'basement', 'parking', 'foundations', 'floor13', 'nightark'];
    const fruits = ['fire', 'wind', 'water', 'lightning', 'earth'];
    const bosses = ['wrench', 'galeplume', 'bobo', 'volt', 'tato', 'bubble', 'nightink'];
    for (const boss of bosses) ok(game.textures.exists('boss-' + boss), 'boss art ' + boss);
    await tap('Enter'); await wait(300);
    for (let i = 0; i < stages.length; i++) {
      const s = game.scene.getScene('Home'); await dismiss(s);
      ok(s.stage.id === stages[i] && s.mode === 'playing', 'entered ' + stages[i]);
      ok(!s.hasFlag('boss-defeated') && s.stars === 0, 'fresh run ' + stages[i]);
      const initialX = s.player.x; key('ArrowRight', true); await wait(400); key('ArrowRight', false);
      ok(s.player.x > initialX + 50, 'movement ' + stages[i]);
      s.player.respawn(500, 640); await wait(150);
      if (i < 5) ok(s.combat.fruit === fruits[i] && s.combat.availableFruits.includes(fruits[i]), 'trial ' + fruits[i]);
      if (i === 0) {
        s.hearts = 2; s.combat.energy = 40; s.player.respawn(1800, 640); await wait(150);
        ok(s.hearts === 4 && s.combat.energy >= 60, 'can heals 2 hearts and 20 energy');
        s.player.respawn(600, 640); await wait(180); s.combat.energy = 100;
        await tap('KeyK'); ok(s.combat.energy < 90, 'short K fires');
        await wait(800); s.combat.energy = 100; key('KeyK', true); await wait(1350);
        ok(s.combat.chargeReady, 'held K fills charge'); key('KeyK', false); await wait(80);
        ok(!s.combat.charging && s.combat.fireballs.some(p => p.piercing && p.damage >= 140), 'release fires armor-piercing blast');
        await wait(800); key('KeyK', true); await wait(300); await tap('Escape'); key('KeyK', false);
        const energy = s.combat.energy, count = s.combat.fireballs.length; await wait(250);
        ok(s.mode === 'paused' && !s.combat.charging && s.combat.energy === energy, 'pause cancels charge and freezes energy');
        await tap('Escape'); await wait(80); ok(s.combat.fireballs.length <= count, 'resume never fires cancelled charge');
      }
      if (i === 1) {
        s.player.respawn(550, 640); await wait(100); await tap('Space', 100); key('Space', true); await wait(100);
        ok(s.player.body.velocity.y < -200, 'wind provides second jump'); key('Space', false);
      }
      if (i === 2) {
        s.combat.cast(); ok(s.combat.shieldActive, 'water shot grants shield');
        const hearts = s.hearts; s.invulnerableUntil = 0; s.damage(1, s.player.x + 100);
        ok(s.hearts === hearts && !s.combat.shieldActive, 'water shield absorbs damage');
      }
      if (i === 4) {
        const hearts = s.hearts; s.invulnerableUntil = 0; s.damage(1, s.player.x + 100);
        ok(s.hearts === hearts, 'earth armor absorbs damage');
      }
      s.player.respawn(3680, 640); await wait(2100);
      const boss = s.combat.boss; ok(boss.active && !s.hasFlag('key-found') && s.stars === 0, 'boss without collection gate ' + stages[i]);
      // Fire one real charged attack against the encounter before isolated damage.
      for (let n = 0; n < 180 && !['recover', 'overheat'].includes(boss.state); n++) await wait(50);
      ok(boss.active && ['recover', 'overheat'].includes(boss.state), 'reachable recovery window ' + stages[i]);
      s.player.respawn(boss.x - 170, 640); s.player.facing = 1;
      key('KeyK', true); await wait(1300); key('KeyK', false); await wait(450);
      ok(boss.health < boss.maxHealth, 'charged attack hits ' + stages[i]);
      const phases = new Set([boss.phase]);
      for (let n = 0; n < 150 && !boss.defeated; n++) { phases.add(boss.phase); boss.hit(12, boss.x - 100, s.combat.clock, false); await wait(8); }
      ok(boss.defeated && s.mode === 'dialogue', 'reconciliation ' + stages[i]);
      await dismiss(s); ok(s.mode === 'complete', 'clear screen ' + stages[i]);
      const data = JSON.parse(localStorage.getItem('snowball-quest-save-v1'));
      ok(data.stages[stages[i]].completed && data.bossBadges.includes(stages[i]), 'saved completion ' + stages[i]);
      if (i < 6) { ok(data.unlockedStages.includes(stages[i + 1]), 'next stage unlocked'); s.nextStage(); await wait(350); }
    }
    const data = JSON.parse(localStorage.getItem('snowball-quest-save-v1'));
    ok(data.unlockedStages.length === 7 && data.unlockedFruits.length === 5 && data.unlockedSupport.length === 7, 'full campaign rewards');
    ok(data.maxHearts === 6 && data.maxPurrEnergy === 120, 'permanent heart and energy upgrades');
    ok(errors.length === 0, 'no browser runtime errors');
    log('ALL CAMPAIGN CHECKS PASSED');
  } catch (error) { log('FAIL ' + error.message + '\n' + error.stack); }
  button.disabled = false;
};
