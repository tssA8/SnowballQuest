import Phaser from 'phaser';
import { button, panel, text } from '../ui/widgets';
import { audio, save } from '../services';
import { STAGES } from '../data/stages';

export class MenuScene extends Phaser.Scene {
  private chapterPanel?: Phaser.GameObjects.Container;
  constructor() { super('Menu'); }
  create(): void {
    this.chapterPanel = undefined;
    const chapter = document.querySelector('.chapter');
    if (chapter) chapter.textContent = '七次出勤 · 五元素冒險';
    const caption = document.querySelector('.game-caption > span:first-child');
    if (caption) caption.textContent = '從沙發底下，到夜空中的回家路';
    this.cameras.main.setBackgroundColor(0xeadbc0);
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
    const ship = this.add.image(804, 613, 'ship-icon');
    ship.setScale(63 / Math.max(ship.width, ship.height));
    this.add.image(1125, 632, 'yarn'); this.add.image(800, 630, 'plush');
    this.add.image(805, 558, 'treat-box').setOrigin(.5, 1);
    const zzz = text(this, 1020, 455, 'z z Z', 22, '#a49391');
    if (!save.data.settings.reducedMotion) this.tweens.add({ targets: zzz, y: 442, alpha: .3, duration: 2500, yoyo: true, repeat: -1 });
    // Title UI is built independently of the scene artwork.
    text(this, 86, 66, 'SNOW-01  /  祕密巡邏隊', 13, '#95745f').setLetterSpacing(2);
    text(this, 80, 107, 'SNOWBALL', 68, '#493c48').setStroke('#fff0d5', 3);
    text(this, 82, 178, 'QUEST', 85, '#9e6d54').setStroke('#fff0d5', 3);
    text(this, 86, 288, '雪球的祕密出勤', 27, '#695263').setLetterSpacing(4);
    text(this, 86, 345, '主人出門了。社區裡的警報，也響了。\n一隻看起來不太有幹勁的貓，準備拯救今天。', 17, '#806960');
    const begin = (fresh: boolean): void => {
      void audio.unlock();
      if (fresh && !save.startStage('home')) return;
      this.scene.start('Home');
    };
    button(this, 267, 452, save.data.stages.home?.completed ? '從第一站，再出發     →' : '第一次出勤     →', () => begin(true), 362);
    const hasRun = save.data.run.elapsed > 0 || save.data.run.collected.length > 0 || save.data.currentStage !== 'home';
    const continueButton = button(this, 267, 518, '繼續上次的出勤', () => { if (hasRun) begin(false); }, 362, false);
    if (!hasRun) { continueButton.setAlpha(.42); continueButton.disableInteractive(); }
    button(this, 170, 584, '星圖・飛船名冊', () => this.chapters(), 168, false);
    button(this, 362, 584, '聲音：' + (save.data.settings.sfx > 0 ? '開啟' : '關閉'), () => {
      const on = save.data.settings.sfx > 0; save.setSettings({ sfx: on ? 0 : .5, music: on ? 0 : .25 }); audio.setSettings(save.data.settings); this.scene.restart();
    }, 172, false);
    const completed = STAGES.filter(stage => save.data.stages[stage.id]?.completed).length;
    text(this, 86, 644, completed === STAGES.length ? '七次出勤完成  /  自由巡邏已開啟' : `出勤紀錄  ${completed} / ${STAGES.length}  ·  同伴正在等你`, 14, '#fff0d8');
    text(this, 1004, 690, '主人不在家，才是上班時間。', 13, '#765d4a').setOrigin(.5);
    const enter = (): void => { if (!this.chapterPanel?.active) begin(!hasRun); };
    this.input.keyboard?.on('keydown-ENTER', enter);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ENTER', enter));
    if (this.registry.get('open-star-map')) {
      this.registry.remove('open-star-map');
      this.chapters();
    }
  }
  private chapters(): void {
    if (this.chapterPanel?.active) return;
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x2f2b36, .6).setInteractive();
    const content = this.add.container(0, 0, [shade, panel(this, 135, 40, 1010, 640)]).setDepth(20);
    this.chapterPanel = content;
    content.add(text(this, 177, 70, 'SNOW-01  /  出勤星圖', 13, '#95745f').setLetterSpacing(2));
    content.add(text(this, 177, 98, '七次出勤，一條回家的路。', 28));
    const completed = STAGES.filter(stage => save.data.stages[stage.id]?.completed).length;
    content.add(text(this, 1101, 104, `${completed} / 7  完成`, 18, '#8d7769').setOrigin(1, 0));
    STAGES.forEach((stage, i) => {
      const y = 190 + i * 53;
      const unlocked = save.data.unlockedStages.includes(stage.id);
      const cleared = save.data.stages[stage.id]?.completed;
      const background = this.add.rectangle(640, y, 922, 45, unlocked ? cleared ? 0xe7dec6 : 0x695263 : 0xe7dbc8)
        .setStrokeStyle(1, unlocked ? 0x9c8275 : 0xcabb9f);
      const row = this.add.container(0, 0, [background,
        text(this, 200, y - 11, String(stage.index).padStart(2, '0'), 17, unlocked && !cleared ? '#ead0a8' : '#9b8b7d'),
        text(this, 254, y - 12, stage.title, 19, unlocked && !cleared ? '#fff0d8' : unlocked ? '#695263' : '#9b8b7d'),
        text(this, 740, y - 9, unlocked ? stage.bossName : '通過前一關後解鎖', 14, unlocked && !cleared ? '#d4bac4' : '#9b8b7d'),
        text(this, 1076, y - 10, cleared ? '✓ 完成 · 重遊' : unlocked ? '出勤 →' : '尚未解鎖', 15, unlocked && !cleared ? '#ffdc9c' : '#9b8b7d').setOrigin(1, 0),
      ]);
      if (unlocked) {
        background.setInteractive({ useHandCursor: true });
        background.on('pointerover', () => background.setAlpha(.8));
        background.on('pointerout', () => background.setAlpha(1));
        background.on('pointerup', () => {
          if (!save.startStage(stage.id)) return;
          void audio.unlock(); this.scene.start('Home');
        });
      }
      content.add(row);
    });
    content.add(text(this, 640, 555, completed === 7 ? '自由巡邏：帶著全部同伴與元素，重新拜訪每個地方。' : '打贏魔王即可前往下一站；收集與支線自由選擇。', 13, '#8d7769').setOrigin(.5));
    content.add(button(this, 420, 613, `飛船名冊 · ${save.data.unlockedSupport.length} 位新朋友`, () => {
      content.destroy(); this.crew();
    }, 402));
    content.add(button(this, 861, 613, '回到主畫面', () => content.destroy(), 402, false));
    content.add(text(this, 640, 657, '點選已解鎖的目的地，即可重新開始該次出勤。', 12, '#9b8b7d').setOrigin(.5));
  }

  private crew(): void {
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x2f2b36, .6).setInteractive();
    const content = this.add.container(0, 0, [shade, panel(this, 135, 40, 1010, 640)]).setDepth(20);
    this.chapterPanel = content;
    content.add(text(this, 177, 70, 'SNOW-01  /  飛船名冊', 13, '#95745f').setLetterSpacing(2));
    content.add(text(this, 177, 98, '多一位朋友，飛船就更像家。', 27));
    content.add(text(this, 1101, 106, `徽章 ${save.data.bossBadges.length} / 7`, 16, '#8d7769').setOrigin(1, 0));
    STAGES.forEach((stage, i) => {
      const x = 177 + i % 4 * 235, y = 160 + Math.floor(i / 4) * 184;
      const joined = save.data.unlockedSupport.includes(stage.id);
      const badge = save.data.bossBadges.includes(stage.id);
      content.add(panel(this, x, y, 216, 162, joined ? 0xfbf0d9 : 0xe5dac7));
      const icon = this.add.image(x + 52, y + 55, stage.bossKey, joined ? 7 : 0);
      icon.setScale(76 / Math.max(icon.width, icon.height));
      if (!joined) icon.setTint(0x86808b).setAlpha(.5);
      content.add(icon);
      content.add(text(this, x + 99, y + 27, joined ? stage.bossName : '等待相遇', 17, joined ? '#695263' : '#9b8b7d').setWordWrapWidth(106));
      content.add(text(this, x + 99, y + 73, badge ? '✦ 徽章已收錄' : `第 ${stage.index} 次出勤`, 12, '#a08365'));
      content.add(text(this, x + 15, y + 103, joined ? stage.reward : '解除失控裝置，邀請這位新朋友一起返航。', 12, joined ? '#8b7169' : '#a09181').setWordWrapWidth(187, true));
    });
    const aiX = 882, aiY = 344;
    content.add(panel(this, aiX, aiY, 216, 162));
    const ai = this.add.image(aiX + 53, aiY + 55, 'portrait-ai');
    ai.setScale(71 / Math.max(ai.width, ai.height)); content.add(ai);
    content.add(text(this, aiX + 101, aiY + 30, '小鈴', 18));
    content.add(text(this, aiX + 101, aiY + 72, '隨時待命', 12, '#a08365'));
    content.add(text(this, aiX + 15, aiY + 110, '導航、報時，以及提醒雪球：\n再晚一點就趕不上晚餐了。', 12, '#8b7169'));
    content.add(text(this, 179, 552, '元素收藏', 15, '#8d7769'));
    const elements = [['fire', '火焰', 0xe99b72], ['wind', '風', 0xa8cbbc], ['water', '水', 0x8ebee7], ['lightning', '雷電', 0xe6cc78], ['earth', '大地', 0xb4ac81]] as const;
    elements.forEach(([fruit, label, color], i) => {
      const x = 362 + i * 150;
      const owned = save.data.unlockedFruits.includes(fruit);
      const key = fruit === 'fire' ? 'fire-fruit' : `fruit-${fruit}`;
      const icon = this.add.image(x, 563, this.textures.exists(key) ? key : 'fire-fruit');
      icon.setScale(31 / Math.max(icon.width, icon.height)).setAlpha(owned ? 1 : .25);
      if (!this.textures.exists(key)) icon.setTint(color);
      content.add([icon, text(this, x + 24, 553, label, 14, owned ? '#695263' : '#a99a86')]);
    });
    content.add(button(this, 640, 623, '回到出勤星圖', () => { content.destroy(); this.chapters(); }, 402, false));
  }
  handleBack(): boolean {
    if (!this.chapterPanel?.active) return false;
    this.chapterPanel.destroy(); this.chapterPanel = undefined;
    return true;
  }
}
