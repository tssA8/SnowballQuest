import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { NativeSaveStorage } from '../platform/NativeSaveStorage';
import { SaveSystem, SAVE_KEY } from './systems/SaveSystem';
import { AudioSystem } from './systems/AudioSystem';
export let save = new SaveSystem();
export const audio = new AudioSystem(save.data.settings);
let nativeStorage: NativeSaveStorage | undefined;

export async function initializeServices(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  let fallback: Storage | undefined;
  try { fallback = globalThis.localStorage; } catch { /* Preferences remains available. */ }
  try {
    nativeStorage = await NativeSaveStorage.open(Preferences, SAVE_KEY, fallback);
    save = new SaveSystem(nativeStorage);
    save.save();
    await nativeStorage.flush();
  } catch {
    // Keep the local save if native storage cannot be read; do not overwrite it.
    nativeStorage = NativeSaveStorage.recover(SAVE_KEY, fallback);
    save = new SaveSystem(nativeStorage);
    console.warn('Native save unavailable; using this device’s local recovery save.');
  }
  audio.setSettings(save.data.settings);
}

export async function flushSave(): Promise<void> { await nativeStorage?.flush(); }
