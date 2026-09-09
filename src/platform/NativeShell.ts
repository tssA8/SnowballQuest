import { App } from '@capacitor/app';
import { Capacitor, SystemBars, type PluginListenerHandle } from '@capacitor/core';
import type Phaser from 'phaser';
import type { HomeScene } from '../game/scenes/HomeScene';
import type { MenuScene } from '../game/scenes/MenuScene';
import { audio, flushSave } from '../game/services';

export async function installNativeShell(game: Phaser.Game): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const listeners: PluginListenerHandle[] = [];
  let destroyed = false;
  const home = (): HomeScene | undefined => game.scene.isActive('Home')
    ? game.scene.getScene('Home') as HomeScene : undefined;

  const active = (isActive: boolean): void => {
    audio.setAppActive(isActive);
    if (!isActive) {
      const scene = home();
      scene?.pause(); scene?.controls.clear(); scene?.persist();
      void flushSave();
    } else {
      // The player explicitly resumes; never move or skip a dialogue on foreground.
      requestAnimationFrame(() => { if (game.isBooted) game.scale.refresh(); });
      void SystemBars.hide().catch(() => undefined);
    }
  };
  const back = async (): Promise<void> => {
    const scene = home();
    if (scene) {
      if (scene.mode === 'complete') scene.menu();
      else scene.togglePause();
      await flushSave();
      return;
    }
    if (game.scene.isActive('Menu')) {
      const menu = game.scene.getScene('Menu') as MenuScene;
      if (menu.handleBack()) return;
    }
    await flushSave();
    await App.minimizeApp();
  };

  game.events.once('destroy', () => {
    destroyed = true;
    for (const listener of listeners) void listener.remove();
  });
  const retain = async (promise: Promise<PluginListenerHandle>): Promise<void> => {
    const listener = await promise;
    if (destroyed) await listener.remove(); else listeners.push(listener);
  };
  await retain(App.addListener('pause', () => active(false)));
  await retain(App.addListener('resume', () => active(true)));
  await retain(App.addListener('appStateChange', state => active(state.isActive)));
  if (Capacitor.getPlatform() === 'android') {
    await retain(App.addListener('backButton', () => { void back().catch(() => undefined); }));
  }
  const state = await App.getState();
  if (!destroyed) active(state.isActive);
}
