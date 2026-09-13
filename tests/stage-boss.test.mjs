import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rules = compile(await readFile(new URL('../src/game/combat/rules.ts', import.meta.url), 'utf8'));
const source = compile(await readFile(new URL('../src/game/entities/StageBoss.ts', import.meta.url), 'utf8'))
  .replace("from 'phaser'", `from '${moduleUrl('export default { Math: { Clamp: (v,a,b) => Math.max(a, Math.min(b,v)) } };')}'`)
  .replace("from '../combat/rules'", `from '${moduleUrl(rules)}'`)
  .replace("from './WrenchBoss'", `from '${moduleUrl('export const ARENA = { left:3520, right:4864, floor:640, spawn:4410 };')}'`)
  .replace("from '../services'", `from '${moduleUrl('export const save = { data: { settings: { reducedMotion: false } } };')}'`);
const { StageBoss } = await import(moduleUrl(source));
const { inMeleeRange } = await import(moduleUrl(rules));
const cases = [
  ['boss-galeplume', 'dive'], ['boss-bobo', 'waterjet'], ['boss-volt', 'dash'],
  ['boss-tato', 'shockwave'], ['boss-bubble', 'bubbles'], ['boss-nightink', 'copywave'],
];

function fight(key) {
  const events = [], drones = [];
  const sprite = {
    x: 4410, y: 640, active: true,
    setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; },
    setFrame(frame) { this.frame = frame; return this; }, clearTint() { return this; }, setTintFill() { return this; },
    setTint() { return this; }, setFlipX() { return this; }, setAlpha() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; }, setY(y) { this.y = y; return this; },
    destroy() { this.active = false; },
  };
  const home = {
    add: { sprite: () => sprite }, events: { emit(name) { events.push(name); } }, notify() {}, sparkle() {},
    player: { x: 4100, y: 640, isDashing: false }, combat: { fruit: 'fire' }, damage() { return true; },
  };
  const boss = new StageBoss(home, { bomb() {}, drone(x) { drones.push(x); }, defeated() { events.push('defeated'); } },
    { bossKey: key, bossName: key });
  return { boss, home, events, drones };
}

test('each later boss has a distinct first attack with at least one second of warning', () => {
  const actions = new Set();
  for (const [key, action] of cases) {
    const { boss } = fight(key);
    boss.start(0); boss.update(1800, 16);
    assert.equal(boss.state, 'telegraph'); assert.equal(boss.nextAction, action, key);
    assert.ok(boss.warning.length > 0); actions.add(boss.nextAction);
    boss.update(3049, 0); assert.equal(boss.state, 'telegraph');
    boss.update(3050, 0); assert.equal(boss.state, 'attack');
  }
  assert.equal(actions.size, 6);
});

test('all later bosses expose all three phases and clear hazards when changing phase', () => {
  for (const [key] of cases) {
    const { boss } = fight(key);
    boss.start(0); boss.update(1800, 16); boss.update(3050, 16);
    boss.hit(Math.ceil(boss.maxHealth * .35), boss.x - 100, 3100, true);
    assert.equal(boss.phase, 2, key); assert.equal(boss.state, 'recover'); assert.equal(boss.hazardCount, 0);
    boss.update(5100, 0); assert.equal(boss.state, 'recover', 'Two seconds to counterattack');
    boss.update(5700, 0); assert.equal(boss.state, 'telegraph');
    boss.hit(Math.ceil(boss.maxHealth * .35), boss.x - 100, 5800, true);
    assert.equal(boss.phase, 3); assert.equal(boss.state, 'overheat'); assert.equal(boss.hazardCount, 0);
    assert.equal(boss.y, 640, 'Even flying bosses are reachable by ordinary attacks');
    assert.ok(boss.warning.length > 0);
  }
});

test('charged blasts deal their full damage through Tato armor; intro stays immune', () => {
  for (const [key] of cases) {
    const { boss } = fight(key);
    boss.start(0);
    assert.equal(boss.hit(140, boss.x, 1000, true), false);
    boss.update(1800, 0);
    const before = boss.health;
    boss.hit(140, boss.x - 100, 1900, true);
    assert.equal(before - boss.health, 140, key);
  }
  const { boss } = fight('boss-tato');
  boss.start(0); boss.update(1800, 0);
  boss.hit(100, boss.x - 100, 1900);
  assert.equal(boss.maxHealth - boss.health, 55);
});

test('ordinary attacks can defeat every later boss without any required fruit', () => {
  for (const [key] of cases) {
    const { boss, home, events } = fight(key);
    home.combat.fruit = null;
    const phases = new Set();
    boss.start(0);
    for (let now = 0; now < 150000 && !boss.defeated; now += 50) {
      boss.update(now, 50); phases.add(boss.phase);
      const target = boss.x - boss.facing * 105;
      home.player.x += Math.sign(target - home.player.x) * Math.min(Math.abs(target - home.player.x), 210 * .05);
      const facing = home.player.x < boss.x ? 1 : -1;
      if (now % 300 === 0 && inMeleeRange(home.player.x, 640, facing, boss.x, boss.y, 82, 140))
        boss.hit(12, home.player.x, now);
    }
    assert.equal(boss.defeated, true, key); assert.deepEqual([...phases], [1, 2, 3]);
    assert.equal(boss.hazardCount, 0); assert.equal(boss.hit(140, boss.x, 200000, true), false);
    assert.equal(events.filter(name => name === 'defeated').length, 1);
  }
});

test('a synchronous lethal-hit retry cancels each boss attack and all remaining hazards', () => {
  for (const [key] of cases) {
    const { boss, home } = fight(key);
    home.damage = () => false;
    boss.start(0); boss.update(1800, 0); boss.update(3050, 0);
    if (boss.hazards.length) {
      const hazard = boss.hazards[0];
      home.player.x = hazard.x;
      home.player.y = ['jet', 'tail', 'pillar', 'wind', 'gravity'].includes(hazard.kind) ? 640 : hazard.y + 24;
    } else { home.player.x = boss.x; home.player.y = boss.y; }
    let retries = 0;
    home.damage = () => { retries++; boss.reset(); return true; };
    boss.update(3066, 16);
    assert.equal(retries, 1, key);
    assert.equal(boss.active, false); assert.equal(boss.state, 'dormant');
    assert.equal(boss.hazardCount, 0); assert.equal(boss.health, boss.maxHealth);
    boss.update(100000, 16); assert.equal(boss.state, 'dormant');
  }
});

test('Nightink copies the equipped element into a different attack shape', () => {
  for (const [fruit, kind] of [['fire', 'orb'], ['water', 'orb'], ['wind', 'feather'], ['earth', 'wave'], ['lightning', 'pillar']]) {
    const { boss, home } = fight('boss-nightink'); home.combat.fruit = fruit;
    boss.start(0); boss.update(1800, 0); boss.update(3050, 0);
    assert.ok(boss.hazards.length > 0); assert.equal(boss.hazards[0].kind, kind, fruit);
  }
});

test('pause retains hazard position and reset or destruction fully clears projectiles', () => {
  const { boss } = fight('boss-bubble');
  boss.start(0); boss.update(1800, 0); boss.update(3050, 0);
  assert.ok(boss.hazardCount > 0);
  const before = boss.hazards.map(h => [h.x, h.y]);
  boss.update(3050, 0); assert.deepEqual(boss.hazards.map(h => [h.x, h.y]), before);
  boss.reset(); assert.equal(boss.hazardCount, 0);
  boss.start(4000); boss.update(5800, 0); boss.update(7050, 0);
  assert.ok(boss.hazardCount > 0);
  boss.destroy(); assert.equal(boss.hazardCount, 0); assert.equal(boss.active, false);
});
