import Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';

export type EnemyKind = 'vacuum' | 'mouse' | 'pigeon' | 'slime' | 'beetle' | 'mole' | 'dragon' | 'shadow';
export type EnemyState = 'patrol' | 'windup' | 'charge' | 'recover' | 'stunned';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly maxHealth: number;
  health: number;
  state: EnemyState = 'patrol';
  facing: -1 | 1 = -1;
  defeated = false;
  readonly arena: boolean;
  private until = 0;
  private nextAttack = 0;
  private flashUntil = 0;
  private chargeHit = false;
  private burnUntil = -Infinity;
  private burnTick = Infinity;
  private readonly collider: Phaser.Physics.Arcade.Collider;
  private readonly floorY: number;
  private readonly shots: { x: number; y: number; vx: number; until: number; color: number }[] = [];
  private readonly effects?: Phaser.GameObjects.Graphics;

  constructor(private readonly home: HomeScene, readonly kind: EnemyKind,
    x: number, y: number, readonly patrolMin: number, readonly patrolMax: number, arena = false) {
    super(home, x, y, `enemy-${kind}`, 0);
    home.add.existing(this);
    home.physics.add.existing(this);
    this.setOrigin(.5, 1).setDepth(18);
    this.maxHealth = { vacuum: 34, mouse: 25, pigeon: 24, slime: 28, beetle: 36, mole: 30, dragon: 36, shadow: 32 }[kind];
    this.health = this.maxHealth;
    this.arena = arena;
    this.floorY = y;
    this.body.setSize(44, kind === 'vacuum' ? 32 : 38).setOffset(10, kind === 'vacuum' ? 32 : 26);
    this.body.setMaxVelocity(340, 700);
    this.collider = home.physics.add.collider(this, home.world.solids);
    if (kind === 'pigeon' || kind === 'dragon') this.body.setAllowGravity(false);
    if (kind === 'dragon' || kind === 'shadow') this.effects = home.add.graphics().setDepth(20);
  }

  hit(damage: number, direction: number, now: number, burning = false): boolean {
    if (this.defeated) return false;
    this.health = Math.max(0, this.health - damage);
    this.flashUntil = now + 120;
    this.home.sparkle(this.x, this.y - 30, burning ? 0xffa650 : 0xffefc9, 4);
    if (this.health === 0) {
      this.shots.length = 0; this.effects?.clear();
      this.defeated = true;
      this.state = 'stunned';
      this.setFrame(5).clearTint();
      this.body.setVelocity(0, 0).setEnable(false);
      return true;
    }
    if (burning) { this.burnUntil = now + 1800; this.burnTick = now + 600; }
    this.state = 'recover'; this.until = now + 500; this.nextAttack = now + 1250;
    this.body.setVelocityX(direction * 165);
    return true;
  }

  finishCombo(direction: number, now: number, reinforced: boolean): void {
    if (this.defeated || !this.active || !this.body?.enable) return;
    this.state = 'recover';
    this.until = Math.max(this.until, now + (reinforced ? 850 : 600));
    this.nextAttack = Math.max(this.nextAttack, this.until + 750);
    this.body.setVelocity(direction * (reinforced ? 270 : 210), reinforced ? -180 : -140);
  }

  updateCombat(now: number, delta: number): void {
    if (this.defeated) { this.setAlpha(.7); return; }
    const p = this.home.player;
    if (this.y > 820) { this.health = 0; this.defeated = true; this.shots.length = 0; this.effects?.clear(); this.body.setEnable(false); this.setVisible(false); return; }
    if (now <= this.burnUntil && now >= this.burnTick) {
      this.burnTick = now + 600;
      this.hit(2, this.facing, now);
      if (this.defeated) return;
    }
    if (now < this.flashUntil) this.setTintFill(0xfff4d4);
    else this.clearTint();
    this.updateShots(now, delta);
    if (!this.active || !this.body || this.defeated) return;
    const flying = this.kind === 'pigeon' || this.kind === 'dragon';
    const near = Math.abs(p.x - this.x) < (this.kind === 'dragon' ? 340 : 230) && Math.abs(p.y - this.y) < (flying ? 120 : 65);
    switch (this.state) {
      case 'patrol': {
        if (this.x <= this.patrolMin) this.facing = 1;
        else if (this.x >= this.patrolMax) this.facing = -1;
        const speed = { vacuum: 42, mouse: 70, pigeon: 65, slime: 30, beetle: 32, mole: 45, dragon: 35, shadow: 62 }[this.kind];
        this.body.setVelocityX(this.facing * speed);
        if (flying) this.y = this.floorY - 42 + Math.sin(now / 280) * 7;
        if (this.kind === 'mole') this.setAlpha(.65);
        this.setFrame(Math.floor(now / 180) % 2);
        if (near && now >= this.nextAttack) {
          this.facing = p.x < this.x ? -1 : 1;
          this.state = 'windup'; this.until = now + (this.kind === 'mouse' ? 650 : this.kind === 'dragon' ? 1100 : 850);
          this.body.setVelocityX(0);
        }
        break;
      }
      case 'windup':
        this.setAlpha(1);
        this.setFrame(2);
        if (now >= this.until) {
          this.state = 'charge'; this.until = now + (this.kind === 'pigeon' || this.kind === 'mole' ? 650 : 460); this.chargeHit = false;
          const chargeSpeed = { vacuum: 225, mouse: 270, pigeon: 245, slime: 145, beetle: 190, mole: 185, dragon: 0, shadow: 245 }[this.kind];
          this.body.setVelocityX(this.facing * chargeSpeed);
          if (this.kind === 'slime' || this.kind === 'mole') this.body.setVelocityY(this.kind === 'slime' ? -215 : -290);
          if (this.kind === 'dragon' || this.kind === 'shadow') {
            const fruit = this.home.combat?.fruit as string | null;
            const color = this.kind === 'dragon' ? 0xf3a9d0 : ({ fire: 0xffa563, water: 0x84d7ff, lightning: 0xffe87f, wind: 0xa3e6ce, earth: 0xd7b38a }[fruit ?? ''] ?? 0xb7a0ef);
            this.shots.push({ x: this.x + this.facing * 30, y: this.floorY - 26, vx: this.facing * (this.kind === 'dragon' ? 155 : 185), until: now + 2200, color });
            if (this.kind === 'shadow') this.setTint(color);
          }
        }
        break;
      case 'charge':
        this.setFrame(3);
        if (this.kind === 'pigeon') this.y += Math.min(this.floorY - this.y, delta * .12);
        if (this.kind !== 'dragon' && !this.chargeHit && Math.abs(p.x - this.x) < 43 && Math.abs(p.y - this.y) < 47) {
          this.chargeHit = this.home.damage(1, this.x);
          // A lethal hit can remove arena summons synchronously during retry.
          if (!this.active || !this.body) return;
        }
        if (now >= this.until || this.x < this.patrolMin - 15 || this.x > this.patrolMax + 15) {
          this.state = 'recover'; this.until = now + 1200; this.nextAttack = this.until + 700;
          this.body.setVelocityX(0);
        }
        break;
      case 'recover':
        if (flying) this.y += Math.min(this.floorY - this.y, Math.max(0, delta) * .08);
        this.setFrame(4);
        this.body.setVelocityX(this.body.velocity.x * Math.max(0, 1 - delta / 120));
        if (now >= this.until) this.state = 'patrol';
        break;
    }
    this.setFlipX(this.facing < 0);
  }

  private updateShots(now: number, delta: number): void {
    this.effects?.clear();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.x += shot.vx * Math.max(0, Math.min(delta, 80)) / 1000;
      if (now >= shot.until) { this.shots.splice(i, 1); continue; }
      if (Math.hypot(this.home.player.x - shot.x, this.home.player.y - 24 - shot.y) < 30) {
        const damaged = this.home.damage(1, shot.x);
        if (!this.active || !this.body || this.defeated) return;
        if (damaged) { this.shots.splice(i, 1); continue; }
      }
      this.effects?.fillStyle(shot.color, .85).fillCircle(shot.x, shot.y, 11)
        .lineStyle(2, 0xffeed6, .8).strokeCircle(shot.x, shot.y, 13);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.shots.length = 0; this.effects?.destroy();
    // Scene shutdown may destroy the collider before the display list / combat owner.
    if (this.collider?.world) this.collider.destroy();
    super.destroy(fromScene);
  }
}
