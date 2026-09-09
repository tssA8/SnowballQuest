import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/game/systems/SaveSystem.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { SaveSystem, SAVE_KEY, validateSave, createDefaultSave } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function memoryStorage(initial) {
  const entries = new Map(initial ? [[SAVE_KEY, initial]] : []);
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, value); },
    removeItem(key) { entries.delete(key); },
  };
}

test('refresh restores unique collected objects, checkpoint, quests, and settings', () => {
  const storage = memoryStorage();
  const first = new SaveSystem(storage);
  assert.equal(first.collect('fish-01'), true);
  assert.equal(first.collect('fish-01'), false);
  first.setFlag('mouse-helped');
  first.updateRun({ checkpoint: { x: 2300, y: 640, id: 'paw-01' }, hearts: 3, elapsed: 37000 });
  first.setSettings({ music: 0, reducedMotion: true });
  const restored = new SaveSystem(storage);
  assert.deepEqual(restored.data.run.collected, ['fish-01']);
  assert.equal(restored.data.run.flags['mouse-helped'], true);
  assert.deepEqual(restored.data.run.checkpoint, { x: 2300, y: 640, id: 'paw-01' });
  assert.equal(restored.data.run.hearts, 3);
  assert.equal(restored.data.run.elapsed, 37000);
  assert.equal(restored.data.settings.music, 0);
  assert.equal(restored.data.settings.reducedMotion, true);
});

test('replays preserve best results and settings without preserving completed quests', () => {
  const saves = new SaveSystem(memoryStorage());
  saves.completeStage({ fish: 22, stars: 3, secrets: 2, time: 230000 });
  saves.setSettings({ sfx: 0.2 });
  saves.resetRun();
  assert.equal(saves.data.run.flags['stage-complete'], undefined);
  assert.equal(saves.data.settings.sfx, 0.2);
  saves.completeStage({ fish: 8, stars: 1, secrets: 1, time: 310000 });
  assert.deepEqual(saves.data.stages.home, {
    completed: true, fish: 22, stars: 3, secrets: 2, bestTime: 230000,
  });
  saves.completeStage({ fish: 24, stars: 2, secrets: 3, time: 200000 });
  assert.deepEqual(saves.data.stages.home, {
    completed: true, fish: 24, stars: 3, secrets: 3, bestTime: 200000,
  });
  assert.deepEqual(saves.data.unlockedStages, ['home']);
});

test('corrupt JSON and unsupported schema versions fall back to playable defaults', () => {
  assert.deepEqual(new SaveSystem(memoryStorage('{broken')).data, createDefaultSave());
  assert.deepEqual(validateSave({ version: 99, run: { hearts: -10 } }), createDefaultSave());
});

test('save validation rejects invalid IDs, inherited-object keys, and nonfinite coordinates', () => {
  const input = JSON.parse('{"version":1,"run":{"flags":{"__proto__":true,"constructor":true,"key-found":true},"collected":["fish-01","fish-01","constructor",3],"checkpoint":{"x":null,"y":-500,"id":"bad id"},"hearts":50,"elapsed":-20},"settings":{"music":8,"sfx":-5}}');
  const validated = validateSave(input);
  assert.deepEqual(validated.run.flags, { 'key-found': true });
  assert.deepEqual(validated.run.collected, ['fish-01']);
  assert.equal(validated.run.hearts, 5);
  assert.equal(validated.run.elapsed, 0);
  assert.equal(validated.run.checkpoint.x, 160);
  assert.equal(validated.run.checkpoint.y, 16);
  assert.equal(validated.run.checkpoint.id, 'start');
  assert.equal(validated.settings.music, 1);
  assert.equal(validated.settings.sfx, 0);
});

test('unavailable or full localStorage never prevents in-memory gameplay progress', () => {
  const unavailable = new SaveSystem(null);
  assert.equal(unavailable.available, false);
  unavailable.collect('fish-01');
  assert.deepEqual(unavailable.data.run.collected, ['fish-01']);
  const full = new SaveSystem({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() {},
  });
  assert.equal(full.available, false);
  full.setFlag('key-found');
  assert.equal(full.available, false);
  assert.equal(full.data.run.flags['key-found'], true);
  assert.equal(full.save(), false);
});
