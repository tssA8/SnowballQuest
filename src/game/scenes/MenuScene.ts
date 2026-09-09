import Phaser from 'phaser';
import { button, panel, text } from '../ui/widgets';
import { audio, save } from '../services';

export class MenuScene extends Phaser.Scene {
  private chapterPanel?: Phaser.GameObjects.Container;
  constructor() { super('Menu'); }
  create(): void {
    this.chapterPanel = undefined;
    this.cameras.main.setBackgroundColor(0xe5d3b1);
    const g = this.add.graphics();
    g.fillStyle(0xd9c5a1).fillRect(0, 500, 1280, 220);
    for (let x = 0; x < 1280; x += 32) {
      g.fillStyle(0xf5e6c8, .6).fillRect(x, 0, 2, 497);
      for (let y = 65; y < 490; y += 70) g.fillStyle(0xc4b597, .4).fillRect(x + 15, y, 3, 7).fillRect(x + 12, y + 3, 9, 2);
    }
    g.fillStyle(0x977758).fillRect(0, 498, 1280, 10).fillRect(0, 631, 1280, 12);
    g.fillStyle(0xbd9671).fillRect(0, 643, 1280, 77);
    for (let y = 643; y < 720; y += 26) { g.fillStyle(0x84654d).fillRect(0, y, 1280, 2); for (let x = (y % 2) * 70; x < 1280; x += 160) g.fillRect(x, y, 2, 26); }
    this.add.image(920, 455, 'window').setOrigin(.5, 1);
    this.add.image(970, 642, 'sofa').setOrigin(.5, 1);
    this.add.image(726, 640, 'lamp').setOrigin(.5, 1);
    this.add.image(1210, 640, 'plant').setOrigin(.5, 1);
    this.add.image(947, 660, 'rug').setOrigin(.5, 1);
    this.add.image(965, 584, 'cushion').setOrigin(.5, 1);
    this.add.sprite(963, 560, 'snowball').setOrigin(.5, 1).setScale(2).play('snowball-sleep');
    this.add.image(1125, 632, 'yarn'); this.add.image(800, 630, 'plush');
    this.add.image(805, 558, 'treat-box').setOrigin(.5, 1);
    const zzz = text(this, 1020, 455, 'z z Z', 22, '#a49391');
    if (!save.data.settings.reducedMotion) this.tweens.add({ targets: zzz, y: 442, alpha: .3, duration: 2500, yoyo: true, repeat: -1 });
    // Title UI is built independently of the scene artwork.
    text(this, 86, 68, 'A COZY LITTLE PIXEL ADVENTURE', 11, '#957c61').setLetterSpacing(3);
    text(this, 80, 109, 'SNOWBALL', 64, '#55473d').setStroke('#f7e7c6', 3);
    text(this, 82, 174, 'QUEST', 89, '#a56f4f').setStroke('#fae8be', 4);
    text(this, 86, 279, 'Fluffy cat. Big adventure.', 18, '#7a6451');
    text(this, 86, 335, 'An empty treat box. A tiny act of kindness.\nA very good day waiting to happen.', 14, '#8e7660');
    const begin = (fresh: boolean): void => {
      void audio.unlock();
      if (fresh) save.resetRun({ x: 160, y: 640, id: 'start' });
      this.scene.start('Home');
    };
    button(this, 257, 437, 'START ADVENTURE     →', () => begin(true), 342);
    const hasRun = save.data.run.elapsed > 0 || save.data.run.collected.length > 0;
    const continueButton = button(this, 257, 503, 'CONTINUE YOUR DAY', () => { if (hasRun) begin(false); }, 342, false);
    if (!hasRun) { continueButton.setAlpha(.42); continueButton.disableInteractive(); }
    button(this, 166, 568, 'CHAPTERS', () => this.chapters(), 160, false);
    button(this, 348, 568, 'SOUND: ' + (save.data.settings.sfx > 0 ? 'ON' : 'OFF'), () => {
      const on = save.data.settings.sfx > 0; save.setSettings({ sfx: on ? 0 : .5, music: on ? 0 : .25 }); audio.setSettings(save.data.settings); this.scene.restart();
    }, 160, false);
    text(this, 86, 637, 'CHAPTER 01  /  THE EMPTY TREAT BOX', 10, '#f5e5c9');
    text(this, 1090, 691, 'GOOD CAT. BETTER DAYS.', 10, '#765d4a').setOrigin(.5).setLetterSpacing(1);
    this.input.keyboard?.once('keydown-ENTER', () => begin(!hasRun));
  }
  private chapters(): void {
    if (this.chapterPanel?.active) return;
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x2f2b36, .6).setInteractive();
    const content = this.add.container(0, 0, [shade, panel(this, 325, 104, 630, 518)]);
    this.chapterPanel = content;
    content.add(text(this, 640, 145, 'SMALL PLACES. BIG DAYS.', 25).setOrigin(.5));
    const rows = ['01   HOME — THE EMPTY TREAT BOX', '02   ROOFTOPS — COMING LATER', '03   SNOWBALL CAFÉ — COMING LATER', '04   MOONLIGHT GARDEN — COMING LATER'];
    rows.forEach((row, i) => content.add(text(this, 387, 220 + i * 60, row, 17, i === 0 ? '#9e664e' : '#ac9e88')));
    content.add(button(this, 640, 525, 'BACK TO THE CUSHION', () => content.destroy(), 410));
    content.add(text(this, 640, 582, 'Home is ready to explore. The rest is still dreaming.', 11, '#9b836c').setOrigin(.5));
  }
  handleBack(): boolean {
    if (!this.chapterPanel?.active) return false;
    this.chapterPanel.destroy(); this.chapterPanel = undefined;
    return true;
  }
}
