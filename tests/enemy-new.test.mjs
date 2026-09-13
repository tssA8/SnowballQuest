import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const phaser = `export default { Physics: { Arcade: { Sprite: class {
  constructor(scene,x,y) { this.scene=scene; this.x=x; this.y=y; this.active=true; }
  setOrigin() { return this; } setDepth() { return this; } setFrame(frame) { this.frame=frame; return this; }
  clearTint() { return this; } setTintFill() { return this; } setTint() { return this; } setFlipX() { return this; }
  setAlpha() { return this; } setVisible() { return this; }
  destroy() { this.active=false; this.scene=undefined; }
} } } };`;
const source = ts.transpileModule(await readFile(new URL('../src/game/entities/Enemy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from 'phaser'", `from '${moduleUrl(phaser)}'`);
const { Enemy } = await import(moduleUrl(source));

function fight(kind) {
  let hits = 0, effectsDestroyed = 0;
  const body = {
    enable: true, gravity: true, velocity: { x: 0, y: 0 }, setSize() { return this; }, setOffset() { return this; },
    setMaxVelocity() { return this; }, setVelocityX(x) { this.velocity.x=x; return this; },
    setVelocityY(y) { this.velocity.y=y; return this; }, setVelocity(x,y) { this.velocity={x,y}; return this; },
    setAllowGravity(value) { this.gravity=value; return this; }, setEnable(value) { this.enable=value; return this; },
  };
  const graphics = {
    clear() { return this; }, setDepth() { return this; }, fillStyle() { return this; }, fillCircle() { return this; },
    lineStyle() { return this; }, strokeCircle() { return this; }, destroy() { effectsDestroyed++; },
  };
  const collider = { world: {}, destroy() { this.world=null; } };
  const home = {
    add: { existing() {}, graphics: () => graphics },
    physics: { add: { existing(sprite) { sprite.body=body; }, collider: () => collider } },
    world: { solids: {} }, player: { x: 930, y: 640 }, combat: { fruit: 'water' }, sparkle() {},
    damage() { hits++; return true; },
  };
  const enemy = new Enemy(home, kind, 900, 640, 800, 1100);
  return { enemy, body, home, hits: () => hits, effectsDestroyed: () => effectsDestroyed };
}

test('six additional enemy kinds all have clear warning frames and remain beatable in two to four normal hits', () => {
  for (const kind of ['pigeon', 'slime', 'beetle', 'mole', 'dragon', 'shadow']) {
    const { enemy, hits } = fight(kind);
    enemy.updateCombat(0, 16); assert.equal(enemy.state, 'windup', kind);
    enemy.updateCombat(649, 16); assert.equal(enemy.state, 'windup'); assert.equal(hits(), 0);
    let count = 0;
    while (!enemy.defeated && count < 5) { enemy.hit(10, 1, 700 + count * 300); count++; }
    assert.ok(count >= 2 && count <= 4, kind); assert.equal(enemy.defeated, true);
    enemy.updateCombat(10000, 16); assert.equal(hits(), 0);
  }
});

test('pigeon flies and dives; slime and mole use different jumping attacks', () => {
  const { enemy: pigeon, body } = fight('pigeon');
  pigeon.updateCombat(0, 16); assert.equal(body.gravity, false); assert.ok(pigeon.y < 640);
  pigeon.updateCombat(850, 16); const high = pigeon.y;
  pigeon.updateCombat(900, 50); assert.ok(pigeon.y > high);
  const jumpSpeeds = [];
  for (const kind of ['slime', 'mole']) {
    const { enemy, body } = fight(kind);
    enemy.updateCombat(0, 16); enemy.updateCombat(850, 16);
    assert.ok(body.velocity.y < 0); jumpSpeeds.push(body.velocity.y);
  }
  assert.notEqual(jumpSpeeds[0], jumpSpeeds[1]);
});

test('dragon fires from a distance and shadow combines a copied-color shot with its charge', () => {
  for (const kind of ['dragon', 'shadow']) {
    const { enemy, body, home } = fight(kind);
    home.player.x = 1080;
    enemy.updateCombat(0, 16); enemy.updateCombat(kind === 'dragon' ? 1100 : 850, 16);
    assert.equal(enemy.shots.length, 1);
    assert.equal(body.velocity.x === 0, kind === 'dragon');
    if (kind === 'shadow') assert.equal(enemy.shots[0].color, 0x84d7ff);
    enemy.hit(100, -1, 1200); assert.equal(enemy.shots.length, 0);
  }
});

test('ranged-hit retry can destroy a summon synchronously without leaving projectiles or effects', () => {
  const { enemy, home, effectsDestroyed } = fight('dragon');
  home.player.x = 1080;
  enemy.updateCombat(0, 16); enemy.updateCombat(1100, 16);
  home.player.x = enemy.shots[0].x; home.player.y = enemy.shots[0].y + 24;
  home.damage = () => { enemy.destroy(); return true; };
  enemy.updateCombat(1116, 16);
  assert.equal(enemy.active, false); assert.equal(enemy.shots.length, 0); assert.equal(effectsDestroyed(), 1);
});
