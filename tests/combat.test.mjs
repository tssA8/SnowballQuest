import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/game/combat/rules.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ComboChain, COMBAT, bossPhase, bossHitDamage, inMeleeRange } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const bossSource = await readFile(new URL('../src/game/entities/WrenchBoss.ts', import.meta.url), 'utf8');
const bossCompiled = ts.transpileModule(bossSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from 'phaser'", `from '${asModule('export default { Math: { Clamp: (v,a,b) => Math.max(a, Math.min(b,v)) } };')}'`)
  .replace("from '../combat/rules'", `from '${asModule(compiled)}'`)
  .replace("from '../services'", `from '${asModule('export const save = { data: { settings: { reducedMotion: false } } };')}'`);
const { WrenchBoss } = await import(asModule(bossCompiled));
const enemySource = await readFile(new URL('../src/game/entities/Enemy.ts', import.meta.url), 'utf8');
const enemyPhaser = `export default { Physics: { Arcade: { Sprite: class {
  constructor(scene,x,y) { this.scene=scene; this.x=x; this.y=y; this.active=true; }
  setOrigin() { return this; } setDepth() { return this; } setFrame() { return this; }
  clearTint() { return this; } setTintFill() { return this; } setFlipX() { return this; }
  setAlpha() { return this; } setVisible() { return this; }
  destroy() { this.active=false; this.scene=undefined; }
} } } };`;
const enemyCompiled = ts.transpileModule(enemySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from 'phaser'", `from '${asModule(enemyPhaser)}'`);
const { Enemy } = await import(asModule(enemyCompiled));

function bossFight() {
  const events = [], bombs = [], drones = [];
  const sprite = {
    x: 4410, y: 640, setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; },
    setFrame(frame) { this.frame = frame; return this; }, clearTint() { return this; }, setTintFill() { return this; },
    setFlipX() { return this; }, setAlpha() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; }, destroy() {},
  };
  const home = {
    add: { sprite: () => sprite }, events: { emit: name => events.push(name) }, notify() {}, sparkle() {},
    player: { x: 4100, y: 640, isDashing: false, body: { velocity: { x: 0 }, setVelocityX() {} } },
    damage() { return true; }, time: { now: 0 },
  };
  const boss = new WrenchBoss(home, { bomb: x => bombs.push(x), drone: x => drones.push(x), defeated: () => events.push('defeated') });
  return { boss, home, events, bombs, drones };
}

function enemyFight() {
  let hits = 0, colliderDestroyed = 0;
  const body = {
    enable: true, velocity: { x: 0, y: 0 }, setSize() { return this; }, setOffset() { return this; },
    setMaxVelocity() { return this; }, setVelocityX(x) { this.velocity.x = x; return this; },
    setVelocity(x,y) { this.velocity = { x,y }; return this; }, setEnable(value) { this.enable=value; return this; },
  };
  const collider = { world: {}, destroy() { assert.ok(this.world); this.world=null; colliderDestroyed++; } };
  const home = {
    add: { existing() {} }, physics: { add: { existing(sprite) { sprite.body=body; }, collider() { return collider; } } },
    world: { solids: {} }, player: { x: 930, y: 640 }, sparkle() {}, damage() { hits++; return true; },
  };
  const enemy = new Enemy(home, 'vacuum', 930, 640, 850, 1140);
  return { enemy, body, collider, hits: () => hits, colliderDestroyed: () => colliderDestroyed };
}

test('three-hit combo rejects mashing during cooldown and wraps after the finisher', () => {
  const chain = new ComboChain();
  assert.equal(chain.attack(0, false).step, 1);
  assert.equal(chain.attack(259, false), null);
  assert.equal(chain.attack(260, false).step, 2);
  assert.equal(chain.attack(550, false).step, 3);
  assert.equal(chain.attack(999, false), null);
  assert.equal(chain.attack(1000, false).step, 1);
});

test('ordinary enemy contact is harmless; its telegraphed charge damages only once', () => {
  const { enemy, hits } = enemyFight();
  enemy.updateCombat(0, 16); assert.equal(enemy.state, 'windup');
  enemy.updateCombat(849, 16); assert.equal(hits(), 0);
  enemy.updateCombat(850, 16); assert.equal(enemy.state, 'charge');
  enemy.updateCombat(851, 1); assert.equal(hits(), 1);
  enemy.updateCombat(1000, 16); assert.equal(hits(), 1);
  enemy.updateCombat(1310, 16); assert.equal(enemy.state, 'recover');
});

test('enemy defeat becomes a harmless stun and collider cleanup is safe twice', () => {
  const { enemy, body, hits, colliderDestroyed } = enemyFight();
  enemy.hit(20, 1, 0); enemy.hit(20, 1, 300);
  assert.equal(enemy.defeated, true); assert.equal(enemy.state, 'stunned'); assert.equal(body.enable, false);
  enemy.updateCombat(10000, 50); assert.equal(hits(), 0);
  assert.equal(enemy.hit(20, 1, 10001), false);
  enemy.destroy(); enemy.destroy(); assert.equal(colliderDestroyed(), 1);
});

test('third combo launches surviving enemies; Wrench strengthens the push and stagger', () => {
  for (const reinforced of [false, true]) {
    const { enemy, body } = enemyFight();
    enemy.hit(18, -1, 300);
    enemy.finishCombo(-1, 300, reinforced);
    assert.equal(body.velocity.x, reinforced ? -270 : -210);
    assert.equal(body.velocity.y, reinforced ? -180 : -140);
    enemy.updateCombat(950, 16);
    assert.equal(enemy.state, reinforced ? 'recover' : 'patrol');
  }
});

test('third combo does not launch a defeated or disabled enemy', () => {
  for (const defeated of [false, true]) {
    const { enemy, body } = enemyFight();
    if (defeated) enemy.hit(enemy.health, 1, 0);
    else body.setEnable(false);
    enemy.finishCombo(1, 0, true);
    assert.deepEqual(body.velocity, { x: 0, y: 0 });
  }
});

test('an expired combo or an aerial attack starts a fresh ground chain', () => {
  const chain = new ComboChain();
  chain.attack(0, false); chain.attack(260, false);
  assert.equal(chain.attack(1200, false).step, 1);
  assert.equal(chain.attack(1600, true).air, true);
  assert.equal(chain.count, 0);
  assert.equal(chain.attack(2000, false).step, 1);
  chain.update(2000 + COMBAT.comboWindow + 1);
  assert.equal(chain.count, 0);
  chain.reset();
  assert.equal(chain.attack(0, false).step, 1);
});

test('boss exposes all three phases and every normal attack can damage its overheated front', () => {
  assert.equal(bossPhase(420, 420), 1);
  assert.equal(bossPhase(280, 420), 2);
  assert.equal(bossPhase(140, 420), 3);
  for (const damage of COMBAT.attackDamage) {
    assert.ok(bossHitDamage(damage, true, false) >= damage);
    assert.ok(bossHitDamage(damage, true, true) > bossHitDamage(damage, true, false));
    assert.ok(bossHitDamage(damage, false, false, true) > 0);
    assert.ok(bossHitDamage(damage, false, false, true) < damage);
  }
});

test('boss charge warns for 1150ms and provides at least one second of recovery', () => {
  const { boss } = bossFight();
  boss.start(0); boss.update(1800, 16);
  assert.equal(boss.state, 'telegraph');
  boss.update(2949, 16); assert.equal(boss.state, 'telegraph');
  boss.update(2950, 16); assert.equal(boss.state, 'charge');
  let now = 2950;
  while (boss.state === 'charge') { now += 50; boss.update(now, 50); }
  assert.equal(boss.state, 'recover');
  boss.update(now + 1000, 16); assert.equal(boss.state, 'recover');
});

test('retry inside a lethal charge remains dormant and cancels previous phase hazards', () => {
  const { boss, home, bombs, drones } = bossFight();
  boss.start(0); boss.update(1800, 16); boss.update(2950, 16);
  home.player.x = boss.x;
  home.damage = () => { boss.reset(); return true; };
  boss.update(3000, 50);
  assert.equal(boss.active, false);
  assert.equal(boss.state, 'dormant');
  assert.equal(boss.health, boss.maxHealth);
  boss.update(100000, 50);
  assert.equal(boss.state, 'dormant');
  assert.equal(bombs.length + drones.length, 0);
});

test('phase two summons only after warning; normal attacks can finish phase three exactly once', () => {
  const { boss, bombs, drones, events } = bossFight();
  boss.start(0); boss.update(1800, 16);
  boss.hit(440, boss.x - 100, 1800); // Armor still limits damage, crossing only the first threshold.
  assert.equal(boss.phase, 2);
  assert.equal(boss.state, 'recover');
  boss.update(4200, 16);
  assert.equal(boss.nextAction, 'bombs');
  boss.update(5449, 16);
  assert.equal(bombs.length, 0);
  boss.update(5450, 16);
  assert.equal(bombs.length, 3); assert.equal(drones.length, 1);
  for (let i = 0; i < 1000 && !boss.defeated; i++) boss.hit(10, boss.x - 100, 5000 + i * 300);
  assert.equal(boss.phase, 3);
  assert.equal(boss.health, 0);
  assert.equal(boss.sprite.frame, 7);
  assert.equal(boss.hit(10, boss.x, 100000), false);
  assert.equal(events.filter(event => event === 'defeated').length, 1);
});

test('paused scene time does not advance a boss warning when its combat clock stays still', () => {
  const { boss, home } = bossFight();
  boss.start(0); boss.update(1800, 16);
  home.time.now = 120000;
  boss.update(1800, 0);
  assert.equal(boss.state, 'telegraph');
  boss.update(2949, 0); assert.equal(boss.state, 'telegraph');
});

test('normal melee alone wins all phases with both frequent and deliberate attack timing', t => {
  for (const interval of [300, 650]) {
    const { boss, home } = bossFight();
    const chain = new ComboChain();
    const phases = new Set();
    boss.start(0);
    let now = 0, nextAttack = 0;
    for (; now < 180000 && !boss.defeated; now += 50) {
      boss.update(now, 50);
      phases.add(boss.phase);
      const target = boss.x - boss.facing * 140;
      const distance = target - home.player.x;
      home.player.x += Math.sign(distance) * Math.min(Math.abs(distance), 210 * .05);
      const facing = home.player.x < boss.x ? 1 : -1;
      if (now >= nextAttack && inMeleeRange(home.player.x, 640, facing, boss.x, 640, 82, 190)) {
        const hit = chain.attack(now, false);
        if (hit) { boss.hit(hit.damage, home.player.x, now); nextAttack = now + interval; }
      }
    }
    assert.equal(boss.defeated, true, 'No fruit or special attack is required');
    assert.deepEqual([...phases], [1, 2, 3]);
    t.diagnostic(`Normal attack interval ${interval}ms, ideal rear chase at walk speed: ${(now / 1000).toFixed(1)}s; excludes player damage/retries.`);
  }
});

test('melee reaches only the facing side and cannot hit through a high platform', () => {
  assert.equal(inMeleeRange(100, 640, 1, 180, 640, 82), true);
  assert.equal(inMeleeRange(100, 640, -1, 180, 640, 82), false);
  assert.equal(inMeleeRange(100, 640, 1, 170, 512, 82), false);
  assert.equal(inMeleeRange(100, 580, 1, 180, 640, 98, 44, true), true);
  assert.equal(inMeleeRange(100, 640, 1, 245, 640, 82), false);
});

