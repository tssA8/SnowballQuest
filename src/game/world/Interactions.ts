import Phaser from 'phaser';
import type { HomeScene } from '../scenes/HomeScene';
import type { LevelObject } from '../data/level';
import { DIALOGUE } from '../systems/DialogueSystem';
import { audio, save } from '../services';
import { text } from '../ui/widgets';

const TEXTURES: Record<string, string> = {
  'feather-wand': 'wand', 'yarn-ball': 'yarn', 'plush-mouse': 'plush', 'bell-ball': 'bell-ball',
  'scratching-board': 'scratch', 'cat-tunnel': 'tunnel', 'toy-box': 'toy-box', door: 'door', mouse: 'mouse', 'sleepy-cat': 'sleepy-cat',
};
const LABELS: Record<string, string> = {
  'feather-wand': 'PLAY', 'yarn-ball': 'ROLL', 'plush-mouse': 'PICK UP', 'bell-ball': 'RING',
  'scratching-board': 'SCRATCH', 'cat-tunnel': 'EXPLORE', 'toy-box': 'OPEN', door: 'UNLOCK', mouse: 'TALK', 'sleepy-cat': 'WHISPER',
};
export class Interactions {
  private objects: { data: LevelObject; sprite: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Image }[] = [];
  private prompt: Phaser.GameObjects.Container;
  private promptText: Phaser.GameObjects.Text;
  private barrier?: Phaser.GameObjects.Zone;
  private nearest?: typeof this.objects[number];
  private sleepyCount = 0;
  private lastRing = 0;
  constructor(private readonly scene: HomeScene) {
    const balls = scene.physics.add.group({ dragX: 85, bounceX: .7, bounceY: .2 });
    scene.physics.add.collider(balls, scene.world.solids);
    scene.physics.add.collider(balls, scene.world.oneWays);
    scene.physics.add.collider(scene.player, balls, (_p, ball) => {
      const b = ball as Phaser.Physics.Arcade.Image;
      b.setVelocityX(scene.player.facing * 110);
      if (b.getData('bell') && scene.time.now > this.lastRing + 650) { audio.play('bell'); this.lastRing = scene.time.now; }
    });
    for (const obj of [...scene.level.objects, ...scene.level.npcs]) {
      const key = TEXTURES[obj.type];
      if (!key || (obj.type === 'plush-mouse' && scene.hasFlag('plush-carried'))) continue;
      let sprite: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Image;
      if (obj.type === 'yarn-ball' || obj.type === 'bell-ball') {
        sprite = scene.physics.add.image(obj.x, obj.y - 16, key).setDepth(12);
        balls.add(sprite);
        (sprite as Phaser.Physics.Arcade.Image).setCircle(13, 3, 3).setDragX(90).setBounce(.3, .15);
        sprite.setData('bell', obj.type === 'bell-ball');
      } else sprite = scene.add.image(obj.x, obj.y, key).setOrigin(.5, 1).setDepth(obj.type === 'door' ? 9 : 12);
      if (obj.type === 'door') {
        if (!scene.hasFlag('balcony-open')) {
          this.barrier = scene.add.zone(obj.x, 320, 20, 640);
          scene.physics.add.existing(this.barrier, true);
          scene.physics.add.collider(scene.player, this.barrier);
        } else sprite.setAlpha(.35);
      }
      if (obj.type === 'toy-box' && scene.hasFlag('box-open')) sprite.setTint(0xffe399);
      this.objects.push({ data: obj, sprite });
    }
    const plate = scene.add.rectangle(0, 0, 160, 32, 0x433c39, .92).setStrokeStyle(1, 0xffe8b8);
    this.promptText = text(scene, 0, 0, '', 13, '#fff0d4').setOrigin(.5);
    this.prompt = scene.add.container(0, 0, [plate, this.promptText]).setDepth(60).setVisible(false);
  }
  update(): void {
    const p = this.scene.player;
    this.nearest = this.objects.filter(obj => obj.sprite.active && Math.abs(obj.sprite.x - p.x) < 88 && Math.abs(obj.data.y - p.y) < 90)
      .sort((a, b) => Math.abs(a.sprite.x - p.x) - Math.abs(b.sprite.x - p.x))[0];
    this.prompt.setVisible(Boolean(this.nearest));
    if (this.nearest) {
      this.prompt.setPosition(Math.max(92, this.nearest.sprite.x), this.nearest.data.y - 106);
      const label = this.nearest.data.type === 'mouse' && this.scene.hasFlag('plush-carried') && !this.scene.hasFlag('mouse-helped') ? 'DELIVER' : LABELS[this.nearest.data.type];
      this.promptText.setText(`[ E ]  ${label}`);
    }
    if (this.scene.controls.consumeInteract() && this.nearest) this.interact(this.nearest);
    for (const entry of this.objects) {
      if (entry.sprite.body && entry.sprite.y > 820) {
        (entry.sprite as Phaser.Physics.Arcade.Image).setPosition(entry.data.x, entry.data.y - 16).setVelocity(0, 0);
      }
    }
  }
  private interact(entry: typeof this.objects[number]): void {
    const { data: obj, sprite } = entry;
    const s = this.scene;
    s.player.pose('interact', 450); audio.play('click');
    switch (obj.type) {
      case 'mouse':
        if (s.hasFlag('mouse-helped')) s.say({ speaker: 'MOUSE COURIER', lines: ['A hero. A very fluffy, very judgmental hero.\nYour star is waiting in the toy box.'] });
        else if (s.hasFlag('plush-carried')) { s.setFlag('mouse-helped'); s.say(DIALOGUE.delivered); s.sparkle(obj.x, obj.y - 35); }
        else { s.setFlag('mouse-met'); s.say(DIALOGUE.mouse); }
        break;
      case 'plush-mouse':
        s.setFlag('plush-carried'); sprite.destroy(); s.notify('PLUSH FRIEND FOUND · BRING IT TO THE MOUSE'); audio.play('bell'); break;
      case 'scratching-board':
        s.setFlag('scratched'); s.say(DIALOGUE.scratch); s.sparkle(obj.x, obj.y - 16, 0xe0c19a); break;
      case 'toy-box': {
        if (s.hasFlag('box-open')) { s.notify('The box is full of possibilities. And lint.'); break; }
        const required = String(obj.properties.requires ?? 'mouse-helped,scratched').split(',');
        if (!required.every(flag => s.hasFlag(flag))) {
          s.say({ speaker: 'THE TOY BOX', lines: [!s.hasFlag('mouse-helped') ? 'A tiny note: “Opens for a helpful cat.”\nThe mouse might need a paw.' : 'A tiny note: “One good scratch should do it.”\nTry the board beside the cat tower.'] }); break;
        }
        s.setFlag('box-open'); s.collect(String(obj.properties.reward ?? 'star-box'), 'star', obj.x, obj.y - 40);
        sprite.setTint(0xffdf85); s.say(DIALOGUE.box); break;
      }
      case 'door': {
        if (s.hasFlag('balcony-open')) { s.notify('A brighter tomorrow is just outside.'); break; }
        const required = String(obj.properties.requires ?? 'key-found,mouse-helped,box-open').split(',');
        if (!required.every(flag => s.hasFlag(flag))) {
          s.say({ speaker: 'BALCONY DOOR', lines: [!s.hasFlag('key-found') ? 'Locked. The key is near the very top\nof the cat tower.' : !s.hasFlag('mouse-helped') ? 'One more small kindness before you go.\nBring the plush friend back to the mouse.' : 'Happiness first. Open the toy box\nand collect its star before heading outside.'] }); break;
        }
        s.setFlag('balcony-open'); this.barrier?.destroy(); sprite.setAlpha(.35); audio.play('door');
        s.notify('THE BALCONY IS OPEN · FOLLOW THE GOLDEN FISH'); s.sparkle(obj.x, obj.y - 80); break;
      }
      case 'cat-tunnel':
        s.player.respawn(Number(obj.properties.targetX), Number(obj.properties.targetY));
        if (obj.properties.secretId && !s.hasFlag(String(obj.properties.secretId))) {
          s.setFlag(String(obj.properties.secretId)); s.say(DIALOGUE.tunnel);
        } else s.notify('A shortcut, with excellent acoustics.');
        s.sparkle(s.player.x, s.player.y - 25); audio.play('bell'); break;
      case 'sleepy-cat':
        this.sleepyCount++;
        s.say({ speaker: 'PROFESSIONAL NAPPER', lines: [this.sleepyCount > 3 ? 'Achievement: PROFESSIONAL NAPPER.\nA lifetime of doing absolutely enough.' : this.sleepyCount > 1 ? 'Extremely sleeping.\nVery committed.' : 'Still sleeping.'] }); break;
      case 'yarn-ball': case 'bell-ball':
        (sprite as Phaser.Physics.Arcade.Image).setVelocity(s.player.facing * 200, -85); s.setFlag('yarn-played');
        s.notify(obj.type === 'bell-ball' ? 'Ding. A very important announcement.' : 'Gravity: the best cat toy.'); audio.play('bell'); break;
      case 'feather-wand':
        s.tweens.add({ targets: sprite, angle: 18, duration: 230, yoyo: true, repeat: 2, onComplete: () => sprite.setAngle(0) });
        s.sparkle(sprite.x, sprite.y - 100, 0xe1a5b4); s.notify('A worthy opponent. It is a feather.'); audio.play('meow'); break;
    }
    save.save();
  }
}
