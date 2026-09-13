import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { ROUTES, generateStage } from '../scripts/generate-stages.mjs';

async function moduleFrom(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const [{ parseTiledMap }, { STAGES, stageById }, { StageWorld }] = await Promise.all([
  moduleFrom('../src/game/data/level.ts'), moduleFrom('../src/game/data/stages.ts'),
  moduleFrom('../src/game/world/StageWorld.ts'),
]);
const maps = new Map(await Promise.all(ROUTES.map(async route => {
  const raw = JSON.parse(await readFile(new URL(`../public/assets/maps/${route.id}.json`, import.meta.url), 'utf8'));
  return [route.id, { raw, level: parseTiledMap(raw) }];
})));

test('all seven stage records form the design progression with distinct boss assets', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['home', 'rooftop', 'basement', 'parking', 'foundations', 'floor13', 'nightark']);
  assert.deepEqual(STAGES.map(s => s.index), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(STAGES.map(s => s.fruit), ['fire', 'wind', 'water', 'lightning', 'earth', null, null]);
  assert.deepEqual(STAGES.map(s => s.bossName), ['扳手', '風翎', '波波', '伏特', '土豆', '泡泡龍媽媽', '夜墨']);
  assert.equal(new Set(STAGES.map(s => s.bossKey)).size, 7);
  const knownEnemies = new Set(['vacuum', 'mouse', 'pigeon', 'slime', 'beetle', 'mole', 'dragon', 'shadow']);
  for (const stage of STAGES) {
    assert.equal(stageById(stage.id), stage);
    assert.ok(stage.intro.length > 0 && stage.reconcile.length > 0 && stage.reward);
    assert.ok(stage.enemies.every(kind => knownEnemies.has(kind)));
  }
  assert.equal(stageById('invalid-save-stage'), STAGES[0]);
});

test('six shipped Tiled maps match their generator and include every runtime layer', () => {
  const names = ['Ground', 'Platforms', 'DecorBack', 'DecorFront', 'Collision', 'Objects', 'Spawn',
    'Collectibles', 'NPC', 'Triggers', 'Checkpoints', 'Exit'];
  for (const route of ROUTES) {
    const { raw, level } = maps.get(route.id);
    assert.deepEqual(raw, generateStage(route), `${route.id} generated source is reproducible`);
    assert.deepEqual(raw.layers.map(l => l.name), names);
    assert.equal(level.id, route.id); assert.equal(level.title, stageById(route.id).title);
    assert.equal(level.width, 4864); assert.equal(level.height, 768); assert.equal(level.tileSize, 32);
    assert.equal(level.spawn.x, 160); assert.equal(level.spawn.y, 640);
    assert.deepEqual(level.checkpoints.map(cp => [cp.id, cp.x, cp.y]),
      [['checkpoint-paw', 2176, 640], ['checkpoint-boss', 3590, 640]]);
    assert.equal(level.exits[0].properties.nextStage, route.next);
    assert.equal(level.exits[0].properties.requires, 'boss-defeated');
    const objects = raw.layers.flatMap(l => l.objects ?? []);
    assert.equal(new Set(objects.map(o => o.id)).size, objects.length);
    assert.equal(new Set(objects.map(o => o.name)).size, objects.length);
  }
});

test('every stage has an uninterrupted ordinary walking route and a flat unobstructed boss floor', () => {
  for (const { level } of maps.values()) {
    const floor = level.platforms.filter(p => p.kind === 'ground').sort((a,b) => a.x - b.x);
    let covered = 0;
    for (const solid of floor) {
      assert.equal(solid.y, 640); assert.equal(solid.oneWay, false);
      assert.ok(solid.x <= covered, `${level.id}: ground must not leave a mandatory pit`);
      covered = Math.max(covered, solid.x + solid.width);
    }
    assert.equal(covered, 4864);
    assert.ok(level.platforms.filter(p => p.kind === 'platform').every(p => p.oneWay));
    assert.ok(level.platforms.filter(p => p.kind === 'platform').every(p => p.x + p.width <= 3520));
    assert.equal(level.objects.length, 0, 'no keys, fruit walls, or interaction gates on the main path');
  }
});

test('all optional ledges are reachable using ordinary 96px-rise jumps and each route is distinct', () => {
  const layouts = new Set();
  for (const { level } of maps.values()) {
    const reached = new Set(level.platforms.filter(p => p.kind === 'ground'));
    for (let pass = 0; pass < level.platforms.length; pass++) {
      for (const next of level.platforms) {
        if (reached.has(next)) continue;
        for (const current of reached) {
          const rise = current.y - next.y;
          const gap = Math.max(0, next.x - (current.x + current.width), current.x - (next.x + next.width));
          if (rise <= 96 && gap <= 96) { reached.add(next); break; }
        }
      }
    }
    assert.equal(reached.size, level.platforms.length, `${level.id}: every upper ledge has a reachable approach`);
    for (const p of level.platforms) {
      assert.ok([p.x, p.y, p.width, p.height].every(n => n % 32 === 0));
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= level.width && p.y + p.height <= level.height);
    }
    layouts.add(JSON.stringify(level.platforms.map(p => [p.x, p.y, p.width])));
  }
  assert.equal(layouts.size, 6);
});

test('each map offers 24 fish, three reachable stars, and its unique environment markers', () => {
  const features = new Set();
  for (const { level } of maps.values()) {
    assert.equal(level.collectibles.filter(c => c.type === 'fish').length, 24);
    const stars = level.collectibles.filter(c => c.type === 'star');
    assert.equal(stars.length, 3);
    for (const star of stars) {
      assert.ok(level.platforms.some(p => p.oneWay && star.x >= p.x && star.x <= p.x + p.width && p.y - star.y <= 48 && p.y - star.y > 0));
    }
    features.add(level.triggers.find(t => t.type !== 'sign').type);
  }
  assert.equal(features.size, 6);
});

function environment(id) {
  const draw = () => {
    let item;
    item = new Proxy({ destroyed: false, destroy() { this.destroyed = true; } }, {
      get(target, key) { return key in target ? target[key] : () => item; },
    });
    return item;
  };
  const makeGroup = () => ({
    objects: [],
    add(zone) {
      zone.body = { checkCollision: {}, setSize() {}, updateFromGameObject() {} };
      this.objects.push(zone);
    },
    remove(zone) { this.objects = this.objects.filter(z => z !== zone); },
    clear() { this.objects = []; }, destroy() {},
  });
  const body = { velocity: { y: 0 }, gravityY: 0,
    setVelocityY(y) { this.velocity.y = y; }, setGravityY(y) { this.gravityY = y; }, updateFromGameObject() {},
  };
  let damage = 0;
  const scene = {
    mode: 'playing', player: { x: 160, y: 640, grounded: false, body }, combat: { fruit: null },
    add: { graphics: draw, text: draw, zone: (x,y,w,h) => ({ x,y,width:w,height:h }) },
    physics: { add: { staticGroup: makeGroup } }, sparkle() {}, notify() {},
    damage() { damage++; return true; },
  };
  const world = new StageWorld(scene, maps.get(id).level, stageById(id));
  const advance = ms => { for (let n = 0; n < ms; n += 50) world.update(0, Math.min(50, ms - n)); };
  return { world, scene, body, advance, damage: () => damage };
}

test('roof wind only lifts a jumping player and water buoyancy restores normal gravity on exit', () => {
  const roof = environment('rooftop');
  roof.scene.player.x = 880; roof.world.update(0, 16);
  assert.equal(roof.body.velocity.y, 0, 'walking underneath the optional lift remains possible');
  roof.scene.player.y = 590; roof.world.update(0, 16); assert.ok(roof.body.velocity.y < -200);
  const water = environment('basement');
  water.scene.player.x = 832; water.body.velocity.y = 300; water.world.update(0, 16);
  assert.equal(water.body.velocity.y, 95); assert.equal(water.body.gravityY, -360);
  water.scene.combat.fruit = 'water'; water.world.update(0, 16); assert.equal(water.body.gravityY, -560);
  water.scene.player.x = 160; water.world.update(0, 16); assert.equal(water.body.gravityY, 0);
});

test('electric cables give a long safe warning and allow elemental bypass or a jump', () => {
  for (const immunity of ['jump', 'earth', 'lightning', null]) {
    const { scene, advance, damage } = environment('parking');
    scene.player.x = 1150;
    if (immunity === 'jump') scene.player.y = 550;
    else scene.combat.fruit = immunity;
    advance(5300); assert.equal(damage(), 0);
    advance(550); assert.equal(damage(), immunity ? 0 : 1);
  }
});

test('earth opens only the upper optional rock wall, and drifting bubbles carry their rider', () => {
  const earth = environment('foundations');
  const count = earth.world.solids.objects.length;
  earth.scene.player.x = 3016; earth.scene.player.y = 640; earth.scene.combat.fruit = 'earth';
  earth.world.update(0, 16); assert.equal(earth.world.solids.objects.length, count);
  earth.scene.player.y = 384; earth.world.update(0, 16); assert.equal(earth.world.solids.objects.length, count - 1);
  earth.world.update(0, 16); assert.equal(earth.world.solids.objects.length, count - 1);
  const bubble = environment('floor13');
  const platform = bubble.world.oneWays.objects.find(p => p.width === 112);
  bubble.scene.player.x = platform.x; bubble.scene.player.y = platform.y - 8; bubble.scene.player.grounded = true;
  bubble.world.update(0, 16);
  assert.equal(bubble.scene.player.y, platform.y - 8);
  assert.ok(platform.y < 580);
});

test('space gravity is local, updates pause with the game, and world cleanup is repeatable', () => {
  const { world, scene, body, advance } = environment('nightark');
  scene.player.x = 704; world.update(0, 16); assert.equal(body.gravityY, -360);
  scene.player.x = 160; world.update(0, 16); assert.equal(body.gravityY, 0);
  scene.mode = 'paused'; scene.player.x = 704; advance(10000); assert.equal(body.gravityY, 0);
  scene.mode = 'playing'; world.update(0, 16); assert.equal(body.gravityY, -360);
  world.destroy(); world.destroy(); advance(10000); assert.equal(body.gravityY, 0);
});

test('stage shutdown remains safe when Phaser has already destroyed both collision groups', () => {
  const { world, scene, body, advance } = environment('nightark');
  scene.player.x = 704; world.update(0, 16);
  assert.equal(body.gravityY, -360);
  for (const group of [world.solids, world.oneWays]) {
    // Phaser's earlier shutdown hook removes children. clear() cannot tolerate that state,
    // while destroy() checks it before attempting to remove the remaining objects.
    group.children = undefined;
    group.clear = function () { this.children.entries.length = 0; };
    group.destroy = function () {
      if (!this.children) return;
      this.clear(); this.children = undefined;
    };
  }
  assert.doesNotThrow(() => world.destroy());
  assert.doesNotThrow(() => world.destroy());
  assert.doesNotThrow(() => advance(1000));
  assert.equal(body.gravityY, 0);
});
