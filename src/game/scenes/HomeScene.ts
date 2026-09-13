import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InputSystem } from '../systems/InputSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { DialogueSystem, DIALOGUE, type Dialogue } from '../systems/DialogueSystem';
import { loadLevel, type LevelData, type LevelObject } from '../data/level';
import { HomeWorld } from '../world/HomeWorld';
import { Interactions } from '../world/Interactions';
import { save, audio } from '../services';
import { CombatSystem } from '../combat/CombatSystem';
import { STAGES, stageById, type StageDefinition } from '../data/stages';
import { StageWorld } from '../world/StageWorld';

export type GameMode = 'playing' | 'dialogue' | 'paused' | 'complete';
export class HomeScene extends Phaser.Scene {
  player!: Player;
  controls!: InputSystem;
  world!: HomeWorld | StageWorld;
  stage!: StageDefinition;
  level!: LevelData;
  missions!: MissionSystem;
  dialogue!: DialogueSystem;
  interactions!: Interactions;
  combat!: CombatSystem;
  mode: GameMode = 'playing';
  hearts = 5;
  elapsed = 0;
  private invulnerableUntil = 0;
  private autosave = 0;
  private elementOverlay!: Phaser.GameObjects.Graphics;
  private reconciling = false;
  private changingStage = false;
  private modeBeforePause: 'playing' | 'dialogue' = 'playing';
  private onBlur = (): void => { this.pause(); this.controls.clear(); this.persist(); };
  constructor() { super('Home'); }

  create(): void {
    this.stage = stageById(save.data.currentStage);
    this.level = loadLevel(this, `${this.stage.id}-map`);
    this.changingStage = false;
    this.mode = 'playing'; this.autosave = 0; this.invulnerableUntil = 0; this.reconciling = false;
    this.hearts = save.data.run.hearts; this.elapsed = save.data.run.elapsed;
    this.world = this.stage.id === 'home' ? new HomeWorld(this, this.level) : new StageWorld(this, this.level, this.stage);
    this.controls = new InputSystem(this);
    this.missions = new MissionSystem(this.events, save.data.run.flags);
    this.dialogue = new DialogueSystem();
    const stored = save.data.run.checkpoint;
    const known = this.level.checkpoints.find(item => item.id === stored.id);
    const cp = known ? { x: known.x, y: known.y, id: known.id } : { x: this.level.spawn.x, y: this.level.spawn.y, id: 'start' };
    save.updateRun({ checkpoint: cp });
    this.player = new Player(this, cp.id === 'start' ? this.level.spawn.x : cp.x, cp.id === 'start' ? this.level.spawn.y : cp.y, this.controls);
    this.physics.add.collider(this.player, this.world.solids);
    this.physics.add.collider(this.player, this.world.oneWays, undefined, (player, platform) => {
      const p = player as Player;
      const body = (platform as Phaser.GameObjects.Zone).body as Phaser.Physics.Arcade.StaticBody;
      return p.body.velocity.y >= 0 && p.body.prev.y + p.body.height <= body.top + 10;
    });
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height + 200);
    this.cameras.main.setBounds(0, 0, this.level.width, 768).startFollow(this.player, true, .08, .05).setDeadzone(200, 140);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setFollowOffset(-150, 200);
    this.interactions = new Interactions(this);
    this.spawnCollectibles();
    this.combat = new CombatSystem(this);
    this.elementOverlay = this.add.graphics().setDepth(21);
    this.events.on('boss-start', this.startBoss, this);
    this.events.on('boss-defeated', this.reconcile, this);
    for (const cpObj of this.level.checkpoints) {
      const flag = this.add.image(cpObj.x, cpObj.y, 'checkpoint').setOrigin(.5, 1).setDepth(10);
      if (cp.id === cpObj.id) flag.setTint(0xffd779);
    }
    this.events.on('player-jumped', (x: number, y: number) => { audio.play('jump'); this.sparkle(x, y, 0xf9e7c7, 5); });
    this.events.on('player-landed', (x: number, y: number) => this.sparkle(x, y, 0xe4c9a4, 3));
    this.events.on('player-dashed', (x: number, y: number) => this.sparkle(x, y - 15, 0xffebd7, 8));
    this.dialogue.on('close', () => { if (this.reconciling) this.finish(); else this.setMode('playing'); });
    this.scene.launch('HUD');
    audio.startMusic();
    window.addEventListener('blur', this.onBlur);
    this.events.once('shutdown', () => {
      if (!this.changingStage) this.persist();
      this.scene.stop('HUD'); window.removeEventListener('blur', this.onBlur);
      this.dialogue.removeAllListeners(); this.events.removeAllListeners('player-jumped');
      this.events.removeAllListeners('player-landed'); this.events.removeAllListeners('player-dashed');
      this.events.off('boss-start', this.startBoss, this); this.events.off('boss-defeated', this.reconcile, this);
      this.combat.destroy();
      if (this.world instanceof StageWorld) this.world.destroy();
    });
    if (this.hasFlag('boss-defeated') || this.hasFlag('boss-wrench-defeated')) this.reconcile();
    else if (!this.hasFlag('patrol-intro-seen')) {
      this.setFlag('patrol-intro-seen'); this.say(this.stage.id === 'home' ? DIALOGUE.intro : { speaker: '小鈴', lines: [...this.stage.intro] });
    }
  }
  get fish(): number { return save.data.run.collected.filter(id => id.startsWith('fish-')).length; }
  get maxHearts(): number { return save.data.maxHearts; }
  get stars(): number { return save.data.run.collected.filter(id => id.startsWith('star-')).length; }
  get feathers(): number { return save.data.run.collected.filter(id => id.startsWith('feather-')).length; }
  get secrets(): number { return ['secret-nook', 'secret-feather', 'high-shelf'].filter(id => this.hasFlag(id)).length; }
  hasFlag(id: string): boolean { return save.data.run.flags[id] === true; }
  setFlag(id: string): void { save.setFlag(id); this.missions.setFlag(id); this.events.emit('progress'); }
  persist(): void { save.updateRun({ hearts: this.hearts, elapsed: this.elapsed }); }
  say(dialogue: Dialogue): void { this.setMode('dialogue'); this.dialogue.open(dialogue); }
  notify(message: string): void { this.events.emit('toast', message); }
  setMode(mode: GameMode): void {
    this.mode = mode;
    this.combat?.cancelCharge();
    this.controls.clear(); this.player.freeze(mode !== 'playing');
    if (mode === 'playing') { this.physics.resume(); audio.startMusic(); }
    else { this.physics.pause(); if (mode === 'paused') audio.stopMusic(); this.persist(); }
    this.events.emit('mode', mode);
  }
  pause(): void {
    if (this.mode !== 'playing' && this.mode !== 'dialogue') return;
    this.modeBeforePause = this.mode;
    this.setMode('paused');
  }
  resume(): void {
    if (this.mode !== 'paused') return;
    void audio.unlock();
    this.setMode(this.modeBeforePause);
    if (this.modeBeforePause === 'dialogue') audio.startMusic();
  }
  togglePause(): void { if (this.mode === 'paused') this.resume(); else this.pause(); }
  replay(): void { this.changingStage = true; save.startStage(this.stage.id); this.scene.restart(); }
  nextStage(): void {
    const next = STAGES[this.stage.index];
    if (!next || !save.startStage(next.id)) { this.menu(); return; }
    this.changingStage = true; this.scene.restart();
  }
  menu(): void { this.persist(); this.scene.start('Menu'); }
  collect(id: string, type: string, x: number, y: number, secret?: string): void {
    if (save.data.run.collected.includes(id)) return;
    save.collect(id);
    if (secret) this.setFlag(secret);
    if (type === 'key') { this.setFlag('key-found'); this.notify('BALCONY KEY FOUND'); audio.play('bell'); }
    else if (type === 'heart') { this.hearts = Math.min(this.maxHearts, this.hearts + 1); audio.play('bell'); }
    else if (type === 'star') { audio.play('star'); this.notify('A LITTLE MORE HAPPINESS  ★'); }
    else if (type === 'feather') { audio.play('bell'); this.notify(this.feathers === 3 ? 'ALL FEATHERS FOUND · CROWN SPARKLE UNLOCKED' : 'SOFT. IMPORTANT. COLLECTED.'); }
    else { this.hearts = Math.min(this.maxHearts, this.hearts + 1); audio.play('fish'); }
    this.sparkle(x, y - 15, type === 'feather' ? 0xe8a0b0 : 0xffd175, 10);
    this.player.pose('interact', 220); this.persist(); this.events.emit('progress');
  }
  private spawnCollectibles(): void {
    const group = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const item of this.level.collectibles) {
      if (save.data.run.collected.includes(item.id)) continue;
      const sprite = this.physics.add.sprite(item.x, item.y - 16, item.type).setDepth(15);
      sprite.setData('item', item);
      group.add(sprite);
      (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(32, 40);
      if (!save.data.settings.reducedMotion) this.tweens.add({ targets: sprite, y: sprite.y - 5, duration: 1200, yoyo: true, repeat: -1, delay: item.x % 750, ease: 'Sine.easeInOut', onUpdate: () => sprite.body?.updateFromGameObject() });
    }
    this.physics.add.overlap(this.player, group, (_p, collectible) => {
      if (this.mode !== 'playing') return;
      const sprite = collectible as Phaser.Physics.Arcade.Sprite;
      const item = sprite.getData('item') as LevelObject;
      this.collect(item.id, item.type, item.x, item.y, typeof item.properties.secretId === 'string' ? item.properties.secretId : undefined);
      this.tweens.killTweensOf(sprite); sprite.destroy();
    });
  }
  private startBoss(): void {
    this.combat.healing.resetArena();
    const cp = { x: 3590, y: 640, id: 'checkpoint-boss' };
    save.updateRun({ checkpoint: cp, hearts: this.maxHearts }); this.hearts = this.maxHearts;
    this.cameras.main.setBounds(3520, 0, this.level.width - 3520, 768).setFollowOffset(-80, 200);
    this.notify(`${this.stage.bossName}出現了！避開預警，集氣反擊；地上的愛心罐頭可以補血。`);
    this.events.emit('progress');
  }
  private reconcile(): void {
    if (this.reconciling) return;
    this.reconciling = true;
    this.setFlag('boss-defeated'); save.completeAdventure(this.stage.id);
    this.say({ speaker: this.stage.bossName, lines: [...this.stage.reconcile] });
  }
  damage(amount = 1, sourceX = this.player.x): boolean {
    if (this.mode !== 'playing' || this.elapsed < this.invulnerableUntil) return false;
    if (this.player.isDodgeProtected) {
      this.combat.energy = Math.min(this.combat.maxEnergy, this.combat.energy + 2);
      return false;
    }
    if (this.combat.absorbDamage()) return false;
    this.invulnerableUntil = this.elapsed + 1600;
    this.hearts = Math.max(0, this.hearts - amount);
    audio.play('stumble');
    this.sparkle(this.player.x, this.player.y - 24, 0xe8b5a6, 8);
    if (this.hearts === 0) this.recover(true);
    else {
      this.player.pose('hurt', 280);
      this.player.body.setVelocity(this.player.x < sourceX ? -220 : 220, -130);
    }
    this.persist(); this.events.emit('progress'); return true;
  }
  heal(hearts = 2, energy = 20): boolean {
    if (this.mode !== 'playing') return false;
    const nextHearts = Math.min(this.maxHearts, this.hearts + Math.max(0, hearts));
    const nextEnergy = Math.min(this.combat.maxEnergy, this.combat.energy + Math.max(0, energy));
    if (nextHearts === this.hearts && nextEnergy === this.combat.energy) return false;
    this.hearts = nextHearts; this.combat.energy = nextEnergy;
    this.persist(); this.events.emit('progress'); audio.play('bell'); return true;
  }
  stumble(): void {
    if (this.mode !== 'playing') return;
    this.hearts = Math.max(0, this.hearts - 1);
    this.recover(this.hearts === 0);
  }
  private recover(nap: boolean): void {
    this.combat.cancelCharge();
    const bossRetry = this.combat.boss.active;
    if (bossRetry) {
      this.combat.retry();
      save.updateRun({ checkpoint: { x: 3590, y: 640, id: 'checkpoint-boss' } });
    }
    if (nap || bossRetry) this.hearts = this.maxHearts;
    this.invulnerableUntil = this.elapsed + 1600;
    audio.play('stumble');
    const cp = save.data.run.checkpoint;
    this.player.respawn(cp.id === 'start' ? this.level.spawn.x : cp.x, cp.id === 'start' ? this.level.spawn.y : cp.y);
    this.player.pose(nap ? 'sleep' : 'stumble', 650);
    this.cameras.main.setBounds(0, 0, this.level.width, 768).setFollowOffset(-150, 200);
    this.notify(bossRetry ? '精神恢復！往右立即重試，果實能力仍保留。' : nap ? '打個小盹，精神恢復！' : '回到安全的肉球記號旁。');
    this.persist(); this.events.emit('progress');
  }
  sparkle(x: number, y: number, color = 0xffd37f, count = 8): void {
    if (save.data.settings.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const dot = this.add.rectangle(x, y, i % 3 === 0 ? 6 : 3, i % 3 === 0 ? 6 : 3, color).setDepth(35);
      this.tweens.add({ targets: dot, x: x + Math.cos(i * 2.4) * (18 + i * 3), y: y - 18 - (i % 5) * 10, alpha: 0, duration: 550 + i * 30, onComplete: () => dot.destroy() });
    }
  }
  private finish(): void {
    this.setMode('complete'); this.player.pose('victory', 999999); audio.play('victory');
    save.completeStage({ fish: this.fish, stars: this.stars, secrets: this.secrets, time: this.elapsed }, this.stage.id);
    this.sparkle(this.player.x, this.player.y - 60, 0xffd373, 18);
    this.events.emit('stage-complete');
  }
  update(time: number, delta: number): void {
    if (!this.controls || !this.player) return;
    if (this.controls.consumePause()) {
      this.togglePause();
    }
    if (this.mode === 'dialogue') { if (this.controls.consumeInteract() || this.controls.consumeJump()) this.dialogue.next(); return; }
    if (this.mode !== 'playing') return;
    this.elapsed += Math.min(delta, 100); this.autosave += delta;
    this.player.element = this.combat.fruit;
    this.player.update(time, delta); this.interactions.update();
    if (this.world instanceof StageWorld) this.world.update(time, Math.min(delta, 50));
    if (this.controls.consumeInteract() && !this.interactions.tryInteract()) this.combat.attack();
    if (this.mode !== 'playing') return;
    if (this.controls.consumeSpecial()) this.combat.beginCharge();
    if (this.controls.consumeSwitchFruit()) this.combat.toggleFruit();
    this.combat.update(time, Math.min(delta, 50));
    this.player.setAlpha(this.elapsed < this.invulnerableUntil && Math.floor(this.elapsed / 100) % 2 === 0 ? .5 : 1);
    this.drawPlayerEffects();
    if (this.player.x < 25) this.player.x = 25;
    if (this.player.y > 820) this.stumble();
    this.player.x = Math.min(this.level.width - 32, this.player.x);
    if (this.combat.boss.active) this.player.x = Math.max(3560, this.player.x);
    for (const cp of this.level.checkpoints) {
      if (Math.abs(this.player.x - cp.x) < 42 && Math.abs(this.player.y - cp.y) < 70 && save.data.run.checkpoint.id !== cp.id) {
        save.updateRun({ checkpoint: { x: cp.x, y: cp.y, id: cp.id }, hearts: this.maxHearts, elapsed: this.elapsed });
        this.hearts = this.maxHearts; audio.play('checkpoint'); this.sparkle(cp.x, cp.y - 50); this.notify('已儲存進度 · 生命完全回復'); this.events.emit('progress');
      }
    }
    if (this.autosave > 2500) { this.autosave = 0; this.persist(); }
  }
  private drawPlayerEffects(): void {
    const g = this.elementOverlay.clear(), p = this.player;
    if (this.combat.fruit && this.combat.fruit !== 'fire') {
      const colors = { wind: 0xaff1cd, water: 0x8cdcf5, lightning: 0xffe485, earth: 0xd9b78b };
      const color = colors[this.combat.fruit];
      g.lineStyle(2, color, .85).strokeEllipse(p.x, p.y - 8, 53, 13);
      if (this.combat.shieldActive) g.lineStyle(3, color, .75).strokeCircle(p.x, p.y - 25, 34);
    }
    if (this.combat.fruit === 'fire') {
      const pulse = save.data.settings.reducedMotion ? 0 : Math.sin(this.elapsed / 140) * 2;
      g.fillStyle(0xff984b, .15).fillEllipse(p.x, p.y - 5, 55 + pulse, 14);
      g.lineStyle(2, 0xffb665, .8).strokeEllipse(p.x, p.y - 5, 45 + pulse, 9);
      for (let i = 0; i < 3; i++) {
        const rise = save.data.settings.reducedMotion ? 8 : (this.elapsed / 35 + i * 12) % 32;
        g.fillStyle(i === 1 ? 0xffda84 : 0xff974c, 1 - rise / 40).fillRect(p.x - 16 + i * 15, p.y - 7 - rise, 3, 4);
      }
    }
  }
}
