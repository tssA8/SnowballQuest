import Phaser from 'phaser';
import manifest from '../../../public/assets/adventure/manifest.json';

/** Approved art, normalized for all seven adventures.
 * Combat uses edited source key poses; these are prototype animations, with
 * gameplay timing and layered effects supplied by the player/combat system.
 */
export const ADVENTURE_TEXTURES = {
  vacuum: 'enemy-vacuum', mouse: 'enemy-mouse', pigeon: 'enemy-pigeon', slime: 'enemy-slime',
  beetle: 'enemy-beetle', mole: 'enemy-mole', dragon: 'enemy-dragon', shadow: 'enemy-shadow',
  wrench: 'boss-wrench', galeplume: 'boss-galeplume', bobo: 'boss-bobo', volt: 'boss-volt',
  tato: 'boss-tato', bubble: 'boss-bubble', nightink: 'boss-nightink',
  combat: 'snowball-combat', fireFruit: 'fire-fruit',
  windFruit: 'fruit-wind', waterFruit: 'fruit-water', lightningFruit: 'fruit-lightning', earthFruit: 'fruit-earth',
  snowballPortrait: 'portrait-snowball', aiPortrait: 'portrait-ai',
  wrenchPortrait: 'portrait-wrench', wrenchBadge: 'badge-wrench', ship: 'ship-icon',
} as const;

type AnimationSpec = { frames: number[]; fps: number; repeat?: number };

/** Frame indices are stable and documented in adventure/manifest.json. */
export const ADVENTURE_COMBAT_ANIMATIONS: Record<string, AnimationSpec> = {
  'snowball-attack-1': { frames: [0, 1, 2, 2], fps: 16 },
  'snowball-attack-2': { frames: [1, 3, 3, 2], fps: 16 },
  'snowball-attack-3': { frames: [4, 5, 6, 7, 0], fps: 14 },
  'snowball-air-attack': { frames: [8, 9, 9], fps: 12 },
  'snowball-ground-pound': { frames: [10, 11, 12, 13], fps: 14 },
  'snowball-perfect-dodge': { frames: [14, 15, 16], fps: 18 },
  'snowball-counter': { frames: [16, 17, 17, 0], fps: 16 },
  'snowball-hurt': { frames: [18, 19], fps: 10 },
  'snowball-combat-ko': { frames: [19, 20, 21, 22], fps: 5 },
  'snowball-fruit-eat': { frames: [23, 24, 25], fps: 8 },
  'snowball-transform': { frames: [26, 27, 26, 27], fps: 12 },
};

/** Call inside scene.preload alongside the original preloadAssets. */
export function preloadAdventureAssets(scene: Phaser.Scene): void {
  for (const asset of manifest.assets) {
    if (scene.textures.exists(asset.key)) continue;
    const url = `assets/adventure/${asset.key}.png?v=${asset.sha256.slice(0, 12)}`;
    if ('frameSize' in asset && asset.frameSize) {
      scene.load.spritesheet(asset.key, url, {
        frameWidth: asset.frameSize, frameHeight: asset.frameSize,
      });
    } else {
      scene.load.image(asset.key, url);
    }
  }
}

function register(scene: Phaser.Scene, key: string, texture: string, spec: AnimationSpec): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: spec.frames.map(frame => ({ key: texture, frame })),
    frameRate: spec.fps,
    repeat: spec.repeat ?? 0,
  });
}

/** Call after loading. Validation is explicit: missing art must fail visibly. */
export function finishAdventureAssets(scene: Phaser.Scene): void {
  for (const asset of manifest.assets) {
    if (!scene.textures.exists(asset.key)) throw new Error(`Required adventure art did not load: ${asset.key}`);
    const texture = scene.textures.get(asset.key);
    const source = texture.source[0];
    if (source.width !== asset.width || source.height !== asset.height) {
      throw new Error(`Adventure art ${asset.key} must be ${asset.width} x ${asset.height}; received ${source.width} x ${source.height}`);
    }
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  for (const [key, spec] of Object.entries(ADVENTURE_COMBAT_ANIMATIONS)) {
    register(scene, key, ADVENTURE_TEXTURES.combat, spec);
  }
  for (const { key: texture } of manifest.assets.filter(asset => asset.key.startsWith('enemy-'))) {
    const specs: Record<string, AnimationSpec> = {
      idle: { frames: [0], fps: 4, repeat: -1 },
      move: { frames: [1, 2], fps: 8, repeat: -1 },
      attack: { frames: [0, 3, 3, 0], fps: 9 },
      hurt: { frames: [4], fps: 7 },
      defeated: { frames: [5], fps: 3 },
    };
    for (const [action, spec] of Object.entries(specs)) register(scene, `${texture}-${action}`, texture, spec);
  }
  const bossSpecs: Record<string, AnimationSpec> = {
    idle: { frames: [0], fps: 4, repeat: -1 },
    move: { frames: [0, 1], fps: 6, repeat: -1 },
    telegraph: { frames: [2], fps: 4 },
    'attack-a': { frames: [2, 3, 3, 0], fps: 8 },
    'attack-b': { frames: [2, 4, 4, 0], fps: 8 },
    special: { frames: [2, 5, 5, 0], fps: 7 },
    hurt: { frames: [6], fps: 6 },
    defeated: { frames: [7], fps: 3 },
  };
  for (const { key: texture } of manifest.assets.filter(asset => asset.key.startsWith('boss-'))) {
    for (const [action, spec] of Object.entries(bossSpecs)) register(scene, `${texture}-${action}`, texture, spec);
  }
}
