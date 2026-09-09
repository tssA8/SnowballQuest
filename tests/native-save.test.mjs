import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeSaveStorage } from '../src/platform/NativeSaveStorage.ts';

const key = 'snowball-quest-save-v1';
const fallback = value => ({ getItem: () => value, setItem() {}, removeItem() {} });
const remote = overrides => ({ get: async () => ({ value: null }), set: async () => {}, remove: async () => {}, ...overrides });
const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};

test('native load completes before the stored run can be read', async () => {
  let resolve;
  const loaded = NativeSaveStorage.open(remote({ get: () => new Promise(r => { resolve = r; }) }), key);
  let ready = false;
  void loaded.then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  resolve({ value: 'existing-native-run' });
  assert.equal((await loaded).getItem(key), 'existing-native-run');
});

test('native save wins over a stale local copy, missing native save uses local recovery', async () => {
  const old = fallback('local');
  const native = await NativeSaveStorage.open(remote({ get: async () => ({ value: 'native' }) }), key, old);
  assert.equal(native.getItem(key), 'native');
  const migrated = await NativeSaveStorage.open(remote(), key, old);
  assert.equal(migrated.getItem(key), 'local');
});

test('a failed native read does not overwrite an unread save', async () => {
  let writes = 0;
  await assert.rejects(NativeSaveStorage.open(remote({
    get: async () => { throw new Error('temporarily unavailable'); },
    set: async () => { writes++; },
  }), key, fallback('local')));
  assert.equal(writes, 0);
});

test('rapid saves are persisted in order even when the first write is delayed', async () => {
  const calls = [];
  let finishFirst;
  const storage = await NativeSaveStorage.open(remote({ set: async ({ value }) => {
    calls.push(value);
    if (value === 'first') await new Promise(resolve => { finishFirst = resolve; });
  } }), key);
  storage.setItem(key, 'first');
  storage.setItem(key, 'last');
  await Promise.resolve();
  assert.deepEqual(calls, ['first']);
  assert.equal(storage.getItem(key), 'last');
  finishFirst();
  assert.equal(await storage.flush(), true);
  assert.deepEqual(calls, ['first', 'last']);
});

test('write failure preserves the recovery copy and does not block the next save', async () => {
  let recovery;
  let count = 0;
  const storage = await NativeSaveStorage.open(remote({ set: async () => {
    if (++count === 1) throw new Error('write failed');
  } }), key, { ...fallback(null), setItem: (_key, value) => { recovery = value; } });
  storage.setItem(key, 'first');
  assert.equal(await storage.flush(), false);
  assert.equal(recovery, 'first');
  storage.setItem(key, 'recovered');
  assert.equal(await storage.flush(), true);
  assert.equal(recovery, 'recovered');
});

test('removing a saved run happens after queued writes', async () => {
  const calls = [];
  const storage = await NativeSaveStorage.open(remote({
    set: async () => { calls.push('set'); }, remove: async () => { calls.push('remove'); },
  }), key);
  storage.setItem(key, 'run');
  storage.removeItem(key);
  assert.equal(storage.getItem(key), null);
  await storage.flush();
  assert.deepEqual(calls, ['set', 'remove']);
});

test('relaunch recovers the latest snapshot after a failed final native write', async () => {
  const local = memory();
  const native = remote({ get: async () => ({ value: 'old' }), set: async () => { throw new Error('disk unavailable'); } });
  const storage = await NativeSaveStorage.open(native, key, local);
  storage.setItem(key, 'new-star');
  assert.equal(await storage.flush(), false);
  assert.equal((await NativeSaveStorage.open(native, key, local)).getItem(key), 'new-star');
});

test('progress made while native reads fail is recovered after a restart', async () => {
  const local = memory();
  local.setItem(key, 'local-checkpoint');
  const recovery = NativeSaveStorage.recover(key, local);
  recovery.setItem(key, 'new-progress');
  assert.equal(await recovery.flush(), false);
  const restored = await NativeSaveStorage.open(remote({ get: async () => ({ value: 'old-native' }) }), key, local);
  assert.equal(restored.getItem(key), 'new-progress');
});

test('an earlier successful write cannot clear a newer pending recovery snapshot', async () => {
  const local = memory();
  let release;
  const storage = await NativeSaveStorage.open(remote({ set: async ({ value }) => {
    if (value === 'first') await new Promise(resolve => { release = resolve; });
    else throw new Error('newer write fails');
  } }), key, local);
  storage.setItem(key, 'first');
  storage.setItem(key, 'latest');
  await Promise.resolve(); release(); await storage.flush();
  assert.equal(JSON.parse(local.getItem(`${key}:native-pending`)).value, 'latest');
});

test('committed writes clear the pending marker and preserve native priority', async () => {
  const local = memory();
  const storage = await NativeSaveStorage.open(remote(), key, local);
  storage.setItem(key, 'committed');
  await storage.flush();
  assert.equal(local.getItem(`${key}:native-pending`), null);
  const restored = await NativeSaveStorage.open(remote({ get: async () => ({ value: 'native-authority' }) }), key, local);
  assert.equal(restored.getItem(key), 'native-authority');
});

test('A to B to A writes retain the final pending A if only the first two commit', async () => {
  const local = memory();
  let saved = 'old';
  let writes = 0;
  const native = remote({
    get: async () => ({ value: saved }),
    set: async ({ value }) => { if (++writes === 3) throw new Error('interrupted'); saved = value; },
  });
  const storage = await NativeSaveStorage.open(native, key, local);
  storage.setItem(key, 'A'); storage.setItem(key, 'B'); storage.setItem(key, 'A');
  assert.equal(await storage.flush(), false);
  assert.equal(saved, 'B');
  assert.equal((await NativeSaveStorage.open(native, key, local)).getItem(key), 'A');
});
