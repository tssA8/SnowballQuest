import type Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';
import { ARENA } from '../entities/WrenchBoss';

interface HealingCan {
  readonly view: Phaser.GameObjects.Container;
  readonly arena: boolean;
  readonly emergency: boolean;
  x: number;
  y: number;
  active: boolean;
  availableAt: number;
}

/** Walk-over supplies stay available until they can actually help Snowball. */
export class HealingDrops {
  private readonly cans: HealingCan[] = [];
  private clock = 0;
  private nextRescueAt = 0;
  private destroyed = false;

  constructor(private readonly scene: HomeScene) {
    for (const x of [1800, 2800]) this.addCan(x, 640, false);
    for (const x of [3800, 4160, 4670]) this.addCan(x, ARENA.floor, true);
    this.addCan(ARENA.entrance + 70, ARENA.floor, true, true);
  }

  get activeCount(): number { return this.cans.filter(can => can.active).length; }

  private addCan(x: number, y: number, arena: boolean, emergency = false): void {
    const art = this.scene.add.graphics();
    art.fillStyle(0x98d9b0, .2).fillEllipse(0, -2, 68, 14);
    art.fillStyle(0x75655e, .17).fillEllipse(0, -2, 44, 9);
    art.fillStyle(0xfff4db).fillRoundedRect(-22, -35, 44, 31, 6);
    art.lineStyle(2, 0xa37972).strokeRoundedRect(-22, -35, 44, 31, 6);
    art.fillStyle(0xf4b8bb).fillRoundedRect(-20, -29, 40, 21, 3);
    art.fillStyle(0xfff7e6).fillEllipse(0, -35, 44, 10);
    art.lineStyle(2, 0xa37972).strokeEllipse(0, -35, 44, 10);
    art.lineStyle(2, 0xd0ab9b).strokeEllipse(3, -36, 11, 4);
    const heart = this.scene.add.image(0, -19, 'heart').setDisplaySize(21, 21);
    const label = this.scene.add.text(0, -63, '+2 ♥  補血罐頭', {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: '12px',
      color: '#365748', backgroundColor: '#eff9dc', padding: { x: 7, y: 4 },
    }).setOrigin(.5);
    const view = this.scene.add.container(x, y, [art, heart, label]).setDepth(16).setVisible(!emergency);
    this.cans.push({ view, x, y, arena, emergency, active: !emergency, availableAt: 0 });
  }

  update(delta: number): void {
    if (this.destroyed || this.scene.mode !== 'playing') return;
    this.clock += Math.max(0, Math.min(delta, 50));
    const boss = this.scene.combat.boss;
    const player = this.scene.player;

    for (const can of this.cans) {
      if (!can.active && can.arena && !can.emergency && boss.active && this.clock >= can.availableAt) {
        can.active = true; can.view.setVisible(true);
      }
    }

    const rescue = this.cans.find(can => can.emergency)!;
    if (boss.active && this.scene.hearts <= 2 && !rescue.active && this.clock >= this.nextRescueAt) {
      const direction = player.x < (ARENA.left + ARENA.right) / 2 ? 1 : -1;
      rescue.x = Math.max(ARENA.left + 70, Math.min(ARENA.right - 70, player.x + direction * 90));
      rescue.y = ARENA.floor;
      rescue.active = true;
      rescue.view.setPosition(rescue.x, rescue.y).setVisible(true);
      this.nextRescueAt = this.clock + 18000;
      this.scene.sparkle(rescue.x, rescue.y - 26, 0x9cdeb4, 8);
      this.scene.notify('救援罐頭出現了！靠近愛心罐頭就會自動補血。');
    }

    for (const can of this.cans) {
      if (!can.active || Math.abs(player.x - can.x) > 48 || Math.abs(player.y - can.y) > 50) continue;
      if (!this.scene.heal(2, 20)) continue;
      can.active = false;
      can.availableAt = this.clock + 12000;
      can.view.setVisible(false);
      this.scene.sparkle(can.x, can.y - 25, 0x98e2ae, 14);
      this.scene.notify('補血罐頭 · 回復 2 顆愛心、20 呼嚕能量');
      // One pickup per update prevents consuming nearby rescue and regular cans together.
      break;
    }
  }

  resetArena(): void {
    if (this.destroyed) return;
    for (const can of this.cans) {
      if (!can.arena) continue;
      can.active = !can.emergency;
      can.availableAt = 0;
      can.view.setVisible(can.active);
    }
    this.nextRescueAt = this.clock;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const can of this.cans) can.view.destroy();
    this.cans.length = 0;
  }
}
