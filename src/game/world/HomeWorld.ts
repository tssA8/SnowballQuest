import Phaser from 'phaser';
import type { LevelData } from '../data/level';
import { text } from '../ui/widgets';

export class HomeWorld {
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly oneWays: Phaser.Physics.Arcade.StaticGroup;
  constructor(private readonly scene: Phaser.Scene, readonly level: LevelData) {
    const back = scene.add.graphics().setDepth(-90);
    back.fillStyle(0xe8b696).fillRect(0, 0, level.width, 768);
    // Separately repeating city layers remain independent of the room and furniture.
    ['sky', 'far-city', 'mid-buildings', 'near-houses'].forEach((key, i) => {
      if (scene.textures.exists(key)) scene.add.tileSprite(0, 0, level.width + 1280, 720, key).setOrigin(0).setScrollFactor(.05 + i * .16).setDepth(-80 + i);
    });
    const wall = scene.add.graphics().setDepth(-50);
    wall.fillStyle(0xe6d5b7).fillRect(0, 0, 3472, 640);
    wall.fillStyle(0xdac8a7).fillRect(0, 510, 3472, 130);
    for (let x = 0; x < 3472; x += 32) {
      wall.fillStyle(0xf0e1c5, .65).fillRect(x, 65, 2, 440);
      wall.fillStyle(0xbbaa8e, .45).fillRect(x, 531, 2, 101);
      for (let y = 105; y < 490; y += 70) {
        wall.fillStyle(0xc9bc9b, .35).fillRect(x + 15, y, 3, 6).fillRect(x + 12, y + 3, 9, 2);
      }
    }
    wall.fillStyle(0x785b49).fillRect(0, 505, 3472, 9).fillRect(0, 628, 3472, 12);
    wall.fillStyle(0xb5946e).fillRect(0, 503, 3472, 3).fillRect(0, 621, 3472, 8);
    wall.fillStyle(0x8c7158).fillRect(0, 0, 3472, 18);
    wall.fillStyle(0xf4e7cc).fillRect(0, 18, 3472, 11);
    for (const obj of level.decorBack) this.prop(obj.type, obj.x, obj.y, obj.type === 'window' ? -40 : 1);
    for (const obj of level.decorFront) this.prop(obj.type, obj.x, obj.y + 7, 8);
    // Walls and collision come from different sources: art can be swapped without changing jumps.
    const tiled = scene.make.tilemap({ key: 'home-tilemap' });
    const tileset = tiled.addTilesetImage('world', 'world', 32, 32, 0, 0);
    if (tileset) {
      tiled.createLayer('Ground', tileset)?.setDepth(3);
      tiled.createLayer('Platforms', tileset)?.setDepth(6);
    }
    this.solids = scene.physics.add.staticGroup(); this.oneWays = scene.physics.add.staticGroup();
    for (const p of level.platforms) {
      const zone = scene.add.zone(p.x + p.width / 2, p.y + p.height / 2, p.width, p.height);
      (p.oneWay ? this.oneWays : this.solids).add(zone);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(p.width, p.height);
      if (p.oneWay) { body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false; }
    }
    const rail = scene.add.graphics().setDepth(4);
    rail.fillStyle(0x63595c).fillRect(3520, 540, 576, 12);
    rail.fillStyle(0xc7b297).fillRect(3520, 536, 576, 4);
    for (let x = 3520; x < 4096; x += 52) rail.fillStyle(0x6d6261).fillRect(x, 550, 8, 90);
    for (const sign of level.triggers.filter(o => o.type === 'sign')) {
      text(scene, sign.x, sign.y, String(sign.properties.label ?? ''), 10, '#a28266').setOrigin(.5).setDepth(8);
      text(scene, sign.x, sign.y + 23, String(sign.properties.text ?? ''), 13, '#6b5a4c').setOrigin(.5).setDepth(8);
    }
    this.stringLights(0, 3472);
    const glow = scene.add.graphics().setDepth(10).setAlpha(.05);
    glow.fillStyle(0xffd99c).fillTriangle(330, 300, 480, 640, 760, 640);
  }
  prop(key: string, x: number, y: number, depth = 0): Phaser.GameObjects.Image | undefined {
    if (!this.scene.textures.exists(key)) return;
    return this.scene.add.image(x, y, key).setOrigin(.5, 1).setDepth(depth);
  }
  private stringLights(start: number, end: number): void {
    const g = this.scene.add.graphics().setDepth(-30);
    g.lineStyle(2, 0x8d7760).beginPath().moveTo(start, 40);
    for (let x = start; x < end; x += 8) g.lineTo(x, 45 + Math.sin(x / 210) * 14);
    g.strokePath();
    for (let x = start + 48; x < end; x += 92) {
      const y = Math.round(45 + Math.sin(x / 210) * 14);
      g.fillStyle(0xffdfa0, .15).fillCircle(x, y + 7, 15);
      g.fillStyle(0xc09c64).fillRect(x - 2, y, 4, 5);
      g.fillStyle(0xffe8ae).fillRect(x - 3, y + 4, 6, 7);
    }
  }
}
