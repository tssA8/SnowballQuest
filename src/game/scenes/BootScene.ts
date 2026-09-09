import Phaser from 'phaser';
import { preloadAssets, finishAssets } from '../art/AssetLoader';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    preloadAssets(this);
    this.load.json('home-map', 'assets/maps/home.json');
    this.load.tilemapTiledJSON('home-tilemap', 'assets/maps/home.json');
    this.load.on('loaderror', () => {
      const loading = document.getElementById('loading');
      if (loading) loading.textContent = 'The room could not load. Please refresh to try again.';
    });
  }
  create(): void { finishAssets(this); document.getElementById('loading')?.remove(); this.scene.start('Menu'); }
}
