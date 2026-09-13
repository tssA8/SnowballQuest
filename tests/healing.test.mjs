import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = await readFile(new URL('../src/game/combat/HealingDrops.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from '../entities/WrenchBoss'", `from '${asModule(
  'export const ARENA = { left: 3520, right: 4864, floor: 640, trigger: 3650, spawn: 4410, entrance: 3620 };',
)}'`);
const { HealingDrops } = await import(asModule(compiled));

function supplies() {
  const containers = [];
  let destroyed = 0, heals = 0;
  const drawing = () => {
    const shape = {};
    for (const name of ['fillStyle', 'fillEllipse', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect',
      'strokeEllipse', 'setDisplaySize', 'setOrigin']) shape[name] = () => shape;
    return shape;
  };
  const home = {
    mode: 'playing', hearts: 5, player: { x: 0, y: 640 }, sparkle() {}, notify() {},
    add: {
      graphics: drawing, image: drawing, text: drawing,
      container(x, y) {
        const view = {
          x, y, visible: true, setDepth() { return this; },
          setVisible(value) { this.visible = value; return this; },
          setPosition(x, y) { this.x = x; this.y = y; return this; },
          destroy() { destroyed++; },
        };
        containers.push(view); return view;
      },
    },
    heal(amount, energy) {
      const oldHearts = this.hearts, oldEnergy = this.combat.energy;
      this.hearts = Math.min(5, this.hearts + amount);
      this.combat.energy = Math.min(100, this.combat.energy + energy);
      const improved = oldHearts !== this.hearts || oldEnergy !== this.combat.energy;
      if (improved) heals++;
      return improved;
    },
  };
  // CombatSystem owns supplies, so constructor must not dereference home.combat yet.
  const drops = new HealingDrops(home);
  home.combat = { energy: 100, boss: { active: false, defeated: false } };
  const advance = milliseconds => { for (let left = milliseconds; left > 0; left -= 50) drops.update(Math.min(left, 50)); };
  return { drops, home, containers, advance, heals: () => heals, destroyed: () => destroyed };
}

test('walking into a can heals two hearts and adds energy once; full supplies preserve it', () => {
  const { home, drops, heals } = supplies();
  home.player.x = 1800;
  drops.update(16);
  assert.equal(drops.activeCount, 5);
  home.hearts = 2; home.combat.energy = 75;
  drops.update(16);
  assert.equal(home.hearts, 4); assert.equal(home.combat.energy, 95);
  assert.equal(heals(), 1); assert.equal(drops.activeCount, 4);
  drops.update(16); assert.equal(heals(), 1);
});

test('a can can refill only energy, but cannot be picked up through a high platform', () => {
  const { home, drops, heals } = supplies();
  home.player.x = 1800; home.player.y = 510; home.combat.energy = 95;
  drops.update(16); assert.equal(heals(), 0);
  home.player.y = 640;
  drops.update(16);
  assert.equal(home.hearts, 5); assert.equal(home.combat.energy, 100);
  assert.equal(drops.activeCount, 4);
});

test('arena cans respawn after twelve playing seconds, preserving timer during pause', () => {
  const { home, drops, containers, advance, heals } = supplies();
  const arenaCan = containers.find(can => can.x === 3800);
  home.player.x = 3800; home.hearts = 3; home.combat.boss.active = true;
  drops.update(16); assert.equal(arenaCan.visible, false);
  home.player.x = 4000;
  advance(11950); assert.equal(arenaCan.visible, false);
  home.mode = 'paused'; advance(60000); assert.equal(arenaCan.visible, false);
  home.mode = 'playing'; drops.update(50); assert.equal(arenaCan.visible, true);
  home.hearts = 4; home.player.x = 3800;
  drops.update(16); assert.equal(home.hearts, 5); assert.equal(heals(), 2);
});

test('retry replenishes arena cans immediately while route cans remain collected', () => {
  const { home, drops, containers, advance } = supplies();
  home.hearts = 3; home.player.x = 1800; drops.update(16);
  home.hearts = 3; home.player.x = 4160; drops.update(16);
  home.player.x = 0; advance(24000);
  assert.equal(containers.find(can => can.x === 4160).visible, false, 'inactive arena does not respawn supplies');
  drops.resetArena();
  assert.equal(containers.find(can => can.x === 4160).visible, true);
  assert.equal(containers.find(can => can.x === 1800).visible, false);
  assert.equal(drops.activeCount, 4);
});

test('low-health rescue stays inside arena, remains unique, and observes cooldown', () => {
  const { home, drops, containers, advance } = supplies();
  const rescue = containers.at(-1);
  home.combat.boss.active = true; home.hearts = 2; home.player.x = 4300;
  drops.update(16);
  assert.equal(rescue.visible, true);
  assert.ok(rescue.x >= 3590 && rescue.x <= 4794);
  assert.ok(Math.abs(rescue.x - home.player.x) <= 100);
  advance(20000); assert.equal(containers.length, 6, 'repeated rescue checks allocate no additional objects');
  home.player.x = rescue.x; drops.update(16);
  assert.equal(rescue.visible, false); assert.equal(home.hearts, 4);
  home.hearts = 2; home.player.x = 4500;
  drops.update(16); assert.equal(rescue.visible, true);
  home.player.x = rescue.x; drops.update(16); assert.equal(rescue.visible, false);
  home.hearts = 2; home.player.x = 3970;
  advance(17000); assert.equal(rescue.visible, false);
  advance(1000); assert.equal(rescue.visible, true);
  drops.resetArena(); assert.equal(rescue.visible, false);
});

test('cleanup is safe twice and prevents future healing or visual allocation', () => {
  const { home, drops, containers, advance, destroyed, heals } = supplies();
  drops.destroy(); drops.destroy(); drops.resetArena();
  home.hearts = 1; home.player.x = 1800; home.combat.boss.active = true;
  advance(60000);
  assert.equal(destroyed(), 6); assert.equal(drops.activeCount, 0);
  assert.equal(heals(), 0); assert.equal(containers.length, 6);
});
