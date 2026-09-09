import Phaser from 'phaser';

export const INK = '#53443f';
export const CREAM = '#fff0d5';
export function text(scene: Phaser.Scene, x: number, y: number, value: string, size = 16, color = INK): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, { fontFamily: 'Courier New, monospace', fontSize: `${size}px`, color, fontStyle: 'bold', lineSpacing: 7 });
}
export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color = 0xffefd2, alpha = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x443934, .2).fillRoundedRect(x + 5, y + 7, width, height, 8);
  g.fillStyle(color, alpha).fillRoundedRect(x, y, width, height, 8);
  g.lineStyle(2, 0x8c6d58, .7).strokeRoundedRect(x, y, width, height, 8);
  g.lineStyle(1, 0xfff7e5, .6).strokeRoundedRect(x + 5, y + 5, width - 10, height - 10, 4);
  return g;
}
export function button(scene: Phaser.Scene, x: number, y: number, label: string, action: () => void, width = 230, primary = true): Phaser.GameObjects.Container {
  const base = scene.add.rectangle(0, 0, width, 52, primary ? 0xad6957 : 0xe9d9ba).setStrokeStyle(2, primary ? 0x764e45 : 0xbaa286);
  const labelText = text(scene, 0, 0, label, 16, primary ? CREAM : INK).setOrigin(.5);
  const c = scene.add.container(x, y, [base, labelText]).setSize(width, 52).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { base.setFillStyle(primary ? 0xbe7c64 : 0xf4e6cd); });
  c.on('pointerout', () => { base.setFillStyle(primary ? 0xad6957 : 0xe9d9ba); c.setScale(1); });
  c.on('pointerdown', () => c.setScale(.98));
  c.on('pointerup', () => { c.setScale(1); action(); });
  return c;
}
