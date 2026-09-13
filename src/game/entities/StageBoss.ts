import Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';
import type { StageDefinition } from '../data/stages';
import { bossHitDamage, bossPhase } from '../combat/rules';
import { ARENA } from './WrenchBoss';
import { save } from '../services';

type Action = 'dive' | 'feathers' | 'wind' | 'waterjet' | 'bubbles' | 'roll' | 'dash' | 'pillars' |
  'shockwave' | 'rocks' | 'tail' | 'brood' | 'gravity' | 'copywave';
type State = 'dormant' | 'intro' | 'telegraph' | 'attack' | 'recover' | 'overheat' | 'defeated';
type HazardKind = 'orb' | 'feather' | 'wave' | 'pillar' | 'rock' | 'wind' | 'gravity' | 'jet' | 'tail';
interface Hazard {
  kind: HazardKind; x: number; y: number; vx: number; vy: number;
  radius: number; width: number; height: number; born: number; armed: number; expires: number;
  color: number; spent: boolean;
}
interface Hooks { bomb(x: number): void; drone(x: number): void; defeated(): void; }

const COLORS: Record<string, number> = {
  fire: 0xffa35e, water: 0x75d5ff, wind: 0x8ceac8, earth: 0xd7b584, lightning: 0xffe27a,
};
const HEALTH: Record<string, number> = {
  'boss-galeplume': 660, 'boss-bobo': 690, 'boss-volt': 720,
  'boss-tato': 750, 'boss-bubble': 780, 'boss-nightink': 810,
};
const LABELS: Record<Action, string> = {
  dive: '俯衝準備 · 跳起或閃過地面箭頭', feathers: '羽毛散射 · 留意上下兩道羽毛',
  wind: '旋風將起 · 離開地面的風圈', waterjet: '高壓水柱 · 繞到波波背後',
  bubbles: '泡泡飄來了 · 跳過低處泡泡', roll: '機甲滾動 · 跳起或閃避',
  dash: '電光衝刺 · 跳起或閃避', pillars: '落雷準備 · 離開黃色直線',
  shockwave: '大地震波 · 起跳避開地面波紋', rocks: '落石準備 · 離開地面圓圈',
  tail: '龍尾橫掃 · 離開正面或起跳', brood: '小龍出動 · 先處理小龍',
  gravity: '重力漩渦 · 走出紫色圓圈', copywave: '夜墨正在模仿果實 · 看準提示閃避',
};

/** Six encounter patterns share only their clock, readable warnings, and recovery rules. */
export class StageBoss {
  readonly name: string;
  readonly maxHealth: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  health: number;
  active = false;
  defeated = false;
  phase: 1 | 2 | 3 = 1;
  state: State = 'dormant';
  facing: -1 | 1 = -1;
  nextAction: Action = 'dive';
  private until = 0;
  private actionStarted = 0;
  private actionCount = 0;
  private targetX = ARENA.spawn as number;
  private originX = ARENA.spawn as number;
  private hitPlayer = false;
  private flashUntil = 0;
  private epoch = 0;
  private hazards: Hazard[] = [];
  private copiedFruit: string | null = null;

  constructor(private readonly home: HomeScene, private readonly hooks: Hooks,
    private readonly stage: StageDefinition, alreadyDefeated = false) {
    this.name = stage.bossName;
    this.maxHealth = HEALTH[stage.bossKey] ?? 720;
    this.health = this.maxHealth;
    this.sprite = home.add.sprite(ARENA.spawn, ARENA.floor, stage.bossKey, 0)
      .setOrigin(.5, 1).setScale(stage.bossKey === 'boss-bubble' || stage.bossKey === 'boss-nightink' ? 1 : 2).setDepth(19);
    if (alreadyDefeated) {
      this.health = 0; this.defeated = true; this.state = 'defeated'; this.sprite.setFrame(7);
    }
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get hazardCount(): number { return this.hazards.length; }
  get warning(): string {
    if (this.state === 'intro') return `${this.name}正在準備迎戰！`;
    if (this.state === 'telegraph') return LABELS[this.nextAction];
    if (this.state === 'recover') return '破綻出現 · 趁現在普攻或集氣反擊';
    if (this.state === 'overheat') return this.stage.bossKey === 'boss-nightink' ? '夜墨核心露出！攻擊就能打散黑霧' :
      this.stage.bossKey === 'boss-bubble' ? '龍媽媽護盾消散！現在是反擊機會' : '防禦崩解 · 趁現在反擊';
    return '';
  }

  start(now: number): void {
    if (this.active || this.defeated) return;
    this.active = true; this.state = 'intro'; this.until = now + 1800; this.epoch++;
    this.home.events.emit('boss-start');
    this.home.notify(`${this.name}出現了！留意提示，閃開後反擊。`);
  }

  reset(): void {
    this.epoch++; this.hazards = []; this.health = this.maxHealth; this.phase = 1;
    this.active = false; this.defeated = false; this.state = 'dormant'; this.actionCount = 0;
    this.until = 0; this.actionStarted = 0; this.flashUntil = 0; this.hitPlayer = false;
    this.facing = -1; this.copiedFruit = null; this.targetX = ARENA.spawn; this.originX = ARENA.spawn;
    this.nextAction = this.pattern()[0];
    this.sprite.setPosition(ARENA.spawn, ARENA.floor).setFrame(0).clearTint().setAlpha(1).setFlipX(true);
  }

  hit(damage: number, sourceX: number, now: number, piercing = false): boolean {
    if (!this.active || this.defeated || this.state === 'intro') return false;
    const exposed = this.state === 'overheat';
    const armored = !piercing && this.stage.bossKey === 'boss-tato' && this.state !== 'recover' && !exposed;
    this.health = Math.max(0, this.health - bossHitDamage(damage, exposed, (sourceX - this.x) * this.facing < 0, armored));
    this.flashUntil = now + 100;
    this.home.sparkle(this.x, this.y - 65, this.color(), 5);
    if (this.health === 0) {
      this.epoch++; this.hazards = []; this.active = false; this.defeated = true; this.state = 'defeated';
      this.sprite.setY(ARENA.floor).clearTint().setFrame(7); this.hooks.defeated();
    } else {
      const phase = bossPhase(this.health, this.maxHealth);
      if (phase !== this.phase) {
        this.phase = phase; this.actionCount = 0; this.recover(now);
        this.home.notify(phase === 3 ? `${this.name}的防禦鬆動了！抓住每次反擊機會。` : `${this.name}使出新的招式，注意提示！`);
      }
    }
    return true;
  }

  private pattern(): Action[] {
    switch (this.stage.bossKey) {
      case 'boss-galeplume': return this.phase === 1 ? ['dive', 'feathers'] : ['wind', 'dive', 'feathers'];
      case 'boss-bobo': return this.phase === 1 ? ['waterjet', 'bubbles'] : ['roll', 'bubbles', 'waterjet'];
      case 'boss-volt': return this.phase === 1 ? ['dash', 'pillars'] : ['pillars', 'dash', 'dash'];
      case 'boss-tato': return this.phase === 1 ? ['shockwave', 'rocks'] : ['rocks', 'shockwave', 'roll'];
      case 'boss-bubble': return this.phase === 1 ? ['bubbles', 'tail'] : ['brood', 'tail', 'bubbles'];
      default: return this.phase === 1 ? ['copywave', 'gravity'] : ['gravity', 'copywave', 'pillars'];
    }
  }

  private color(): number {
    if (this.stage.bossKey === 'boss-nightink') return COLORS[this.copiedFruit ?? ''] ?? 0xc19aff;
    const color: Record<string, number> = {
      'boss-galeplume': 0x9ce5cc, 'boss-bobo': 0x81d7ff, 'boss-volt': 0xffe07e,
      'boss-tato': 0xd5b587, 'boss-bubble': 0xf5b6db,
    };
    return color[this.stage.bossKey] ?? 0xc19aff;
  }

  private hazard(kind: HazardKind, now: number, x: number, y: number,
    options: Partial<Hazard> = {}): void {
    this.hazards.push({ kind, x, y, vx: 0, vy: 0, radius: 17, width: 45, height: 45,
      born: now, armed: now, expires: now + 2100, color: this.color(), spent: false, ...options });
  }

  private warn(now: number): void {
    this.hazards = []; this.sprite.setY(ARENA.floor);
    this.nextAction = this.pattern()[this.actionCount++ % this.pattern().length];
    this.facing = this.home.player.x < this.x ? -1 : 1;
    this.targetX = Phaser.Math.Clamp(this.home.player.x, ARENA.left + 80, ARENA.right - 80);
    this.originX = this.x; this.state = 'telegraph'; this.until = now + 1250;
    if (this.stage.bossKey === 'boss-nightink') this.copiedFruit = this.home.combat?.fruit ?? null;
    const marked = (kind: HazardKind, x: number, opts: Partial<Hazard> = {}) =>
      this.hazard(kind, now, x, kind === 'rock' ? 290 : ARENA.floor, { armed: this.until, expires: this.until + 1600, ...opts });
    switch (this.nextAction) {
      case 'pillars':
        for (const offset of [-185, 0, 185]) marked('pillar', this.clamp(this.targetX + offset), { width: 48, height: 225, expires: this.until + 430 });
        break;
      case 'rocks':
        for (const offset of [-160, 0, 160]) marked('rock', this.clamp(this.targetX + offset), { vy: 130, radius: 23 });
        break;
      case 'wind':
        for (const offset of [-190, 190]) marked('wind', this.clamp(this.targetX + offset), { width: 100, height: 135 });
        break;
      case 'gravity': marked('gravity', this.targetX, { width: 230, height: 110, radius: 115 }); break;
      case 'waterjet': marked('jet', this.x + this.facing * 225, { width: 340, height: 65, expires: this.until + 1000 }); break;
      case 'tail': marked('tail', this.x + this.facing * 150, { width: 225, height: 64, expires: this.until + 450 }); break;
    }
  }

  private clamp(x: number): number { return Phaser.Math.Clamp(x, ARENA.left + 65, ARENA.right - 65); }

  private attack(now: number): void {
    this.state = 'attack'; this.actionStarted = now; this.until = now + 1900; this.hitPlayer = false;
    const direction = this.facing;
    const fan = (feathers: boolean): void => {
      for (let i = 0; i < 3; i++) this.hazard(feathers ? 'feather' : 'orb', now, this.x + direction * 72, this.y - 50 - i * 53,
        { vx: direction * (feathers ? 215 + i * 20 : 170), vy: feathers ? -35 + i * 18 : 18 - i * 10, radius: feathers ? 12 : 20 });
    };
    switch (this.nextAction) {
      case 'dive': this.until = now + 1250; break;
      case 'dash': this.until = now + 1000; break;
      case 'roll': this.until = now + 1350; break;
      case 'feathers': fan(true); break;
      case 'bubbles': fan(false); break;
      case 'shockwave':
        for (const vx of [-225, 225]) this.hazard('wave', now, this.x, ARENA.floor - 17, { vx, radius: 21 });
        break;
      case 'brood': this.hooks.drone(this.clamp(this.x - direction * 135)); break;
      case 'copywave':
        if (this.copiedFruit === 'earth') {
          for (const vx of [-210, 210]) this.hazard('wave', now, this.x, ARENA.floor - 17, { vx, radius: 22 });
        } else if (this.copiedFruit === 'lightning') {
          // The copy itself gets a second visible warning before its new target becomes dangerous.
          this.hazard('pillar', now, this.targetX, ARENA.floor, { armed: now + 1100, expires: now + 1550, width: 70, height: 225 });
        } else {
          fan(this.copiedFruit === 'wind');
          if (this.copiedFruit === 'fire') for (const h of this.hazards) { h.vx *= 1.2; h.radius = 14; }
          if (this.copiedFruit === 'water') for (const h of this.hazards) h.vy = -25;
        }
        break;
    }
  }

  private recover(now: number): void {
    this.epoch++; this.hazards = []; this.sprite.setY(ARENA.floor);
    this.state = this.phase === 3 ? 'overheat' : 'recover'; this.until = now + (this.phase === 3 ? 3800 : 2600);
  }

  update(now: number, delta: number): void {
    if (!this.active || this.defeated) return;
    const epoch = this.epoch;
    const dt = Math.max(0, Math.min(delta, 80)) / 1000;
    if (now < this.flashUntil) this.sprite.setTintFill(0xffe9bd);
    else if (this.stage.bossKey === 'boss-nightink' && this.state === 'attack') this.sprite.setTint(this.color());
    else this.sprite.clearTint();
    if (this.state === 'intro') {
      this.sprite.setFrame(0); if (now >= this.until) this.warn(now);
    } else if (this.state === 'telegraph') {
      this.sprite.setFrame(2); if (now >= this.until) this.attack(now);
    } else if (this.state === 'attack') {
      this.sprite.setFrame(this.nextAction === 'dive' || this.nextAction === 'dash' || this.nextAction === 'roll' ? 3 : 4);
      if (this.nextAction === 'dive' || this.nextAction === 'dash' || this.nextAction === 'roll') {
        const speed = this.nextAction === 'dash' ? 390 : this.nextAction === 'dive' ? 310 : 250;
        const destination = this.clamp(this.targetX + this.facing * 125);
        const distance = destination - this.x;
        this.sprite.x += Math.sign(distance) * Math.min(Math.abs(distance), speed * dt);
        this.sprite.y = this.nextAction === 'dive' ? ARENA.floor - Math.sin(Math.min(1, (now - this.actionStarted) / 1250) * Math.PI) * 75 : ARENA.floor;
        const p = this.home.player;
        if (!this.hitPlayer && Math.abs(p.x - this.x) < 83 && Math.abs(p.y - this.y) < 62) {
          this.hitPlayer = this.home.damage(1, this.x);
          if (this.epoch !== epoch || !this.active) return;
        }
      }
      if (now >= this.until) this.recover(now);
    } else if (this.state === 'recover' || this.state === 'overheat') {
      this.sprite.setFrame(this.state === 'overheat' ? 5 : 6); if (now >= this.until) this.warn(now);
    }
    if (this.epoch !== epoch || !this.active) return;
    this.updateHazards(now, dt, epoch);
    if (this.epoch === epoch && this.active) this.sprite.setFlipX(this.facing < 0);
  }

  private updateHazards(now: number, dt: number, epoch: number): void {
    const p = this.home.player;
    for (const h of this.hazards) {
      if (h.spent || now < h.armed || now >= h.expires) continue;
      if (h.kind === 'rock') h.vy += 510 * dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      const centerY = p.y - 24;
      let contact: boolean;
      if (['pillar', 'wind', 'jet', 'tail', 'gravity'].includes(h.kind)) {
        contact = Math.abs(p.x - h.x) < h.width / 2 + 15 && centerY >= h.y - h.height && centerY <= h.y + 12;
      } else contact = Math.hypot(p.x - h.x, centerY - h.y) < h.radius + 22;
      if (h.kind === 'gravity' && Math.abs(p.x - h.x) < 230 && !p.isDashing) {
        p.x = this.clamp(p.x + Math.sign(h.x - p.x) * 45 * dt);
        contact = contact && Math.abs(p.x - h.x) < 42;
      }
      if (contact) {
        const damaged = this.home.damage(1, h.x);
        if (this.epoch !== epoch || !this.active) return;
        if (damaged) h.spent = true;
      }
      if (h.y > ARENA.floor + 50 || h.x < ARENA.left - 150 || h.x > ARENA.right + 150) h.spent = true;
    }
    this.hazards = this.hazards.filter(h => !h.spent && now < h.expires);
  }

  draw(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.active || this.defeated) return;
    const color = this.color();
    if (this.state === 'telegraph' && ['dive', 'dash', 'roll'].includes(this.nextAction)) {
      const destination = this.clamp(this.targetX + this.facing * 125);
      const left = Math.min(this.originX, destination) - 65, width = Math.abs(destination - this.originX) + 130;
      g.fillStyle(color, .2).fillRect(left, ARENA.floor - 9, width, 9);
      g.lineStyle(2, color, .9).strokeRect(left, ARENA.floor - 9, width, 9);
      for (let x = left + 20; x < left + width; x += 55) g.beginPath().moveTo(x - this.facing * 6, ARENA.floor - 7)
        .lineTo(x + this.facing * 6, ARENA.floor - 4).lineTo(x - this.facing * 6, ARENA.floor - 1).strokePath();
    }
    for (const h of this.hazards) {
      const armed = now >= h.armed;
      const pulse = save.data.settings.reducedMotion ? .65 : .55 + Math.sin(now / 120) * .15;
      if (!armed) {
        const width = h.kind === 'rock' ? 60 : h.width;
        g.fillStyle(h.color, .15).fillRect(h.x - width / 2, ARENA.floor - 8, width, 8);
        g.lineStyle(3, h.color, pulse).strokeEllipse(h.x, ARENA.floor - 5, width, 18);
        if (h.kind === 'pillar') g.lineStyle(2, h.color, .5).lineBetween(h.x, ARENA.floor - h.height, h.x, ARENA.floor - 10);
        if (h.kind === 'rock') g.lineStyle(2, h.color, .6).strokeCircle(h.x, h.y, h.radius);
        continue;
      }
      g.fillStyle(h.color, .65); g.lineStyle(2, 0xfff4dd, .8);
      switch (h.kind) {
        case 'pillar': g.fillRect(h.x - h.width / 2, h.y - h.height, h.width, h.height);
          g.lineStyle(5, 0xfffae4).lineBetween(h.x - 9, h.y - h.height, h.x + 10, h.y); break;
        case 'jet': case 'tail': g.fillRoundedRect(h.x - h.width / 2, h.y - h.height, h.width, h.height, 20); break;
        case 'wind': case 'gravity':
          g.fillStyle(h.color, .22).fillEllipse(h.x, h.y - h.height / 2, h.width, h.height);
          for (let i = 0; i < 3; i++) g.strokeEllipse(h.x, h.y - 20 - i * 30, h.width - i * 18, 26);
          break;
        case 'feather': g.fillEllipse(h.x, h.y, 32, 11).lineBetween(h.x - 15, h.y + 3, h.x + 15, h.y - 3); break;
        case 'wave': g.fillEllipse(h.x, h.y, 36, 32).strokeEllipse(h.x, h.y, 46, 40); break;
        default: g.fillCircle(h.x, h.y, h.radius).strokeCircle(h.x, h.y, h.radius); break;
      }
    }
    if (this.state === 'overheat') {
      const radius = 27 + (save.data.settings.reducedMotion ? 0 : Math.sin(now / 150) * 4);
      g.lineStyle(3, 0xffe8ad, .95).strokeCircle(this.x, this.y - 74, radius);
      g.fillStyle(0xffefb8, .3).fillCircle(this.x, this.y - 74, radius - 6);
    }
  }

  destroy(): void { this.epoch++; this.hazards = []; this.active = false; this.sprite.destroy(); }
}
