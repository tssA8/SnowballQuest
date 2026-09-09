import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Only the Phaser rendering shell is mocked; these regressions execute the real controller.
const phaserStub = `export default {
  Physics: { Arcade: { Sprite: class {
    constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; this.active = true; }
    setOrigin() { return this; } setDepth() { return this; } setFlipX() { return this; }
    setAlpha() { return this; } setFrame() { return this; } play() { return this; }
  } } },
  Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) }
};`;
const stubUrl = `data:text/javascript;base64,${Buffer.from(phaserStub).toString('base64')}`;
const source = await readFile(new URL('../src/game/entities/Player.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from 'phaser'", `from '${stubUrl}'`);
const { Player } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function controller() {
  const events = [];
  const body = {
    velocity: { x: 0, y: 0 }, blocked: { down: true }, touching: { down: false },
    setSize() { return this; }, setOffset() { return this; }, setMaxVelocity() { return this; },
    setCollideWorldBounds() { return this; }, setAllowGravity() { return this; },
    setAcceleration() { return this; }, setVelocityX(x) { this.velocity.x = x; return this; },
    setVelocityY(y) { this.velocity.y = y; return this; },
    setVelocity(x, y) { this.velocity = { x, y }; return this; },
  };
  const controls = {
    axis: 0, jumpHeld: false, jumpQueued: false,
    consumeJump() { const result = this.jumpQueued; this.jumpQueued = false; return result; },
    consumeDash() { return false; }, clear() { this.jumpQueued = false; this.jumpHeld = false; },
  };
  const scene = {
    time: { now: 0 }, add: { existing() {} },
    physics: { add: { existing(sprite) { sprite.body = body; } } },
    events: { emit(name) { events.push(name); } }, anims: { exists() { return false; } },
  };
  const player = new Player(scene, 160, 640, controls);
  const step = time => { scene.time.now = time; player.update(time, 8); };
  const press = () => { controls.jumpHeld = true; controls.jumpQueued = true; };
  return { player, body, controls, events, step, press };
}

test('stale grounded contacts on high-refresh frames cannot re-arm a rising jump', () => {
  const c = controller();
  c.step(0);
  c.press(); c.step(8);
  assert.equal(c.body.velocity.y, -420);
  // No physics tick occurred: blocked.down still reflects the previous grounded step.
  c.controls.jumpHeld = false; c.step(16);
  c.press(); c.step(24);
  assert.equal(c.events.filter(name => name === 'player-jumped').length, 1);
  assert.equal(c.player.grounded, false);
});

test('coyote jump accepts a recent ledge departure and rejects an expired one', () => {
  for (const [delay, expected] of [[80, 1], [121, 0]]) {
    const c = controller();
    c.step(0);
    c.body.blocked.down = false;
    c.body.velocity.y = 20;
    c.press(); c.step(delay);
    assert.equal(c.events.filter(name => name === 'player-jumped').length, expected);
  }
});

test('holding jump never automatically queues another jump after landing', () => {
  const c = controller();
  c.step(0); c.press(); c.step(8);
  c.body.blocked.down = false; c.step(200);
  c.body.blocked.down = true; c.body.velocity.y = 0; c.step(800); c.step(808);
  assert.equal(c.events.filter(name => name === 'player-jumped').length, 1);
});

test('a fresh jump pressed before landing buffers once, then expires', () => {
  for (const [landing, expected] of [[180, 1], [240, 0]]) {
    const c = controller();
    c.body.blocked.down = false; c.body.velocity.y = 120;
    c.press(); c.step(100);
    c.body.blocked.down = true; c.body.velocity.y = 0;
    c.step(landing);
    assert.equal(c.events.filter(name => name === 'player-jumped').length, expected);
  }
});
