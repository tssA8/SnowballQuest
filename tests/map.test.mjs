import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTiledMap } from '../src/game/data/level.ts';

const raw = JSON.parse(readFileSync(new URL('../public/assets/maps/home.json', import.meta.url), 'utf8'));
const level = parseTiledMap(raw);
const gameObjects = ['objects', 'collectibles', 'npcs', 'triggers', 'checkpoints', 'exits', 'decorBack', 'decorFront']
  .flatMap(key => level[key]);
const properties = Object.fromEntries(raw.properties.map(property => [property.name, property.value]));

test('Home is a complete bounded Tiled map with unique persistent and editor IDs', () => {
  assert.equal(level.width, 4096);
  assert.equal(level.height, 768);
  assert.equal(level.tileSize, 32);
  const required = ['Ground', 'Platforms', 'DecorBack', 'DecorFront', 'Collision', 'Objects', 'Spawn', 'Collectibles', 'NPC', 'Triggers', 'Checkpoints', 'Exit'];
  assert.deepEqual(raw.layers.map(layer => layer.name), required);
  assert.equal(raw.layers.find(layer => layer.name === 'Collision').visible, false);
  const allObjects = raw.layers.flatMap(layer => layer.objects ?? []);
  assert.equal(new Set(allObjects.map(object => object.name)).size, allObjects.length, 'Object names must remain unique save keys');
  assert.equal(new Set(allObjects.map(object => object.id)).size, allObjects.length, 'Tiled editor IDs must be unique');
  for (const object of gameObjects) {
    assert.ok(object.x >= 0 && object.x <= level.width, `${object.id} must stay inside world width`);
    assert.ok(object.y >= 0 && object.y <= level.height, `${object.id} must stay inside world height`);
  }
  for (const layer of raw.layers.filter(layer => layer.type === 'tilelayer')) {
    assert.equal(layer.data.length, raw.width * raw.height);
    assert.ok(layer.data.every(tile => Number.isInteger(tile) && tile >= 0 && tile <= 2));
  }
});

test('Collectible totals include exactly one box reward without duplicate star credit', () => {
  const count = type => level.collectibles.filter(object => object.type === type).length;
  assert.equal(count('fish'), properties.fishTotal);
  assert.equal(count('fish'), 30);
  assert.equal(count('feather'), properties.featherTotal);
  const rewardIds = level.objects.filter(object => object.type === 'toy-box').map(object => object.properties.reward);
  assert.deepEqual(rewardIds, ['star-box']);
  assert.equal(count('star') + rewardIds.length, properties.starTotal);
  assert.equal(properties.starTotal, 3);
  assert.ok(!level.collectibles.some(object => rewardIds.includes(object.id)), 'A spawned reward cannot also be a placed collectible');
  assert.equal(count('key'), 1);
});

test('Spawn, every checkpoint, and linked tunnel arrivals have safe standing space', () => {
  const supported = (x, y) => level.platforms.some(platform =>
    y === platform.y && x >= platform.x + 16 && x <= platform.x + platform.width - 16);
  assert.ok(supported(level.spawn.x, level.spawn.y), 'Spawn feet must meet a collision surface');
  for (const checkpoint of level.checkpoints) assert.ok(supported(checkpoint.x, checkpoint.y), checkpoint.id);
  for (const tunnel of level.objects.filter(object => object.type === 'cat-tunnel')) {
    const destination = level.objects.find(object => object.id === tunnel.properties.targetId);
    assert.ok(destination, `${tunnel.id} needs a valid paired entrance`);
    assert.equal(destination.type, 'cat-tunnel');
    assert.equal(destination.properties.targetId, tunnel.id);
    assert.ok(supported(tunnel.properties.targetX, tunnel.properties.targetY), `${tunnel.id} cannot send the player into a fall`);
  }
});

test('All collision surfaces are reachable inside the held-jump envelope', () => {
  // Conservative envelope: 150 px/s is slower than the current player tuning.
  // Platforms are one-way, so the player can jump through their undersides.
  const gravity = 900;
  const upwardSpeed = 420;
  const walkingSpeed = 150;
  const maxRise = upwardSpeed ** 2 / (2 * gravity);
  const reachable = new Set(level.platforms.filter(platform => platform.y === level.spawn.y &&
    level.spawn.x >= platform.x && level.spawn.x <= platform.x + platform.width).map(platform => platform.id));
  for (const tunnel of level.objects.filter(object => object.type === 'cat-tunnel')) {
    const destination = level.platforms.find(platform => platform.y === tunnel.properties.targetY &&
      tunnel.properties.targetX >= platform.x && tunnel.properties.targetX <= platform.x + platform.width);
    if (destination) reachable.add(destination.id);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const from of level.platforms.filter(platform => reachable.has(platform.id))) {
      for (const to of level.platforms.filter(platform => !reachable.has(platform.id))) {
        const rise = from.y - to.y;
        if (rise > maxRise) continue;
        const flight = (upwardSpeed + Math.sqrt(upwardSpeed ** 2 - 2 * gravity * rise)) / gravity;
        const gap = Math.max(0, to.x - (from.x + from.width), from.x - (to.x + to.width));
        if (gap + 24 <= walkingSpeed * flight) {
          reachable.add(to.id);
          changed = true;
        }
      }
    }
  }
  assert.deepEqual(level.platforms.filter(platform => !reachable.has(platform.id)).map(platform => platform.id), [],
    'No unreachable shelf should block a quest or collectible');
  const key = level.collectibles.find(object => object.type === 'key');
  assert.ok(level.platforms.some(platform => reachable.has(platform.id) && key.x >= platform.x &&
    key.x <= platform.x + platform.width && platform.y - key.y >= 0 && platform.y - key.y <= maxRise),
  'The mandatory key needs a reachable support surface within jump height');
});

test('Objective prerequisites reference implemented mission flags and prevent skipping the box', () => {
  const knownFlags = new Set(['key-found', 'mouse-helped', 'box-open', 'scratched', 'balcony-open']);
  const requiredFlags = object => String(object.properties.requires ?? '').split(',').filter(Boolean);
  for (const object of [...level.objects, ...level.exits]) {
    for (const flag of requiredFlags(object)) assert.ok(knownFlags.has(flag), `${object.id} refers to unsupported flag ${flag}`);
  }
  assert.deepEqual(requiredFlags(level.objects.find(object => object.type === 'toy-box')).sort(), ['mouse-helped', 'scratched']);
  assert.deepEqual(requiredFlags(level.objects.find(object => object.type === 'door')).sort(), ['box-open', 'key-found', 'mouse-helped']);
  assert.deepEqual(requiredFlags(level.exits[0]), ['balcony-open']);
});

test('Malformed required level data fails with a clear diagnostic', () => {
  const missingSpawn = structuredClone(raw);
  missingSpawn.layers = missingSpawn.layers.filter(layer => layer.name !== 'Spawn');
  assert.throws(() => parseTiledMap(missingSpawn), /missing Spawn object layer/);
  const corruptPosition = structuredClone(raw);
  corruptPosition.layers.find(layer => layer.name === 'Collectibles').objects[0].x = 'somewhere';
  assert.throws(() => parseTiledMap(corruptPosition), /must be a finite number/);
});
