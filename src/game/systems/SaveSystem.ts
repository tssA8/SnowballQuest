export interface GameSettings {
  music: number;
  sfx: number;
  reducedMotion: boolean;
}

export interface CheckpointSave { x: number; y: number; id: string }
export interface RunSave {
  checkpoint: CheckpointSave;
  collected: string[];
  flags: Record<string, boolean>;
  hearts: number;
  /** Active play time, in milliseconds. */
  elapsed: number;
}
export interface StageRecord {
  completed: boolean;
  fish: number;
  stars: number;
  secrets: number;
  /** Fastest completed run, in milliseconds. */
  bestTime?: number;
}
export interface StageResult { fish: number; stars: number; secrets: number; time: number }
export interface SaveData {
  version: 1;
  currentStage: string;
  unlockedStages: string[];
  stages: Record<string, StageRecord>;
  settings: GameSettings;
  run: RunSave;
}

export const SAVE_KEY = 'snowball-quest-save-v1';
const KNOWN_STAGES = ['home', 'rooftop', 'cafe', 'garden', 'ending'];
const DEFAULT_CHECKPOINT: CheckpointSave = { x: 160, y: 640, id: 'start' };
const MAX_TIME = 86400000;
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value)) : fallback;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,100}$/.test(value) && !unsafeKeys.has(value);
}
function freshRun(checkpoint: CheckpointSave = DEFAULT_CHECKPOINT): RunSave {
  return { checkpoint: { ...checkpoint }, collected: [], flags: {}, hearts: 5, elapsed: 0 };
}
export function createDefaultSave(): SaveData {
  return {
    version: 1, currentStage: 'home', unlockedStages: ['home'], stages: {},
    settings: { music: 0.25, sfx: 0.65, reducedMotion: false }, run: freshRun(),
  };
}

/** Validate both loaded JSON and caller-provided updates before they reach gameplay. */
export function validateSave(value: unknown): SaveData {
  const defaults = createDefaultSave();
  const source = record(value);
  if (source.version !== 1) return defaults;
  const settings = record(source.settings);
  defaults.settings = {
    music: bounded(settings.music, 0.25, 0, 1),
    sfx: bounded(settings.sfx, 0.65, 0, 1),
    reducedMotion: settings.reducedMotion === true,
  };
  if (typeof source.currentStage === 'string' && KNOWN_STAGES.includes(source.currentStage)) {
    defaults.currentStage = source.currentStage;
  }
  if (Array.isArray(source.unlockedStages)) {
    defaults.unlockedStages = [...new Set(['home', ...source.unlockedStages.filter(
      (stage): stage is string => typeof stage === 'string' && KNOWN_STAGES.includes(stage))])];
  }
  for (const [id, rawResult] of Object.entries(record(source.stages))) {
    if (!KNOWN_STAGES.includes(id)) continue;
    const result = record(rawResult);
    const stage: StageRecord = {
      completed: result.completed === true,
      fish: Math.floor(bounded(result.fish, 0, 0, 100000)),
      stars: Math.floor(bounded(result.stars, 0, 0, 3)),
      secrets: Math.floor(bounded(result.secrets, 0, 0, 100)),
    };
    if (typeof result.bestTime === 'number' && Number.isFinite(result.bestTime) && result.bestTime > 0) {
      stage.bestTime = bounded(result.bestTime, MAX_TIME, 1, MAX_TIME);
    }
    defaults.stages[id] = stage;
  }
  const run = record(source.run);
  const checkpoint = record(run.checkpoint);
  const flags: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(record(run.flags)).slice(0, 300)) {
    if (identifier(key) && typeof flag === 'boolean') flags[key] = flag;
  }
  defaults.run = {
    checkpoint: {
      x: bounded(checkpoint.x, DEFAULT_CHECKPOINT.x, 16, 16000),
      y: bounded(checkpoint.y, DEFAULT_CHECKPOINT.y, 16, 2000),
      id: identifier(checkpoint.id) ? checkpoint.id : DEFAULT_CHECKPOINT.id,
    },
    collected: Array.isArray(run.collected) ? [...new Set(run.collected.filter(identifier))].slice(0, 2000) : [],
    flags,
    hearts: Math.floor(bounded(run.hearts, 5, 0, 5)),
    elapsed: bounded(run.elapsed, 0, 0, MAX_TIME),
  };
  return defaults;
}

/** Storage failures never prevent play; callers retain the same validated in-memory save. */
export class SaveSystem {
  data: SaveData = createDefaultSave();
  available = true;
  private readonly storage: StorageAccess | undefined;

  constructor(storage?: StorageAccess | null) {
    try {
      this.storage = storage === null ? undefined : storage ?? globalThis.localStorage;
    } catch {
      this.storage = undefined;
      this.available = false;
    }
    if (!this.storage) this.available = false;
    this.load();
  }

  load(): SaveData {
    let stored: string | null | undefined;
    try {
      stored = this.storage?.getItem(SAVE_KEY);
    } catch {
      this.available = false;
      this.data = createDefaultSave();
      return this.data;
    }
    try {
      this.data = stored ? validateSave(JSON.parse(stored) as unknown) : createDefaultSave();
    } catch {
      // Corrupt JSON does not imply storage itself is unavailable.
      this.data = createDefaultSave();
    }
    return this.data;
  }

  save(): boolean {
    this.data = validateSave(this.data);
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  resetRun(checkpoint: CheckpointSave = DEFAULT_CHECKPOINT): void {
    this.data.currentStage = 'home';
    this.data.run = freshRun(checkpoint);
    this.save();
  }

  updateRun(update: Partial<RunSave>): void {
    this.data.run = { ...this.data.run, ...update };
    this.save();
  }

  setFlag(id: string, done = true): void {
    if (!identifier(id)) return;
    this.data.run.flags[id] = done;
    this.save();
  }

  collect(id: string): boolean {
    if (!identifier(id) || this.data.run.collected.includes(id)) return false;
    this.data.run.collected.push(id);
    this.save();
    return true;
  }

  setSettings(settings: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }

  completeStage(result: StageResult, stageId = 'home'): void {
    if (!KNOWN_STAGES.includes(stageId)) return;
    const old = this.data.stages[stageId];
    const time = bounded(result.time, MAX_TIME, 1, MAX_TIME);
    this.data.stages[stageId] = {
      completed: true,
      fish: Math.max(old?.fish ?? 0, bounded(result.fish, 0, 0, 100000)),
      stars: Math.max(old?.stars ?? 0, bounded(result.stars, 0, 0, 3)),
      secrets: Math.max(old?.secrets ?? 0, bounded(result.secrets, 0, 0, 100)),
      bestTime: Math.min(old?.bestTime ?? Infinity, time),
    };
    this.data.run.flags['stage-complete'] = true;
    // Later stages remain explicitly locked until they are implemented.
    this.save();
  }
}
