import Phaser from 'phaser';
import { preloadAssets, finishAssets } from '../art/AssetLoader';
import { STAGES } from '../data/stages';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload(): void {
    preloadAssets(this);
    for (const stage of STAGES) this.load.json(`${stage.id}-map`, `assets/maps/${stage.id}.json`);
    this.load.tilemapTiledJSON('home-tilemap', 'assets/maps/home.json');
    this.load.on('loaderror', () => {
      const loading = document.getElementById('loading');
      if (loading) loading.textContent = 'The room could not load. Please refresh to try again.';
    });
  }
  create(): void { finishAssets(this); document.getElementById('loading')?.remove(); this.scene.start('Menu'); }
}
