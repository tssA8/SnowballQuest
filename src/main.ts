import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { HomeScene } from './game/scenes/HomeScene';
import { HUDScene } from './game/scenes/HUDScene';

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 1280, height: 720,
  backgroundColor: '#e6d5b7', pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
  input: { activePointers: 4, touch: { capture: false } }, render: { antialias: false },
  scene: [BootScene, MenuScene, HomeScene, HUDScene],
});
// CSS changes the frame after an orientation event; measure the settled parent first.
const parent = document.getElementById('game');
let lastWidth = 0, lastHeight = 0, resizeFrame = 0;
const resizeObserver = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  if (width === lastWidth && height === lastHeight) return;
  lastWidth = width; lastHeight = height;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (game.isBooted) { game.scale.getParentBounds(); game.scale.refresh(); }
  });
});
if (parent) resizeObserver.observe(parent);
game.events.once('destroy', () => { resizeObserver.disconnect(); cancelAnimationFrame(resizeFrame); });
// Read-only browser-test access is excluded from production builds.
if (import.meta.env.DEV) (window as unknown as { __snowball: Phaser.Game }).__snowball = game;
