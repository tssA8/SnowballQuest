import Phaser from 'phaser';
import manifest from '../../../public/assets/manifest.json';
import { registerAnimations } from './Textures';

/** Production asset boundary: exported PNGs own the visuals used by the game.
 * Replace a file at its manifest path while preserving its dimensions/frames.
 * Original code drawings only run through scripts/export-assets.mjs.
 */
export function preloadAssets(scene: Phaser.Scene): void {
  for (const asset of manifest.textures) {
    const url = `assets/${asset.path}`;
    if (asset.key === 'snowball') {
      scene.load.spritesheet(asset.key, url, { frameWidth: 64, frameHeight: 64 });
    } else {
      scene.load.image(asset.key, url);
    }
  }
}

/** Fail visibly for missing/broken files; never mask an export issue with fallback art. */
export function finishAssets(scene: Phaser.Scene): void {
  for (const asset of manifest.textures) {
    if (!scene.textures.exists(asset.key)) throw new Error(`Required asset did not load: assets/${asset.path}`);
    const texture = scene.textures.get(asset.key);
    const source = texture.source[0];
    if (source.width !== asset.width || source.height !== asset.height) {
      throw new Error(`Asset ${asset.key} must be ${asset.width} × ${asset.height}; received ${source.width} × ${source.height}. Update its export and manifest together.`);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  registerAnimations(scene);
}
