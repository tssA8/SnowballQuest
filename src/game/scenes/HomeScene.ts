import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InputSystem } from '../systems/InputSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { DialogueSystem, DIALOGUE, type Dialogue } from '../systems/DialogueSystem';
import { loadLevel, type LevelData, type LevelObject } from '../data/level';
import { HomeWorld } from '../world/HomeWorld';
import { Interactions } from '../world/Interactions';
import { save, audio } from '../services';

export type GameMode = 'playing' | 'dialogue' | 'paused' | 'complete';
export class HomeScene extends Phaser.Scene {
  player!: Player;
  controls!: InputSystem;
  world!: HomeWorld;
  level!: LevelData;
  missions!: MissionSystem;
  dialogue!: DialogueSystem;
  interactions!: Interactions;
  mode: GameMode = 'playing';
  hearts = 5;
  elapsed = 0;
  private invulnerableUntil = 0;
  private autosave = 0;
  private vacuum?: Phaser.Physics.Arcade.Sprite;
  private vacuumData?: LevelObject;
  private modeBeforePause: 'playing' | 'dialogue' = 'playing';
  private onBlur = (): void => { this.pause(); this.controls.clear(); this.persist(); };
  constructor() { super('Home'); }

  create(): void {
    this.level = loadLevel(this);
    this.mode = 'playing'; this.autosave = 0; this.invulnerableUntil = 0;
    this.hearts = save.data.run.hearts; this.elapsed = save.data.run.elapsed;
    this.world = new HomeWorld(this, this.level);
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
    this.spawnCollectibles(); this.spawnVacuum();
    for (const cpObj of this.level.checkpoints) {
      const flag = this.add.image(cpObj.x, cpObj.y, 'checkpoint').setOrigin(.5, 1).setDepth(10);
      if (cp.id === cpObj.id) flag.setTint(0xffd779);
    }
    for (const flag of this.level.exits) this.add.image(flag.x, flag.y, 'flag').setOrigin(.5, 1).setDepth(10);
    this.events.on('player-jumped', (x: number, y: number) => { audio.play('jump'); this.sparkle(x, y, 0xf9e7c7, 5); });
    this.events.on('player-landed', (x: number, y: number) => this.sparkle(x, y, 0xe4c9a4, 3));
    this.events.on('player-dashed', (x: number, y: number) => this.sparkle(x, y - 15, 0xffebd7, 8));
    this.dialogue.on('close', () => this.setMode('playing'));
    this.scene.launch('HUD');
    audio.startMusic();
    window.addEventListener('blur', this.onBlur);
    this.events.once('shutdown', () => {
      this.persist(); this.scene.stop('HUD'); window.removeEventListener('blur', this.onBlur);
      this.dialogue.removeAllListeners(); this.events.removeAllListeners('player-jumped');
      this.events.removeAllListeners('player-landed'); this.events.removeAllListeners('player-dashed');
    });
    if (!this.hasFlag('intro-seen')) {
      this.time.delayedCall(500, () => { if (this.mode === 'playing') { this.setFlag('intro-seen'); this.say(DIALOGUE.intro); } });
    }
  }
  get fish(): number { return save.data.run.collected.filter(id => id.startsWith('fish-')).length; }
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
  replay(): void { this.hearts = 5; this.elapsed = 0; save.resetRun({ x: this.level.spawn.x, y: this.level.spawn.y, id: 'start' }); this.scene.restart(); }
  menu(): void { this.persist(); this.scene.start('Menu'); }
  collect(id: string, type: string, x: number, y: number, secret?: string): void {
    if (save.data.run.collected.includes(id)) return;
    save.collect(id);
    if (secret) this.setFlag(secret);
    if (type === 'key') { this.setFlag('key-found'); this.notify('BALCONY KEY FOUND'); audio.play('bell'); }
    else if (type === 'heart') { this.hearts = Math.min(5, this.hearts + 1); audio.play('bell'); }
    else if (type === 'star') { audio.play('star'); this.notify('A LITTLE MORE HAPPINESS  ★'); }
    else if (type === 'feather') { audio.play('bell'); this.notify(this.feathers === 3 ? 'ALL FEATHERS FOUND · CROWN SPARKLE UNLOCKED' : 'SOFT. IMPORTANT. COLLECTED.'); }
    else audio.play('fish');
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
  private spawnVacuum(): void {
    this.vacuumData = this.level.npcs.find(o => o.type === 'robot-vacuum');
    if (!this.vacuumData) return;
    const obj = this.vacuumData;
    this.vacuum = this.physics.add.sprite(obj.x, obj.y, 'vacuum').setOrigin(.5, 1).setDepth(12).setImmovable(true);
    const body = this.vacuum.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setSize(54, 22).setOffset(5, 10);
    this.vacuum.setVelocityX(Number(obj.properties.speed ?? 42));
    this.physics.add.overlap(this.player, this.vacuum, () => { if (this.mode === 'playing' && !this.player.isDashing) this.stumble(); });
  }
  stumble(): void {
    if (this.time.now < this.invulnerableUntil || this.mode !== 'playing') return;
    this.invulnerableUntil = this.time.now + 2400;
    this.hearts--;
    const nap = this.hearts <= 0;
    if (nap) this.hearts = 5;
    audio.play('stumble');
    this.sparkle(this.player.x, this.player.y - 24, 0xe8b5a6, 8);
    const cp = save.data.run.checkpoint;
    this.player.respawn(cp.id === 'start' ? this.level.spawn.x : cp.x, cp.id === 'start' ? this.level.spawn.y : cp.y);
    this.player.pose(nap ? 'sleep' : 'stumble', 650);
    this.notify(nap ? 'Snowball needs a tiny nap. All better now.' : 'A tiny stumble. Back to a cozy spot.');
    this.tweens.add({ targets: this.player, alpha: .45, yoyo: true, repeat: 4, duration: 140, onComplete: () => this.player.setAlpha(1) });
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
    save.completeStage({ fish: this.fish, stars: this.stars, secrets: this.secrets, time: this.elapsed });
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
    this.player.update(time, delta); this.interactions.update();
    if (this.player.x < 25) this.player.x = 25;
    if (this.player.y > 820) this.stumble();
    if (this.vacuum && this.vacuumData) {
      if (this.vacuum.x > Number(this.vacuumData.properties.patrolMax)) this.vacuum.setVelocityX(-42);
      if (this.vacuum.x < Number(this.vacuumData.properties.patrolMin)) this.vacuum.setVelocityX(42);
    }
    for (const cp of this.level.checkpoints) {
      if (Math.abs(this.player.x - cp.x) < 42 && Math.abs(this.player.y - cp.y) < 70 && save.data.run.checkpoint.id !== cp.id) {
        save.updateRun({ checkpoint: { x: cp.x, y: cp.y, id: cp.id }, hearts: 5, elapsed: this.elapsed });
        this.hearts = 5; audio.play('checkpoint'); this.sparkle(cp.x, cp.y - 50); this.notify('CHECKPOINT · FIVE FRESH HEARTS'); this.events.emit('progress');
      }
    }
    for (const flag of this.level.exits) {
      if (this.hasFlag('balcony-open') && Math.abs(this.player.x - flag.x) < 50 && Math.abs(this.player.y - flag.y) < 90) this.finish();
    }
    if (this.autosave > 2500) { this.autosave = 0; this.persist(); }
  }
}
