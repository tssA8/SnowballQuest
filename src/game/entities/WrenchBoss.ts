import Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';
import { bossHitDamage, bossPhase, COMBAT } from '../combat/rules';
import { save } from '../services';

export type BossState = 'dormant' | 'intro' | 'telegraph' | 'charge' | 'suction' | 'bombs' | 'recover' | 'overheat' | 'defeated';
type BossAction = 'charge' | 'suction' | 'bombs';
interface BossHooks {
  bomb(x: number): void;
  drone(x: number): void;
  defeated(): void;
}

export const ARENA = { left: 3520, right: 4864, floor: 640, trigger: 3650, spawn: 4410, entrance: 3620 } as const;

/** Fixed-floor movement makes each warning and recovery independent of Arcade overlap order. */
export class WrenchBoss {
  readonly name = '扳手 · 掃地機戰甲';
  readonly maxHealth = COMBAT.bossHealth;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number = this.maxHealth;
  active = false;
  defeated = false;
  phase: 1 | 2 | 3 = 1;
  state: BossState = 'dormant';
  facing: -1 | 1 = -1;
  nextAction: BossAction = 'charge';
  private until = 0;
  private actionCount = 0;
  private hitPlayer = false;
  private nextPulse = 0;
  private flashUntil = 0;
  private chargeEnd = ARENA.spawn as number;

  constructor(private readonly home: HomeScene, private readonly hooks: BossHooks, alreadyDefeated = false) {
    this.sprite = home.add.sprite(ARENA.spawn, ARENA.floor, 'boss-wrench', 0).setOrigin(.5, 1).setScale(2).setDepth(19);
    if (alreadyDefeated) {
      this.health = 0; this.defeated = true; this.state = 'defeated'; this.sprite.setFrame(7);
    }
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get warning(): string {
    if (this.state === 'intro') return '扳手的戰甲失控了！';
    if (this.state === 'telegraph') return this.nextAction === 'charge' ? '衝撞準備 · 跳起或閃避' : this.nextAction === 'suction' ? '吸塵風口 · 遠離正面' : '螺絲炸彈 · 離開地面標記';
    if (this.state === 'overheat') return '戰甲過熱！繞到背後攻擊散熱口';
    if (this.state === 'recover') return '戰甲停機 · 趁現在攻擊';
    return '';
  }

  start(now: number): void {
    if (this.active || this.defeated) return;
    this.active = true; this.state = 'intro'; this.until = now + 1800;
    this.home.events.emit('boss-start');
    this.home.notify('扳手的戰甲失控了！注意地面提示，閃開再反擊。');
  }

  reset(): void {
    this.health = this.maxHealth; this.active = false; this.defeated = false; this.phase = 1;
    this.state = 'dormant'; this.until = 0; this.actionCount = 0; this.nextPulse = 0; this.flashUntil = 0;
    this.hitPlayer = false; this.facing = -1; this.nextAction = 'charge';
    this.sprite.setPosition(ARENA.spawn, ARENA.floor).setFrame(0).clearTint().setAlpha(1).setFlipX(true);
  }

  hit(damage: number, sourceX: number, now: number, piercing = false): boolean {
    if (!this.active || this.defeated || this.state === 'intro') return false;
    const behind = (sourceX - this.x) * this.facing < 0;
    const armored = !piercing && this.state !== 'recover' && this.state !== 'overheat';
    this.health = Math.max(0, this.health - bossHitDamage(damage, this.state === 'overheat', behind, armored));
    this.flashUntil = now + 100;
    this.home.sparkle(this.x + (sourceX < this.x ? -48 : 48), this.y - 75, 0xffdb97, 4);
    if (this.health === 0) {
      this.active = false; this.defeated = true; this.state = 'defeated';
      this.sprite.clearTint().setFrame(7); this.hooks.defeated();
    } else {
      const next = bossPhase(this.health, this.maxHealth);
      if (next !== this.phase) {
        this.phase = next;
        this.actionCount = 0;
        this.state = next === 3 ? 'overheat' : 'recover'; this.until = now + (next === 3 ? 3800 : 2400);
        this.home.notify(next === 2 ? '階段 2 · 螺絲炸彈與小型無人機！' : '階段 3 · 戰甲過熱，背後的散熱口露出來了！');
      }
    }
    return true;
  }

  private telegraph(now: number): void {
    this.facing = this.home.player.x < this.x ? -1 : 1;
    this.nextAction = this.phase === 2 ? (this.actionCount % 2 === 0 ? 'bombs' : 'charge') :
      this.phase === 3 ? 'charge' : this.actionCount % 2 === 0 ? 'charge' : 'suction';
    this.state = 'telegraph'; this.until = now + (this.nextAction === 'bombs' ? 1250 : 1150);
    this.actionCount++;
    this.chargeEnd = Phaser.Math.Clamp(this.home.player.x + this.facing * 135, ARENA.left + 130, ARENA.right - 130);
  }

  update(now: number, delta: number): void {
    if (!this.active || this.defeated) return;
    if (now < this.flashUntil) this.sprite.setTintFill(0xffedc0); else this.sprite.clearTint();
    const p = this.home.player;
    switch (this.state) {
      case 'intro':
        this.sprite.setFrame(0);
        if (now >= this.until) this.telegraph(now);
        break;
      case 'telegraph':
        this.sprite.setFrame(2);
        if (now >= this.until) {
          this.state = this.nextAction; this.hitPlayer = false;
          this.until = now + (this.nextAction === 'charge' ? 1650 : this.nextAction === 'suction' ? 1900 : 1500);
          this.nextPulse = now;
          if (this.nextAction === 'bombs') {
            const target = Phaser.Math.Clamp(p.x, ARENA.left + 85, ARENA.right - 85);
            this.hooks.bomb(target);
            this.hooks.bomb(Phaser.Math.Clamp(target - 145, ARENA.left + 85, ARENA.right - 85));
            this.hooks.bomb(Phaser.Math.Clamp(target + 145, ARENA.left + 85, ARENA.right - 85));
            this.hooks.drone(this.x - this.facing * 130);
          }
        }
        break;
      case 'charge': {
        this.sprite.setFrame(3);
        const distance = this.chargeEnd - this.x;
        const step = (this.phase === 3 ? 370 : 300) * delta / 1000;
        this.sprite.x += Math.sign(distance) * Math.min(Math.abs(distance), step);
        if (!this.hitPlayer && Math.abs(p.x - this.x) < 98 && Math.abs(p.y - this.y) < 75) {
          this.hitPlayer = this.home.damage(1, this.x);
          if (!this.active || this.state !== 'charge') return;
        }
        if (Math.abs(distance) <= step || now >= this.until) {
          this.state = this.phase === 3 ? 'overheat' : 'recover';
          this.until = now + (this.phase === 3 ? 3800 : 2400);
        }
        break;
      }
      case 'suction': {
        this.sprite.setFrame(4);
        const forward = (p.x - this.x) * this.facing;
        if (forward > 20 && forward < 360 && Math.abs(p.y - this.y) < 100 && !p.isDashing) {
          // A small positional pull survives the player's normal deceleration.
          // Walking away (210 px/s) comfortably outruns the 65 px/s airflow.
          p.x = Phaser.Math.Clamp(p.x - this.facing * 65 * delta / 1000, ARENA.left + 35, ARENA.right - 35);
          if (forward < 102 && now >= this.nextPulse) {
            if (this.home.damage(1, this.x)) this.nextPulse = now + 1300;
            if (!this.active || this.state !== 'suction') return;
          }
        }
        if (now >= this.until) { this.state = 'recover'; this.until = now + 2400; }
        break;
      }
      case 'bombs':
        this.sprite.setFrame(4);
        if (now >= this.until) { this.state = 'recover'; this.until = now + 2400; }
        break;
      case 'overheat':
        this.sprite.setFrame(5);
        if (now >= this.until) this.telegraph(now);
        break;
      case 'recover':
        this.sprite.setFrame(6);
        if (now >= this.until) this.telegraph(now);
        break;
    }
    this.sprite.setFlipX(this.facing < 0);
  }

  draw(g: Phaser.GameObjects.Graphics, now: number): void {
    if (this.defeated) {
      for (let i = 0; i < 3; i++) {
        const a = (save.data.settings.reducedMotion ? 0 : now / 480) + i * Math.PI * 2 / 3;
        g.fillStyle(0xffdd77, .9).fillCircle(this.x + Math.cos(a) * 42, this.y - 195 + Math.sin(a) * 8, 4);
      }
      return;
    }
    if (!this.active) return;
    if (this.state === 'telegraph' && this.nextAction === 'charge') {
      const left = Math.min(this.x, this.chargeEnd) - 70;
      const width = Math.abs(this.chargeEnd - this.x) + 140;
      g.fillStyle(0xff9278, save.data.settings.reducedMotion ? .2 : .15 + Math.sin(now / 80) * .06).fillRect(left, this.y - 10, width, 10);
      g.lineStyle(2, 0xffb785, .9).strokeRect(left, this.y - 10, width, 10);
      for (let x = left + 16; x < left + width; x += 50) {
        g.lineStyle(2, 0xffe2bc).beginPath().moveTo(x - this.facing * 6, this.y - 8)
          .lineTo(x + this.facing * 6, this.y - 5).lineTo(x - this.facing * 6, this.y - 2).strokePath();
      }
    }
    if ((this.state === 'telegraph' && this.nextAction === 'suction') || this.state === 'suction') {
      const reach = this.x + this.facing * 355;
      g.fillStyle(0x9acfc7, this.state === 'suction' ? .19 : .10)
        .fillTriangle(this.x, this.y - 36, reach, this.y - 110, reach, this.y - 5);
      g.lineStyle(2, 0xc3e6df, .65);
      for (let i = 0; i < 6; i++) {
        const d = (i * 62 + (this.state === 'suction' && !save.data.settings.reducedMotion ? -now / 5 : 0)) % 320;
        const x = this.x + this.facing * (30 + (d + 320) % 320);
        g.beginPath().moveTo(x, this.y - 35 - i % 3 * 20).lineTo(x + this.facing * 20, this.y - 38 - i % 3 * 20).strokePath();
      }
    }
    if (this.state === 'overheat') {
      const x = this.x - this.facing * 91;
      g.fillStyle(0xffae54, .25).fillCircle(x, this.y - 93, 24 + (save.data.settings.reducedMotion ? 0 : Math.sin(now / 140) * 5));
      g.lineStyle(3, 0xffdf90, .95).strokeCircle(x, this.y - 93, 18);
      g.fillStyle(0xffeeac).fillCircle(x, this.y - 93, 7);
    }
  }

  destroy(): void { this.sprite.destroy(); }
}
