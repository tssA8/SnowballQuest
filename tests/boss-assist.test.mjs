import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rules = compile(await readFile(new URL('../src/game/combat/rules.ts', import.meta.url), 'utf8'));
const bossSource = compile(await readFile(new URL('../src/game/entities/WrenchBoss.ts', import.meta.url), 'utf8'))
  .replace("from 'phaser'", `from '${moduleUrl('export default { Math: { Clamp: (v,a,b) => Math.max(a, Math.min(b,v)) } };')}'`)
  .replace("from '../combat/rules'", `from '${moduleUrl(rules)}'`)
  .replace("from '../services'", `from '${moduleUrl('export const save = { data: { settings: { reducedMotion: false } } };')}'`);
const { WrenchBoss } = await import(moduleUrl(bossSource));
const { bossHitDamage } = await import(moduleUrl(rules));

function createBoss() {
  const sprite = {
    x: 4410, y: 640,
    setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; },
    setFrame() { return this; }, clearTint() { return this; }, setTintFill() { return this; },
    setFlipX() { return this; }, setAlpha() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
  };
  const home = {
    add: { sprite: () => sprite }, events: { emit() {} }, notify() {}, sparkle() {},
    player: { x: 4100, y: 640, isDashing: false }, damage() { return true; },
  };
  return new WrenchBoss(home, { bomb() {}, drone() {}, defeated() {} });
}

test('charged blast pierces active armor while ordinary attacks still receive armor reduction', () => {
  for (const piercing of [false, true]) {
    const boss = createBoss();
    boss.start(0); boss.update(1800, 16);
    assert.equal(boss.state, 'telegraph');
    const before = boss.health;
    assert.equal(boss.hit(140, boss.x - 100, 1900, piercing), true);
    const actual = before - boss.health;
    assert.equal(actual, piercing ? 140 : bossHitDamage(140, false, false, true));
    if (!piercing) assert.ok(actual < 140);
  }
});

test('charged blast cannot damage the boss during intro or after a retry reset', () => {
  const boss = createBoss();
  boss.start(0);
  assert.equal(boss.hit(140, boss.x, 500, true), false);
  assert.equal(boss.health, boss.maxHealth);
  boss.update(1800, 16);
  boss.hit(140, boss.x, 1900, true);
  boss.reset();
  assert.equal(boss.hit(140, boss.x, 2000, true), false);
  assert.equal(boss.health, boss.maxHealth);
  assert.equal(boss.state, 'dormant');
});

test('piercing retains the overheated rear weak-point bonus', () => {
  for (const behind of [false, true]) {
    const boss = createBoss();
    boss.start(0); boss.update(1800, 16);
    boss.health = 200; boss.phase = 3; boss.state = 'overheat';
    const before = boss.health;
    const sourceX = boss.x + (behind ? 100 : -100);
    boss.hit(40, sourceX, 1900, true);
    assert.equal(before - boss.health, bossHitDamage(40, true, behind, false));
  }
});
