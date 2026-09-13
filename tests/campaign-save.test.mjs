import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/game/systems/SaveSystem.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SaveSystem, SAVE_KEY, validateSave } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const stages = ['home', 'rooftop', 'basement', 'parking', 'foundations', 'floor13', 'nightark'];
const emptyResult = { fish: 0, stars: 0, secrets: 0, time: 10000 };

function memory(initial) {
  const entries = new Map(initial ? [[SAVE_KEY, JSON.stringify(initial)]] : []);
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); },
    removeItem(key) { entries.delete(key); },
  };
}

test('v1 Wrench migration preserves home progress and retired-stage history without granting later bosses', () => {
  const migrated = validateSave({
    version: 1, currentStage: 'home', adventure: { wrenchJoined: true, fireUnlocked: true, attackBonus: .1 },
    unlockedStages: ['home', 'cafe', 'garden', 'ending'],
    stages: { home: { completed: true, fish: 28, stars: 2, bestTime: 100000 },
      cafe: { completed: true, fish: 14, stars: 3, bestTime: 200000 }, garden: { completed: true, fish: 11 } },
    settings: { music: .1, sfx: .4, reducedMotion: true },
    run: { checkpoint: { id: 'checkpoint-boss', x: 3590, y: 640 }, collected: ['fish-01'],
      flags: { 'fire-trial': true }, hearts: 3, elapsed: 32100 },
  });
  assert.equal(migrated.version, 2); assert.equal(migrated.currentStage, 'home');
  assert.deepEqual(migrated.unlockedStages, ['home', 'rooftop']);
  assert.deepEqual(migrated.bossBadges, ['home']); assert.deepEqual(migrated.unlockedFruits, ['fire']);
  assert.deepEqual(migrated.unlockedSupport, ['home']);
  assert.equal(migrated.stages.home.fish, 28); assert.equal(migrated.legacyStages.cafe.stars, 3);
  assert.equal(migrated.legacyStages.garden.completed, true); assert.equal(migrated.stages.cafe, undefined);
  assert.equal(migrated.run.hearts, 3); assert.equal(migrated.run.elapsed, 32100);
  assert.equal(migrated.run.flags['fire-trial'], true); assert.equal(migrated.settings.reducedMotion, true);
});

test('retired or locked current stages recover to a fresh unlocked run without copying victory flags', () => {
  for (const [version, currentStage] of [[1, 'cafe'], [1, 'garden'], [2, 'nightark']]) {
    const migrated = validateSave({ version, currentStage, bossBadges: ['home'],
      adventure: { wrenchJoined: true },
      run: { checkpoint: { id: 'checkpoint-boss', x: 3590, y: 640 }, collected: ['fish-old-01'],
        flags: { 'boss-defeated': true, 'stage-complete': true }, hearts: 1, elapsed: 44400 } });
    assert.ok(migrated.unlockedStages.includes(migrated.currentStage));
    assert.deepEqual(migrated.run.flags, {}, `${version}/${currentStage}: old victory flags cannot clear a different stage`);
    assert.deepEqual(migrated.run.collected, []);
    assert.equal(migrated.run.checkpoint.id, 'start'); assert.equal(migrated.run.elapsed, 0);
    assert.equal(migrated.run.hearts, migrated.maxHearts);
    assert.deepEqual(migrated.bossBadges, ['home']);
  }
});

test('all seven stages unlock in sequence solely from boss victories with zero optional collectibles', () => {
  const storage = memory(), saves = new SaveSystem(storage);
  for (const [index, id] of stages.entries()) {
    assert.equal(saves.startStage(id), true, `${id} is unlocked when its turn arrives`);
    if (index + 1 < stages.length) assert.equal(saves.startStage(stages[index + 1]), false);
    saves.completeStage(emptyResult, id);
    if (index + 1 < stages.length) assert.equal(saves.startStage(stages[index + 1]), false, 'scores alone do not grant boss rewards');
    saves.completeAdventure(id);
    assert.deepEqual(saves.data.unlockedStages, stages.slice(0, Math.min(index + 2, stages.length)));
    assert.equal(saves.data.stages[id].completed, true);
    assert.equal(saves.data.stages[id].fish, 0); assert.equal(saves.data.stages[id].stars, 0);
  }
  const restored = new SaveSystem(storage);
  assert.equal(restored.data.currentStage, 'nightark');
  assert.deepEqual(restored.data.bossBadges, stages);
  assert.deepEqual(restored.data.unlockedSupport, stages);
  assert.deepEqual(restored.data.unlockedFruits, ['fire', 'wind', 'water', 'lightning', 'earth']);
  assert.equal(restored.data.maxHearts, 6); assert.equal(restored.data.maxPurrEnergy, 120);
  assert.equal(restored.data.adventure.attackBonus, .1);
});

test('startStage clears only the old run and prevents boss/fruit-trial flags from leaking across stages', () => {
  const storage = memory(), saves = new SaveSystem(storage);
  saves.completeAdventure('home'); saves.completeStage(emptyResult, 'home');
  saves.setFlag('boss-defeated'); saves.setFlag('boss-wrench-defeated'); saves.setFlag('fire-trial');
  saves.collect('fish-01'); saves.updateRun({ elapsed: 60000, hearts: 2,
    checkpoint: { id: 'checkpoint-boss', x: 3590, y: 640 } });
  saves.setSettings({ music: .17, sfx: .38 });
  assert.equal(saves.startStage('rooftop'), true);
  const restored = new SaveSystem(storage);
  assert.equal(restored.data.currentStage, 'rooftop'); assert.deepEqual(restored.data.run.flags, {});
  assert.deepEqual(restored.data.run.collected, []); assert.equal(restored.data.run.elapsed, 0);
  assert.deepEqual(restored.data.run.checkpoint, { id: 'start', x: 160, y: 640 });
  assert.deepEqual(restored.data.unlockedFruits, ['fire']); assert.equal(restored.data.stages.home.completed, true);
  assert.equal(restored.data.settings.music, .17);
  const before = structuredClone(restored.data);
  assert.equal(restored.startStage('nightark'), false); assert.equal(restored.startStage('unknown'), false);
  assert.deepEqual(restored.data, before, 'a locked destination must not discard current progress');
});

test('checkpoint retries preserve the current trial, while a full replay resets its run and refills upgraded health', () => {
  const saves = new SaveSystem(memory());
  for (const id of stages.slice(0, 4)) saves.completeAdventure(id);
  assert.equal(saves.startStage('foundations'), true);
  assert.equal(saves.data.run.hearts, 6);
  saves.setFlag('fruit-trial-earth'); saves.collect('fish-foundations-01');
  saves.updateRun({ hearts: 1, elapsed: 51000, checkpoint: { id: 'checkpoint-boss', x: 3590, y: 640 } });
  saves.updateRun({ hearts: saves.data.maxHearts });
  assert.equal(saves.data.currentStage, 'foundations'); assert.equal(saves.data.run.flags['fruit-trial-earth'], true);
  assert.equal(saves.data.run.elapsed, 51000); assert.deepEqual(saves.data.run.collected, ['fish-foundations-01']);
  saves.resetRun();
  assert.equal(saves.data.currentStage, 'foundations'); assert.equal(saves.data.run.hearts, 6);
  assert.deepEqual(saves.data.run.flags, {}); assert.deepEqual(saves.data.run.collected, []);
  assert.deepEqual(saves.data.unlockedFruits, ['fire', 'wind', 'water', 'lightning']);
  assert.equal(saves.data.maxPurrEnergy, 120);
});

test('repeated victories and free patrol retain all companions without multiplying rewards', () => {
  const saves = new SaveSystem(memory());
  for (const id of stages) { saves.completeAdventure(id); saves.completeAdventure(id); }
  assert.equal(saves.startStage('home'), true);
  saves.completeAdventure('home'); saves.resetRun();
  assert.deepEqual(saves.data.bossBadges, stages); assert.equal(saves.data.unlockedSupport.length, 7);
  assert.equal(saves.data.unlockedFruits.length, 5); assert.equal(saves.data.adventure.attackBonus, .1);
  assert.equal(saves.data.run.hearts, 6); assert.equal(saves.data.maxPurrEnergy, 120);
  saves.updateRun({ hearts: 999 }); assert.equal(saves.data.run.hearts, 6);
  const badges = [...saves.data.bossBadges]; saves.completeAdventure('not-a-stage');
  assert.deepEqual(saves.data.bossBadges, badges);
});

test('later-stage records update their own score and preserve the home record', () => {
  const saves = new SaveSystem(memory());
  saves.completeAdventure('home'); saves.completeStage({ fish: 28, stars: 2, secrets: 3, time: 120000 }, 'home');
  saves.startStage('rooftop'); saves.completeStage({ fish: 10, stars: 1, secrets: 0, time: 90000 }, 'rooftop');
  saves.completeStage({ fish: 24, stars: 3, secrets: 0, time: 110000 }, 'rooftop');
  assert.deepEqual(saves.data.stages.home, { completed: true, fish: 28, stars: 2, secrets: 3, bestTime: 120000 });
  assert.deepEqual(saves.data.stages.rooftop, { completed: true, fish: 24, stars: 3, secrets: 0, bestTime: 90000 });
});
