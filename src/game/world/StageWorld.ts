import type Phaser from 'phaser';
import type { LevelData } from '../data/level';
import type { StageDefinition } from '../data/stages';
import type { HomeScene } from '../scenes/HomeScene';

interface BubblePlatform { zone: Phaser.GameObjects.Zone; x: number; baseY: number; offset: number }

/** Six authored worlds share collision conventions, but have their own scenery and optional routes. */
export class StageWorld {
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  readonly oneWays: Phaser.Physics.Arcade.StaticGroup;
  private readonly art: Phaser.GameObjects.GameObject[] = [];
  private readonly motion: Phaser.GameObjects.Graphics;
  private readonly bubbles: BubblePlatform[] = [];
  private readonly rockArt: Phaser.GameObjects.Graphics;
  private rock?: Phaser.GameObjects.Zone;
  private clock = 0;
  private nextElectricHit = 0;
  private destroyed = false;

  constructor(private readonly scene: HomeScene, readonly level: LevelData, readonly stage: StageDefinition) {
    this.solids = scene.physics.add.staticGroup();
    this.oneWays = scene.physics.add.staticGroup();
    for (const p of level.platforms) this.collider(p.x, p.y, p.width, p.height, p.oneWay);
    const back = this.graphics(-90), scenery = this.graphics(-30), props = this.graphics(2);
    switch (stage.id) {
      case 'rooftop': this.rooftop(back, scenery, props); break;
      case 'basement': this.basement(back, scenery, props); break;
      case 'parking': this.parking(back, scenery, props); break;
      case 'foundations': this.foundations(back, scenery, props); break;
      case 'floor13': this.floor13(back, scenery, props); break;
      case 'nightark': this.nightark(back, scenery, props); break;
    }
    this.drawPlatforms();
    this.motion = this.graphics(7);
    this.rockArt = this.graphics(8);
    if (stage.id === 'foundations') {
      this.rock = this.collider(2992, 304, 48, 80, false);
      this.drawRock();
    }
    if (stage.id === 'floor13') {
      for (const [i, feature] of level.triggers.filter(t => t.type === 'bubble-lift').entries()) {
        const initialY = feature.y - (Math.sin(i) + 1) * 82;
        this.bubbles.push({ x: feature.x, baseY: feature.y, offset: i * 1700,
          zone: this.collider(feature.x - 56, initialY, 112, 16, true) });
      }
    }
    const lightText = ['basement', 'parking', 'foundations', 'nightark'].includes(stage.id);
    for (const sign of level.triggers.filter(t => t.type === 'sign')) {
      this.label(sign.x, sign.y, String(sign.properties.label ?? ''), 17,
        lightText ? '#f6e9c9' : '#504d68');
      this.label(sign.x, sign.y + 26, String(sign.properties.text ?? ''), 13,
        lightText ? '#bfd7d7' : '#5e677c', 510);
    }
    this.label(4220, 262, stage.bossName, 26, lightText ? '#f8eccf' : '#544b68');
    this.label(4220, 300, '留意預警 · 補血罐頭會定時補回', 15, lightText ? '#c2d2e2' : '#626880');
  }

  private graphics(depth: number): Phaser.GameObjects.Graphics {
    const graphic = this.scene.add.graphics().setDepth(depth); this.art.push(graphic); return graphic;
  }

  private label(x: number, y: number, value: string, size: number, color: string, width?: number): void {
    const item = this.scene.add.text(x, y, value, {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: `${size}px`, color,
      align: 'center', ...(width ? { wordWrap: { width } } : {}),
    }).setOrigin(.5).setDepth(8);
    this.art.push(item);
  }

  private collider(x: number, y: number, width: number, height: number, oneWay: boolean): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(x + width / 2, y + height / 2, width, height);
    (oneWay ? this.oneWays : this.solids).add(zone);
    const body = zone.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, height);
    if (oneWay) { body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false; }
    return zone;
  }

  private drawPlatforms(): void {
    const palette: Record<string, [number, number, number]> = {
      rooftop: [0x526e7d, 0xc3dddd, 0x7994a1], basement: [0x274b5a, 0x88c2c5, 0x376777],
      parking: [0x323c53, 0xebd588, 0x536477], foundations: [0x68503e, 0xbbae78, 0x8d7354],
      floor13: [0xc998b8, 0xf6dfaa, 0xd9bad2], nightark: [0x282a53, 0xa4acd9, 0x535485],
    };
    const [base, edge, inset] = palette[this.stage.id] ?? palette.rooftop;
    const g = this.graphics(5);
    for (const p of this.level.platforms) {
      g.fillStyle(base).fillRect(p.x, p.y, p.width, p.height);
      g.fillStyle(edge).fillRect(p.x, p.y, p.width, 5);
      g.fillStyle(inset).fillRect(p.x, p.y + 6, p.width, p.oneWay ? 12 : 22);
      if (this.stage.id === 'foundations') {
        for (let x = p.x + 12; x < p.x + p.width; x += 27) {
          g.fillStyle(0x87a66d, .8).fillTriangle(x, p.y + 2, x + 8, p.y - 8, x + 14, p.y + 2);
        }
      } else {
        for (let x = p.x + 12; x < p.x + p.width; x += 56) {
          g.fillStyle(edge, .28).fillRect(x, p.y + 13, 24, 3);
        }
      }
    }
    if (this.stage.id === 'parking') {
      for (let x = 3520; x < 4864; x += 64) g.fillStyle(0xebd588, .55).fillRect(x + 7, 661, 36, 5);
    }
  }

  private rooftop(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0xc4e0e3).fillRect(0, 0, 4864, 768);
    back.fillStyle(0xf8dcae).fillCircle(4040, 135, 91);
    for (let x = 0; x < 4864; x += 280) {
      const height = 125 + (x % 4) * 23;
      back.fillStyle(0x89aebd, .45).fillRect(x, 610 - height, 245, height + 30);
      for (let y = 500 - height; y < 600; y += 33) {
        for (let wx = x + 21; wx < x + 240; wx += 38) back.fillStyle(0xe2eeea, .5).fillRect(wx, y, 16, 16);
      }
      const cloudY = 85 + (x % 7) * 17;
      back.fillStyle(0xf3f4e6, .7).fillEllipse(x + 150, cloudY, 145, 30).fillEllipse(x + 130, cloudY - 10, 65, 42);
    }
    for (const x of [600, 1530, 2500, 3850, 4620]) {
      g.fillStyle(0x76969e).fillRect(x - 60, 435, 120, 170);
      g.fillStyle(0xa8c6ca).fillRoundedRect(x - 78, 380, 156, 141, 17);
      g.fillStyle(0xd7e6df).fillEllipse(x, 382, 156, 29);
      g.lineStyle(3, 0x6d8c9c).strokeEllipse(x, 382, 156, 29);
      g.lineStyle(3, 0x7596a5).strokeEllipse(x, 501, 150, 19);
      for (let y = 429; y < 635; y += 23) g.lineStyle(3, 0x536f7b).strokeRect(x + 46, y, 29, 12);
    }
    for (const start of [140, 1190, 2190, 3210]) {
      g.lineStyle(3, 0x688294).beginPath().moveTo(start, 285);
      for (let x = 0; x <= 670; x += 20) g.lineTo(start + x, 285 + Math.sin(x / 670 * Math.PI) * 28);
      g.strokePath();
      for (let x = 90; x < 570; x += 110) {
        const y = 290 + Math.sin(x / 670 * Math.PI) * 28;
        g.fillStyle([0xf2c7bc, 0xf3e3bb, 0xb1d4cc][(x / 110 | 0) % 3]).fillRoundedRect(start + x, y, 52, 66, 6);
      }
    }
    for (const x of [300, 2060, 3420, 4760]) {
      props.fillStyle(0x66818b).fillRect(x - 5, 486, 10, 152);
      props.fillStyle(0xc4dbde).fillEllipse(x, 492, 77, 49);
      props.lineStyle(3, 0x7998a5).strokeEllipse(x, 492, 77, 49).beginPath().moveTo(x, 492).lineTo(x + 46, 469).strokePath();
    }
  }

  private basement(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0x203c4d).fillRect(0, 0, 4864, 768);
    for (let x = 0; x < 4864; x += 320) {
      g.fillStyle(0x2d5462).fillRoundedRect(x + 16, 100, 270, 505, 21);
      g.lineStyle(3, 0x497785).strokeRoundedRect(x + 16, 100, 270, 505, 21);
      for (let y = 130; y < 570; y += 50) g.fillStyle(0x587c80, .2).fillRect(x + 24, y, 251, 3);
      g.fillStyle(0x162e3b).fillRect(x + 129, 110, 31, 526);
      g.fillStyle(0x57848b).fillRect(x + 135, 110, 13, 526);
      for (let y = 145; y < 610; y += 120) g.fillStyle(0x96aca3).fillRoundedRect(x + 124, y, 39, 12, 3);
    }
    g.lineStyle(23, 0x426975).beginPath().moveTo(0, 204).lineTo(4850, 204).strokePath();
    g.lineStyle(5, 0x79a49e).beginPath().moveTo(0, 194).lineTo(4850, 194).strokePath();
    for (const x of [490, 1380, 2350, 3470, 4660]) {
      g.fillStyle(0xf3dba3, .07).fillTriangle(x, 224, x - 130, 640, x + 130, 640);
      g.fillStyle(0xe9d294).fillRoundedRect(x - 29, 214, 58, 10, 4);
      props.fillStyle(0x486c70).fillRoundedRect(x - 78, 552, 156, 85, 8);
      props.lineStyle(3, 0x8a9e88).strokeRoundedRect(x - 78, 552, 156, 85, 8);
      for (let n = 0; n < 5; n++) props.fillStyle(0x172f40).fillRect(x - 58 + n * 23, 573, 12, 46);
    }
    for (const x of [832, 2528]) {
      props.fillStyle(0x68bed5, .22).fillRect(x - 130, 551, 310, 89);
      props.lineStyle(3, 0x9bd8dc, .6).beginPath().moveTo(x - 130, 551).lineTo(x + 180, 551).strokePath();
    }
    g.fillStyle(0x65cbd1, .12).fillEllipse(4220, 515, 770, 246);
    g.lineStyle(8, 0x68969a).strokeEllipse(4220, 410, 406, 285);
    g.lineStyle(2, 0xc0e5de, .3).strokeEllipse(4220, 410, 385, 263);
  }

  private parking(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0x202838).fillRect(0, 0, 4864, 768);
    g.fillStyle(0x384352).fillRect(0, 70, 4864, 29).fillRect(0, 620, 4864, 20);
    for (let x = 0; x < 4864; x += 440) {
      g.fillStyle(0x2d384a).fillRect(x + 14, 99, 47, 540);
      g.fillStyle(0xdaca8b).fillRect(x + 14, 482, 47, 26);
      g.fillStyle(0x485269).fillRect(x + 56, 99, 5, 540);
      g.fillStyle(0xcbdcdc, .08).fillTriangle(x + 238, 142, x + 115, 640, x + 370, 640);
      g.fillStyle(0xb9d5cd).fillRoundedRect(x + 192, 124, 92, 10, 4);
      props.fillStyle([0x768a9c, 0x9d8397, 0x6b908b][(x / 440) % 3]).fillRoundedRect(x + 90, 556, 253, 60, 18);
      props.fillStyle(0x718093).fillRoundedRect(x + 132, 515, 154, 71, 20);
      props.fillStyle(0x263548).fillRoundedRect(x + 149, 526, 119, 33, 9);
      props.fillStyle(0x192332).fillCircle(x + 144, 613, 23).fillCircle(x + 293, 613, 23);
      props.fillStyle(0xa4b4b8).fillCircle(x + 144, 613, 10).fillCircle(x + 293, 613, 10);
    }
    for (const x of [790, 2020, 2930, 3860, 4670]) {
      props.fillStyle(0x657c8e).fillRoundedRect(x - 28, 492, 56, 146, 8);
      props.fillStyle(0xb8dcca).fillRoundedRect(x - 22, 501, 44, 53, 5);
      props.fillStyle(0x66c8c5).fillRect(x - 10, 512, 20, 7).fillRect(x - 4, 519, 14, 10).fillRect(x - 12, 529, 18, 7);
      props.lineStyle(6, 0x151e2f).beginPath().moveTo(x + 25, 538).lineTo(x + 44, 548).lineTo(x + 45, 607).lineTo(x + 72, 615).strokePath();
    }
    for (const x of [1088, 2592]) {
      props.lineStyle(8, 0x122331).beginPath().moveTo(x - 30, 634).lineTo(x + 200, 634).strokePath();
      for (let n = 0; n < 6; n++) props.fillStyle(0xa89763).fillRect(x + n * 32, 626, 16, 10);
    }
  }

  private foundations(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0x352f35).fillRect(0, 0, 4864, 768);
    for (let x = 0; x < 4864; x += 190) {
      const height = 100 + (x % 7) * 29;
      g.fillStyle(0x544437).fillTriangle(x, 0, x + 160, 0, x + 75, height);
      g.fillStyle(0x443b38).fillTriangle(x + 60, 640, x + 240, 640, x + 161, 329 + x % 130);
      g.lineStyle(15, 0x80674e).beginPath().moveTo(x + 50, 0).lineTo(x + 75, 160).lineTo(x + 30, 246).lineTo(x + 91, 350).strokePath();
      g.lineStyle(5, 0xb19869, .7).beginPath().moveTo(x + 50, 0).lineTo(x + 75, 160).lineTo(x + 125, 209).strokePath();
    }
    for (const x of [250, 1310, 2300, 3370, 3820, 4750]) {
      props.fillStyle(0x83c9c2, .12).fillCircle(x, 550, 83);
      for (let n = 0; n < 3; n++) {
        const px = x - 28 + n * 29, top = 565 - (n % 2) * 34;
        props.fillStyle([0x82c1b4, 0xa6cbd3, 0xbbabd6][n]).fillTriangle(px - 17, 635, px, top, px + 17, 635);
        props.lineStyle(2, 0xe1e1c1, .6).beginPath().moveTo(px, top + 7).lineTo(px + 3, 624).strokePath();
      }
    }
    for (let x = 120; x < 4864; x += 320) {
      props.fillStyle(0x836e52).fillRect(x, 611, 184, 15);
      props.lineStyle(4, 0xbaa382).strokeRect(x, 611, 184, 15);
      props.fillStyle(0xc6b477, .15).fillCircle(x + 80, 361, 24);
      props.fillStyle(0xf2d28d).fillRoundedRect(x + 71, 350, 18, 23, 5);
    }
    g.fillStyle(0xc9b994, .06).fillCircle(4210, 440, 207);
    g.lineStyle(4, 0xa09f93, .3).strokeCircle(4210, 440, 178);
  }

  private floor13(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0xead8e8).fillRect(0, 0, 4864, 768);
    g.fillStyle(0xcfbfdc).fillRect(0, 510, 4864, 130);
    g.fillStyle(0xffe0b7).fillRect(0, 508, 4864, 7);
    for (let x = 0; x < 4864; x += 340) {
      g.fillStyle(0xf3e9e7).fillRoundedRect(x + 40, 139, 248, 280, 42);
      g.lineStyle(8, 0xc6abd1).strokeRoundedRect(x + 40, 139, 248, 280, 42);
      g.fillStyle(0xb4d9de).fillRoundedRect(x + 56, 155, 215, 247, 32);
      g.lineStyle(7, 0xeae1d9).beginPath().moveTo(x + 164, 155).lineTo(x + 164, 402).moveTo(x + 56, 283).lineTo(x + 271, 283).strokePath();
      for (let y = 65; y < 480; y += 77) g.fillStyle(0xf6efd6, .7).fillCircle(x + 16, y, 6);
    }
    for (const x of [300, 1310, 2280, 3410, 3860, 4700]) {
      props.fillStyle(0xd1afc9).fillRoundedRect(x - 58, 568, 116, 68, 12);
      props.fillStyle(0xf8dfae).fillRoundedRect(x - 38, 516, 76, 60, 10);
      props.fillStyle(0xa8d2cf).fillRoundedRect(x - 15, 479, 55, 43, 9);
      props.lineStyle(3, 0xaa91b3).strokeRoundedRect(x - 58, 568, 116, 68, 12);
      props.fillStyle(0xf1c8b5).fillCircle(x + 70, 614, 24);
      props.lineStyle(3, 0xfaf2d5).strokeCircle(x + 70, 614, 19);
    }
    for (let x = 130; x < 4864; x += 210) {
      const y = 123 + (x % 7) * 41;
      g.fillStyle(0xd4eff0, .24).fillCircle(x, y, 21 + x % 20);
      g.lineStyle(2, 0xffffff, .65).strokeCircle(x, y, 21 + x % 20);
      g.fillStyle(0xffffff, .65).fillCircle(x - 9, y - 12, 5);
    }
    props.fillStyle(0xffe6c4).fillEllipse(4210, 615, 560, 35);
    g.lineStyle(9, 0xb6a3d0).strokeRoundedRect(3995, 337, 430, 269, 90);
  }

  private nightark(back: Phaser.GameObjects.Graphics, g: Phaser.GameObjects.Graphics, props: Phaser.GameObjects.Graphics): void {
    back.fillStyle(0x171b36).fillRect(0, 0, 4864, 768);
    for (let i = 0; i < 240; i++) {
      const x = (i * 137 + i * i * 7) % 4864, y = 18 + (i * 83) % 535;
      back.fillStyle(i % 3 ? 0xbbc3e2 : 0xf5dfba, .35 + (i % 4) * .15).fillCircle(x, y, i % 5 ? 1.5 : 3);
    }
    back.fillStyle(0x847cb9, .13).fillEllipse(1610, 179, 990, 259);
    back.fillStyle(0xa6d2d3, .45).fillCircle(670, 153, 76);
    back.fillStyle(0x171b36).fillCircle(704, 129, 69);
    g.fillStyle(0x242747).fillTriangle(3700, 590, 4220, 134, 4770, 590);
    g.lineStyle(5, 0x686595).beginPath().moveTo(3710, 590).lineTo(4220, 146).lineTo(4760, 590).strokePath();
    g.fillStyle(0x595786, .2).fillCircle(4220, 415, 185);
    g.lineStyle(4, 0x9ca2d4, .55).strokeCircle(4220, 415, 170);
    g.lineStyle(2, 0xbbb6e4, .4).strokeCircle(4220, 415, 135);
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const x = 4220 + Math.cos(angle) * 170, y = 415 + Math.sin(angle) * 170;
      g.fillStyle([0xf7aa80, 0xb2dec8, 0x98d5e2, 0xf3df94, 0xc8b78f][i], .65).fillCircle(x, y, 17);
    }
    for (const x of [330, 1300, 2330, 3400]) {
      props.fillStyle(0x484b73).fillRoundedRect(x - 34, 555, 68, 80, 8);
      props.fillStyle(0xbed0dc, .6).fillRoundedRect(x - 24, 568, 48, 24, 4);
      props.lineStyle(3, 0x9294c3).strokeRoundedRect(x - 34, 555, 68, 80, 8);
    }
    for (let x = 0; x < 4864; x += 180) {
      g.lineStyle(2, 0x5b618d, .7).beginPath().moveTo(x, 627).lineTo(x + 80, 698).lineTo(x + 168, 627).strokePath();
    }
  }

  private drawRock(): void {
    const g = this.rockArt.clear();
    if (!this.rock) return;
    g.fillStyle(0x988777).fillRoundedRect(2992, 304, 48, 80, 13);
    g.lineStyle(3, 0xd3c191).strokeRoundedRect(2992, 304, 48, 80, 13);
    g.lineStyle(3, 0x594e49).beginPath().moveTo(3019, 304).lineTo(3007, 329).lineTo(3023, 346).lineTo(3008, 376).strokePath();
    g.fillStyle(0xc4d19a, .5).fillCircle(3016, 343, 7);
  }

  update(_time: number, delta: number): void {
    if (this.destroyed || this.scene.mode !== 'playing') return;
    const dt = Math.max(0, Math.min(delta, 50));
    this.clock += dt;
    const g = this.motion.clear(), player = this.scene.player;
    const fruit = this.scene.combat.fruit as string | null;
    let gravityOffset = 0;
    if (this.stage.id === 'rooftop') {
      for (const lift of this.level.triggers.filter(t => t.type === 'wind-lift')) {
        g.fillStyle(0xc7f2e0, .12).fillRoundedRect(lift.x - 59, 313, 118, 325, 30);
        for (let n = 0; n < 6; n++) {
          const y = 635 - (this.clock / 9 + n * 57) % 320;
          g.lineStyle(2, 0xe2fff1, .65).beginPath().moveTo(lift.x - 22, y + 8).lineTo(lift.x, y).lineTo(lift.x + 22, y + 8).strokePath();
        }
        if (Math.abs(player.x - lift.x) < 59 && player.y < 616 && player.y > 315) {
          player.body.setVelocityY(Math.min(player.body.velocity.y, fruit === 'wind' ? -310 : -245));
        }
      }
    } else if (this.stage.id === 'basement') {
      for (const pool of this.level.triggers.filter(t => t.type === 'water-pool')) {
        for (let n = 0; n < 9; n++) {
          const x = pool.x - 100 + n * 33, y = 633 - (this.clock / 40 + n * 21) % 80;
          g.lineStyle(2, 0xc4f0f2, .5).strokeCircle(x, y, 4 + n % 3);
        }
        if (player.x > pool.x - 130 && player.x < pool.x + 180 && player.y > 548) {
          gravityOffset = fruit === 'water' ? -560 : -360;
          if (player.body.velocity.y > 95) player.body.setVelocityY(95);
        }
      }
    } else if (this.stage.id === 'parking') {
      for (const [i, cable] of this.level.triggers.filter(t => t.type === 'electric-cable').entries()) {
        const phase = (this.clock + i * 1700) % 6500, warning = phase >= 4100 && phase < 5350, live = phase >= 5350 && phase < 6100;
        if (!warning && !live) continue;
        g.fillStyle(live ? 0x91d5f2 : 0xf6d47c, live ? .25 : .15).fillRoundedRect(cable.x - 8, 627, 216, 12, 4);
        if (live) {
          g.lineStyle(3, 0xc5f3ff, .9).beginPath().moveTo(cable.x, 630);
          for (let n = 1; n <= 12; n++) g.lineTo(cable.x + n * 16, 620 - ((n + Math.floor(this.clock / 60)) % 2) * 18);
          g.strokePath();
          if (fruit !== 'earth' && fruit !== 'lightning' && player.x > cable.x - 12 && player.x < cable.x + 208 && player.y > 592 && this.clock >= this.nextElectricHit) {
            if (this.scene.damage(1, cable.x + 96)) this.nextElectricHit = this.clock + 1700;
          }
        }
      }
    } else if (this.stage.id === 'foundations' && this.rock && fruit === 'earth' &&
      Math.abs(player.x - this.rock.x) < 105 && Math.abs(player.y - 384) < 100) {
      this.solids.remove(this.rock, true, true); this.rock = undefined; this.drawRock();
      this.scene.sparkle(3016, 349, 0xd6c38b, 16);
      this.scene.notify('大地共鳴 · 裂紋岩牆碎開了！星星就在後面。');
    } else if (this.stage.id === 'floor13') {
      for (const bubble of this.bubbles) {
        const oldY = bubble.zone.y - 8;
        const top = bubble.baseY - (Math.sin((this.clock + bubble.offset) / 1700) + 1) * 82;
        if (player.grounded && Math.abs(player.x - bubble.x) < 62 && Math.abs(player.y - oldY) < 12) {
          player.y += top - oldY; player.body.updateFromGameObject();
        }
        bubble.zone.y = top + 8;
        (bubble.zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
        g.fillStyle(0xbddde7, .3).fillEllipse(bubble.x, top + 27, 112, 67);
        g.lineStyle(3, 0xf8ffff, .86).strokeEllipse(bubble.x, top + 27, 112, 67);
        g.lineStyle(3, 0xc1b2df).beginPath().moveTo(bubble.x - 42, top).lineTo(bubble.x + 42, top).strokePath();
        g.fillStyle(0xffffff, .7).fillEllipse(bubble.x - 22, top + 13, 22, 9);
      }
    } else if (this.stage.id === 'nightark') {
      for (const field of this.level.triggers.filter(t => t.type === 'gravity-field')) {
        g.fillStyle(0x9c91dc, .07).fillRoundedRect(field.x - 96, 298, 260, 342, 20);
        for (let n = 0; n < 7; n++) {
          const y = 640 - (this.clock / 23 + n * 41) % 330, x = field.x - 66 + (n % 4) * 61;
          g.fillStyle(0xd5d6ff, .65).fillRect(x - 2, y - 5, 4, 10).fillRect(x - 5, y - 2, 10, 4);
        }
        if (player.x > field.x - 96 && player.x < field.x + 164) gravityOffset = -360;
      }
    }
    player.body.setGravityY(gravityOffset);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.player?.body?.setGravityY(0);
    // Phaser may destroy groups before our scene shutdown listener runs.
    // Group.destroy is idempotent; Group.clear cannot read a destroyed group.
    this.solids.destroy(true, true); this.oneWays.destroy(true, true);
    for (const item of this.art) item.destroy();
    this.art.length = 0; this.bubbles.length = 0; this.rock = undefined;
  }
}
