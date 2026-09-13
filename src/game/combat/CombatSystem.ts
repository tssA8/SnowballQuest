import Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';
import { Enemy, type EnemyKind } from '../entities/Enemy';
import { ARENA, WrenchBoss } from '../entities/WrenchBoss';
import { StageBoss } from '../entities/StageBoss';
import type { FruitId } from '../data/stages';
import { save } from '../services';
import { COMBAT, ComboChain, ChargeAttack, chargedShot, inMeleeRange } from './rules';
import { HealingDrops } from './HealingDrops';

interface Fireball { x: number; y: number; direction: number; expires: number; damage: number; power: number; fire: boolean; element: FruitId | null; piercing: boolean; victims: Set<Enemy> }
interface Bomb { x: number; created: number; explodes: number; expires: number; hit: boolean }
interface Slash { x: number; y: number; direction: number; expires: number; duration: number; range: number; fire: boolean; air: boolean; step: number }

export class CombatSystem {
  get maxEnergy(): number { return save.data.maxPurrEnergy; }
  energy = 100;
  fruit: FruitId | null = null;
  readonly enemies: Enemy[] = [];
  readonly boss: WrenchBoss | StageBoss;
  readonly healing: HealingDrops;
  private readonly charge = new ChargeAttack();
  private chargeInputRevision = 0;
  private clock = 0;
  private nextCast = 0;
  private hintCooldown = 0;
  private readonly chain = new ComboChain();
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly fireballs: Fireball[] = [];
  private readonly bombs: Bomb[] = [];
  private readonly slashes: Slash[] = [];
  private readonly altar: Phaser.GameObjects.Container;
  private readonly altarFruit: Phaser.GameObjects.Image;
  private readonly bossCaption: Phaser.GameObjects.Text;
  private destroyed = false;
  private shieldUntil = 0;
  private nextArmor = 0;
  private lastElement: FruitId | null = null;
  private lastElementTime = -Infinity;
  private rescueUsed = false;

  constructor(private readonly scene: HomeScene) {
    const available = this.availableFruits;
    this.fruit = available[available.length - 1] ?? null;
    this.energy = this.maxEnergy;
    this.effects = scene.add.graphics().setDepth(25);
    const base = scene.add.ellipse(0, -3, 65, 13, 0x674e4b, .45);
    const pedestal = scene.add.rectangle(0, -13, 42, 22, 0xa58368).setStrokeStyle(2, 0xd6b28c);
    this.altarFruit = scene.add.image(0, -65, scene.stage.fruit === 'fire' || !scene.stage.fruit ? 'fire-fruit' : `fruit-${scene.stage.fruit}`).setScale(2);
    const label = scene.add.text(0, -111, this.fruitName(scene.stage.fruit) + '果實', {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: '14px', color: '#6e4c3b',
      backgroundColor: '#fff0cc', padding: { x: 9, y: 5 },
    }).setOrigin(.5);
    this.altar = scene.add.container(500, 640, [base, pedestal, this.altarFruit, label]).setDepth(14);
    this.altar.setVisible(!!scene.stage.fruit);
    if (scene.stage.fruit && this.availableFruits.includes(scene.stage.fruit)) this.altar.setAlpha(.5);
    for (const [index, x] of [930, 1340, 2170, 2940].entries()) {
      this.enemies.push(new Enemy(scene, scene.stage.enemies[index % scene.stage.enemies.length] as EnemyKind, x, 640, x - 100, x + 150));
    }
    const hooks = {
      bomb: (x: number) => this.spawnBomb(x),
      drone: (x: number) => this.spawnDrone(x),
      defeated: () => this.defeatBoss(),
    };
    const defeated = scene.hasFlag('boss-defeated') || (scene.stage.id === 'home' && scene.hasFlag('boss-wrench-defeated'));
    this.boss = scene.stage.id === 'home' ? new WrenchBoss(scene, hooks, defeated) : new StageBoss(scene, hooks, scene.stage, defeated);
    this.bossCaption = scene.add.text(ARENA.spawn, 350, '', {
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', fontSize: '17px',
      color: '#fff2d6', backgroundColor: '#443e4b', padding: { x: 14, y: 9 }, align: 'center',
    }).setOrigin(.5).setDepth(32).setVisible(false);
    this.healing = new HealingDrops(scene);
  }

  get combo(): number { return this.chain.count; }
  get charging(): boolean { return this.charge.active; }
  get chargeRatio(): number { return this.charge.ratio; }
  get chargeReady(): boolean { return this.charging && this.charge.ratio >= 1 && this.energy >= COMBAT.chargeCost; }
  beginCharge(): void {
    if (this.scene.mode !== 'playing' || this.destroyed || this.boss.defeated || this.clock < this.nextCast) return;
    if (this.energy < COMBAT.fireCost) { this.tip('能量不夠，碰愛心罐頭或稍等一下就能回復。'); return; }
    this.charge.begin(); this.chargeInputRevision = this.scene.controls.revision;
  }
  cancelCharge(): void { this.charge.cancel(); }
  get fireAvailable(): boolean { return this.scene.hasFlag('fire-trial') || save.data.adventure.fireUnlocked; }
  get availableFruits(): FruitId[] {
    const fruits = [...save.data.unlockedFruits];
    const trial = this.scene.stage.fruit;
    if (trial && (this.scene.hasFlag(`fruit-trial-${trial}`) || (trial === 'fire' && this.scene.hasFlag('fire-trial'))) && !fruits.includes(trial)) fruits.push(trial);
    return fruits;
  }
  private fruitName(fruit: FruitId | null): string { return fruit ? { fire: '火焰', wind: '風', water: '水', lightning: '雷電', earth: '大地' }[fruit] : '原生'; }
  get shieldActive(): boolean { return this.clock < this.shieldUntil; }
  absorbDamage(): boolean {
    if (this.shieldActive) { this.shieldUntil = 0; this.scene.sparkle(this.scene.player.x, this.scene.player.y - 30, 0x96e4f0); return true; }
    if (this.fruit === 'earth' && this.clock >= this.nextArmor) {
      this.nextArmor = this.clock + 7000; this.scene.notify('大地護甲擋下一擊！'); return true;
    }
    if (!this.rescueUsed && this.scene.hearts <= 1 && save.data.bossBadges.includes('floor13')) {
      this.rescueUsed = true; this.scene.heal(3, 35); this.scene.notify('泡泡龍媽媽趕來救援！'); return true;
    }
    return false;
  }
  get directionHint(): string {
    if (this.boss.defeated) return `控制解除 · 和${this.scene.stage.bossName}一起回家`;
    if (this.boss.active) return this.boss.warning || '避開預警 · 集氣反擊 · 碰罐頭補血';
    const trial = this.scene.stage.fruit;
    if (trial && !this.availableFruits.includes(trial)) return `向右探索 · 試用${this.fruitName(trial)}果實`;
    return `沿路向右 · 找到${this.scene.stage.bossName} · 收集品不影響通關`;
  }

  toggleFruit(): void {
    if (this.scene.mode !== 'playing') return;
    const fruits = this.availableFruits;
    if (!fruits.length) { this.tip('前方的果實台可以試用元素能力。'); return; }
    this.cancelCharge();
    const choices = [null, ...fruits];
    this.fruit = choices[(choices.indexOf(this.fruit) + 1) % choices.length];
    this.scene.events.emit('fruit-changed', this.fruit);
    this.scene.events.emit('progress');
    const tips = { fire: '火焰爪與強力火球', wind: '二段跳 · 按住跳躍滑翔', water: '水波攻擊附帶護盾', lightning: '連鎖電擊 · 閃避距離加長', earth: '震地攻擊 · 每七秒抵擋一擊' };
    this.scene.notify(this.fruit ? `${this.fruitName(this.fruit)}形態 · ${tips[this.fruit]}` : '原生形態 · 普通爪擊與集氣波');
  }

  attack(): void {
    if (this.destroyed || this.scene.mode !== 'playing' || this.boss.defeated) return;
    const p = this.scene.player;
    const hit = this.chain.attack(this.clock, !p.grounded);
    if (!hit) return;
    const fire = this.fruit === 'fire';
    const range = hit.air ? 98 : hit.step === 3 ? 104 : 82;
    const damage = Math.round(hit.damage * (fire ? 1.25 : 1) * (1 + save.data.adventure.attackBonus) * (save.data.bossBadges.includes('foundations') && hit.step === 3 ? 1.25 : 1));
    p.pose(hit.air ? 'air-attack' : hit.step === 3 ? 'attack-3' : hit.step === 2 ? 'attack-2' : 'attack-1', 210);
    this.slashes.push({ x: p.x, y: p.y - 27, direction: p.facing, expires: this.clock + 190,
      duration: 190, range, fire, air: hit.air, step: hit.step });
    let connected = false;
    for (const enemy of this.enemies) {
      if (enemy.defeated || !inMeleeRange(p.x, p.y, p.facing, enemy.x, enemy.y, range, 44, hit.air)) continue;
      const landed = enemy.hit(damage, p.facing, this.clock, fire && hit.step === 3);
      if (landed && hit.step === 3 && !hit.air) enemy.finishCombo(p.facing, this.clock, save.data.adventure.wrenchJoined);
      connected = landed || connected;
    }
    if (inMeleeRange(p.x, p.y, p.facing, this.boss.x, this.boss.y, range, 190, hit.air)) {
      connected = this.boss.hit(Math.round(damage * this.elementAdvantage()), p.x, this.clock) || connected;
    }
    if (connected) { this.energy = Math.min(this.maxEnergy, this.energy + 3); this.scene.events.emit('combat-hit'); }
    this.scene.events.emit('progress');
  }

  cast(heldMs = 0): void {
    if (this.destroyed || this.scene.mode !== 'playing' || this.boss.defeated) return;
    if (this.clock < this.nextCast) return;
    const shot = chargedShot(heldMs, this.fruit === 'fire', this.energy);
    if (!shot) { this.tip('呼嚕能量不足 · 碰愛心罐頭可以回復'); return; }
    const starburst = shot.piercing && this.energy >= 100 && (this.scene.stage.id === 'nightark' || save.data.bossBadges.includes('nightark'));
    this.energy -= starburst ? 100 : shot.cost; this.nextCast = this.clock + COMBAT.fireCooldown;
    const p = this.scene.player;
    let multiplier = this.elementAdvantage();
    if ((this.scene.stage.index >= 6 || save.data.bossBadges.includes('floor13')) && this.fruit && this.lastElement && this.lastElement !== this.fruit && this.clock - this.lastElementTime < 4500) {
      multiplier *= 1.4; this.scene.notify('元素連攜！傷害提升');
    }
    this.lastElement = this.fruit; this.lastElementTime = this.clock;
    if (this.fruit === 'water') this.shieldUntil = this.clock + 4000;
    if (this.fruit === 'earth') {
      for (const enemy of this.enemies) if (!enemy.defeated && Math.abs(enemy.x - p.x) < 210) enemy.hit(22 + Math.round(shot.ratio * 25), p.facing, this.clock);
      this.scene.events.emit('earth-stomp', p.x, p.y);
      this.scene.sparkle(p.x, p.y - 8, 0xd6b680, 14);
    }
    if (starburst) {
      this.boss.hit(Math.round(240 * (1 + save.data.adventure.attackBonus)), p.x, this.clock, true);
      for (const enemy of this.enemies) if (!enemy.defeated && Math.abs(enemy.x - p.x) < 900) enemy.hit(150, p.facing, this.clock);
      this.scene.sparkle(p.x, p.y - 40, 0xe5c4ff, 24); this.scene.notify('星貓爆發！同伴一起關閉星核');
    }
    if (this.boss.defeated) return;
    p.pose('attack-3', 260);
    this.fireballs.push({ x: p.x + p.facing * 35, y: p.y - 32, direction: p.facing,
      expires: this.clock + 1400 + shot.ratio * 500, damage: Math.round(shot.damage * (1 + save.data.adventure.attackBonus) * multiplier),
      power: shot.ratio, fire: this.fruit === 'fire', element: this.fruit, piercing: shot.piercing, victims: new Set() });
    if (shot.piercing) this.scene.sparkle(p.x, p.y - 30, 0xffd477, 12);
    this.scene.events.emit('progress');
  }

  private elementAdvantage(): number {
    const preferred: Record<string, FruitId> = { home: 'fire', rooftop: 'fire', basement: 'wind', parking: 'water', foundations: 'lightning', floor13: 'earth', nightark: 'fire' };
    return this.fruit === preferred[this.scene.stage.id] ? 1.3 : 1;
  }

  private tip(message: string): void {
    if (this.clock < this.hintCooldown) return;
    this.hintCooldown = this.clock + 1800; this.scene.notify(message);
  }

  private spawnBomb(x: number): void {
    this.bombs.push({ x, created: this.clock, explodes: this.clock + 1650, expires: this.clock + 1920, hit: false });
  }

  private spawnDrone(x: number): void {
    if (this.enemies.filter(e => e.arena && !e.defeated).length >= 1) return;
    // Retired summons do not accumulate between phases or retries.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].arena && this.enemies[i].defeated) { this.enemies[i].destroy(); this.enemies.splice(i, 1); }
    }
    this.enemies.push(new Enemy(this.scene, this.scene.stage.enemies[0] as EnemyKind, Phaser.Math.Clamp(x, ARENA.left + 90, ARENA.right - 90),
      ARENA.floor, ARENA.left + 65, ARENA.right - 65, true));
  }

  private defeatBoss(): void {
    this.cancelCharge();
    this.fireballs.length = 0; this.bombs.length = 0; this.slashes.length = 0;
    for (const enemy of this.enemies) if (enemy.arena && !enemy.defeated) enemy.hit(enemy.health, 0, this.clock);
    this.scene.setFlag(`boss-${this.scene.stage.id === 'home' ? 'wrench' : this.scene.stage.id}-defeated`);
    this.scene.events.emit('boss-defeated');
  }

  retry(): void {
    if (this.boss.defeated) return;
    this.fireballs.length = 0; this.bombs.length = 0; this.slashes.length = 0;
    this.cancelCharge(); this.healing.resetArena();
    this.chain.reset(); this.nextCast = 0; this.energy = this.maxEnergy;
    this.shieldUntil = 0; this.nextArmor = 0; this.rescueUsed = false; this.lastElementTime = -Infinity;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].arena) { this.enemies[i].destroy(); this.enemies.splice(i, 1); }
    }
    this.boss.reset(); this.effects.clear(); this.bossCaption.setVisible(false);
    this.scene.events.emit('boss-retry');
  }

  update(_time: number, delta: number): void {
    if (this.destroyed || this.scene.mode !== 'playing') return;
    const dt = Math.min(delta, 50);
    this.clock += dt;
    this.energy = Math.min(this.maxEnergy, this.energy + (COMBAT.energyPerSecond + (save.data.bossBadges.includes('parking') ? 3 : 0)) * dt / 1000);
    if (this.charging) {
      if (this.chargeInputRevision !== this.scene.controls.revision) this.cancelCharge();
      else if (this.scene.controls.specialHeld) this.charge.update(dt);
      else { const held = this.charge.elapsed; this.cancelCharge(); this.cast(held); }
    }
    this.chain.update(this.clock);
    const p = this.scene.player;
    const trial = this.scene.stage.fruit;
    if (trial && !this.availableFruits.includes(trial) && Math.abs(p.x - 500) < 85 && Math.abs(p.y - 640) < 120) {
      this.scene.setFlag(`fruit-trial-${trial}`); if (trial === 'fire') this.scene.setFlag('fire-trial'); this.fruit = trial; this.energy = this.maxEnergy;
      this.altar.setAlpha(.5); p.pose('fruit-eat', 450);
      this.scene.sparkle(p.x, p.y - 40, 0xffb45d, 12);
      this.scene.notify(`${this.fruitName(trial)}果實試用！K 集氣攻擊，Q 切換；打贏本關即可永久保留。`);
      this.scene.events.emit('fruit-changed', this.fruit); this.scene.events.emit('progress');
    }
    this.altarFruit.y = -65 + (save.data.settings.reducedMotion ? 0 : Math.sin(this.clock / 450) * 5);
    if (p.x >= ARENA.trigger && !this.boss.active && !this.boss.defeated) this.boss.start(this.clock);
    // Damage can synchronously reset the fight. Each subsequent pass reads the fresh state.
    for (const enemy of this.enemies) enemy.updateCombat(this.clock, dt);
    this.boss.update(this.clock, dt);
    this.updateProjectiles(dt);
    if (this.scene.mode !== 'playing') return;
    this.healing.update(dt);
    this.draw();
    this.bossCaption.setVisible(this.boss.active && !!this.boss.warning)
      .setText(this.boss.warning).setX(Phaser.Math.Clamp(this.boss.x, ARENA.left + 245, ARENA.right - 245));
  }

  private updateProjectiles(delta: number): void {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fire = this.fireballs[i];
      if (!fire) continue; // Boss defeat can clear all projectiles from inside hit().
      fire.x += fire.direction * (570 + fire.power * 100) * delta / 1000;
      let hit = this.clock >= fire.expires;
      if (!hit) {
        for (const enemy of this.enemies) {
          if (!enemy.defeated && !fire.victims.has(enemy) && Math.abs(enemy.x - fire.x) < 40 + fire.power * 18 && Math.abs(enemy.y - 29 - fire.y) < 35 + fire.power * 15) {
            enemy.hit(fire.damage, fire.direction, this.clock, fire.fire); fire.victims.add(enemy);
            if (fire.element === 'lightning') {
              for (const other of this.enemies) if (!other.defeated && !fire.victims.has(other) && Math.abs(other.x - enemy.x) < 300) {
                other.hit(Math.round(fire.damage * .6), fire.direction, this.clock); fire.victims.add(other);
                this.scene.sparkle(other.x, other.y - 30, 0xffe58d, 6);
              }
            }
            if (!fire.piercing) { hit = true; break; }
          }
        }
      }
      if (!hit && this.boss.active && Math.abs(this.boss.x - fire.x) < 112 && Math.abs(this.boss.y - 83 - fire.y) < 88) {
        hit = this.boss.hit(fire.damage, fire.x - fire.direction * 100, this.clock, fire.piercing);
      }
      if (hit) this.fireballs.splice(i, 1);
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (!bomb) continue;
      if (this.clock >= bomb.expires) { this.bombs.splice(i, 1); continue; }
      if (this.clock >= bomb.explodes && !bomb.hit && Math.abs(this.scene.player.x - bomb.x) < 57 && this.scene.player.y > ARENA.floor - 70) {
        bomb.hit = this.scene.damage(1, bomb.x);
        // A lethal hit may clear the entire bombs array via retry().
        if (!this.boss.active) break;
      }
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) if (this.clock >= this.slashes[i].expires) this.slashes.splice(i, 1);
  }

  private draw(): void {
    const g = this.effects.clear();
    for (const enemy of this.enemies) {
      if (!enemy.visible) continue;
      if (enemy.defeated) {
        for (let i = 0; i < 3; i++) {
          const a = (save.data.settings.reducedMotion ? 0 : this.clock / 480) + i * Math.PI * 2 / 3;
          g.fillStyle(0xffda77).fillCircle(enemy.x + Math.cos(a) * 20, enemy.y - 46 + Math.sin(a) * 5, 2.5);
        }
        continue;
      }
      if (enemy.health < enemy.maxHealth) {
        g.fillStyle(0x4e424b, .8).fillRoundedRect(enemy.x - 24, enemy.y - 64, 48, 5, 2);
        g.fillStyle(0xe8b57c).fillRoundedRect(enemy.x - 24, enemy.y - 64, 48 * enemy.health / enemy.maxHealth, 5, 2);
      }
      if (enemy.state === 'windup') {
        const left = enemy.facing < 0 ? enemy.x - 140 : enemy.x;
        g.fillStyle(0xff9a78, .3).fillRect(left, enemy.y - 7, 140, 7);
        g.lineStyle(2, 0xffcc92).strokeRect(left, enemy.y - 7, 140, 7);
        g.fillStyle(0xffc970).fillRoundedRect(enemy.x - 3, enemy.y - 80, 6, 15, 2).fillCircle(enemy.x, enemy.y - 60, 3);
      }
    }
    for (const slash of this.slashes) {
      const progress = 1 - (slash.expires - this.clock) / slash.duration;
      const radius = slash.range * (.58 + progress * .17);
      const center = slash.direction > 0 ? 0 : Math.PI;
      const x = slash.x + slash.direction * 4;
      g.lineStyle(slash.step === 3 ? 7 : 5, slash.fire ? 0xffaa58 : 0xfff3d2, (1 - progress) * .95);
      g.beginPath().arc(x, slash.y, radius, center - 1.05, center + 1.05).strokePath();
      g.lineStyle(2, 0xfff6cf, 1 - progress).beginPath()
        .arc(x, slash.y + 3, radius - 8, center - .8, center + .8).strokePath();
      if (slash.air) g.lineStyle(2, 0xffe4b9, (1 - progress) * .5).strokeCircle(slash.x, slash.y, 32 + progress * 12);
    }
    for (const fire of this.fireballs) {
      const scale = 1 + fire.power;
      if (!fire.fire) {
        const color = { fire: 0xffaa60, wind: 0xb5f2cc, water: 0x90dffa, lightning: 0xffe37e, earth: 0xd4af7e, native: 0xbce8ed }[fire.element ?? 'native'];
        g.fillStyle(color, .22).fillCircle(fire.x, fire.y, 23 * scale);
        g.fillStyle(0xfff0bc).fillCircle(fire.x, fire.y, 12 * scale);
        g.lineStyle(3, color).strokeCircle(fire.x, fire.y, 17 * scale);
        continue;
      }
      if (fire.power > .2) g.lineStyle(3, 0xffdf84, .85).strokeCircle(fire.x, fire.y, 26 * scale);
      g.fillStyle(0xff813e, .18).fillCircle(fire.x, fire.y, 23);
      g.fillStyle(0xff943e, .55).fillTriangle(fire.x, fire.y - 11, fire.x, fire.y + 11, fire.x - fire.direction * 43, fire.y);
      g.fillStyle(0xff9a42).fillCircle(fire.x, fire.y, 13);
      g.fillStyle(0xffd779).fillCircle(fire.x + fire.direction * 2, fire.y - 1, 8);
      g.fillStyle(0xfff0b9).fillCircle(fire.x + fire.direction * 5, fire.y - 2, 4);
    }
    for (const bomb of this.bombs) {
      if (this.clock < bomb.explodes) {
        const progress = (this.clock - bomb.created) / (bomb.explodes - bomb.created);
        g.fillStyle(0xee956e, .2 + progress * .2).fillEllipse(bomb.x, ARENA.floor - 5, 112, 17);
        g.lineStyle(2, 0xffd196).strokeEllipse(bomb.x, ARENA.floor - 5, 112, 17);
        const y = ARENA.floor - 14 - (1 - progress) * 205;
        g.fillStyle(0x807478).fillRoundedRect(bomb.x - 6, y - 12, 12, 22, 3);
        g.lineStyle(2, 0xe5c8ac).strokeRoundedRect(bomb.x - 6, y - 12, 12, 22, 3);
        g.lineStyle(2, 0xd0b297);
        for (let n = 0; n < 3; n++) g.beginPath().moveTo(bomb.x - 5, y - 6 + n * 5).lineTo(bomb.x + 5, y - 9 + n * 5).strokePath();
      } else {
        const fade = (bomb.expires - this.clock) / (bomb.expires - bomb.explodes);
        g.fillStyle(0xffb36e, fade * .4).fillEllipse(bomb.x, ARENA.floor - 25, 112, 55);
        g.lineStyle(3, 0xffe3a5, fade).strokeEllipse(bomb.x, ARENA.floor - 25, 112, 55);
      }
    }
    this.boss.draw(g, this.clock);
    if (this.charging) {
      const p = this.scene.player, ratio = this.chargeRatio;
      const color = this.chargeReady ? 0xffdf85 : 0xb4e0ec;
      g.lineStyle(2 + ratio * 2, color, .9).strokeCircle(p.x, p.y - 26, 26 + ratio * 13);
      g.fillStyle(color, .13).fillCircle(p.x, p.y - 26, 22 + ratio * 12);
      g.fillStyle(0x493c48).fillRoundedRect(p.x - 29, p.y - 78, 58, 7, 3);
      g.fillStyle(color).fillRoundedRect(p.x - 28, p.y - 77, 56 * ratio, 5, 2);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelCharge(); this.healing.destroy();
    this.fireballs.length = 0; this.bombs.length = 0; this.slashes.length = 0;
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies.length = 0;
    this.boss.destroy(); this.effects.destroy(); this.altar.destroy(); this.bossCaption.destroy();
  }
}
