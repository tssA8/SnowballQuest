export interface PreferencesStore {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Synchronous game reads, ordered native writes, and a local recovery copy. */
export class NativeSaveStorage {
  private values = new Map<string, string>();
  private writes: Promise<void> = Promise.resolve();
  private writeId = 0;
  available = true;
  private remote?: PreferencesStore;
  private fallback?: LocalStore;

  private constructor(remote: PreferencesStore | undefined, fallback?: LocalStore) {
    this.remote = remote;
    this.fallback = fallback;
  }

  static async open(remote: PreferencesStore, key: string, fallback?: LocalStore): Promise<NativeSaveStorage> {
    // Let a read failure reject: never overwrite an unread native save with defaults.
    const stored = await remote.get({ key });
    const adapter = new NativeSaveStorage(remote, fallback);
    let value = stored.value;
    if (value === null) {
      try { value = fallback?.getItem(key) ?? null; } catch { /* Native storage still works. */ }
    }
    value = adapter.pendingValue(key, value);
    if (value !== null) adapter.values.set(key, value);
    return adapter;
  }

  static recover(key: string, fallback?: LocalStore): NativeSaveStorage {
    // Read failures use the recovery copy, but never write to an unread native store.
    const adapter = new NativeSaveStorage(undefined, fallback);
    adapter.available = false;
    let value: string | null = null;
    try { value = fallback?.getItem(key) ?? null; } catch { /* Continue in memory. */ }
    value = adapter.pendingValue(key, value);
    if (value !== null) adapter.values.set(key, value);
    return adapter;
  }

  private pendingValue(key: string, fallback: string | null): string | null {
    try {
      const raw = this.fallback?.getItem(`${key}:native-pending`);
      if (raw) {
        const pending: unknown = JSON.parse(raw);
        if (pending && typeof pending === 'object' && 'value' in pending &&
            (pending.value === null || typeof pending.value === 'string')) return pending.value;
      }
    } catch { /* Ignore invalid recovery metadata. */ }
    return fallback;
  }

  private markPending(key: string, value: string | null): string {
    const marker = JSON.stringify({ value, writeId: ++this.writeId });
    try { this.fallback?.setItem(`${key}:native-pending`, marker); } catch { /* Native save remains available. */ }
    return marker;
  }

  private clearPending(key: string, marker: string): void {
    try {
      if (this.fallback?.getItem(`${key}:native-pending`) === marker) this.fallback.removeItem(`${key}:native-pending`);
    } catch { /* Replaying an already committed snapshot is safe. */ }
  }

  getItem(key: string): string | null { return this.values.get(key) ?? null; }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    const marker = this.markPending(key, value);
    try { this.fallback?.setItem(key, value); } catch { /* Recovery copy is optional. */ }
    // Capture the immutable value now; later saves cannot change this queued write.
    if (this.remote) this.enqueue(async () => { await this.remote!.set({ key, value }); this.clearPending(key, marker); });
  }

  removeItem(key: string): void {
    this.values.delete(key);
    const marker = this.markPending(key, null);
    try { this.fallback?.removeItem(key); } catch { /* Recovery copy is optional. */ }
    if (this.remote) this.enqueue(async () => { await this.remote!.remove({ key }); this.clearPending(key, marker); });
  }

  private enqueue(write: () => Promise<void>): void {
    this.writes = this.writes.then(write).then(
      () => { this.available = true; },
      () => { this.available = false; },
    );
  }

  async flush(): Promise<boolean> { await this.writes; return this.available; }
}
