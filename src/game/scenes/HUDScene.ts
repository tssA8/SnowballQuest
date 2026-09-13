import Phaser from 'phaser';
import { HomeScene, type GameMode } from './HomeScene';
import { MobileControls } from '../ui/MobileControls';
import { button, panel, text } from '../ui/widgets';
import { audio, save } from '../services';
import { Capacitor } from '@capacitor/core';
import { STAGES } from '../data/stages';

const ELEMENTS: Record<string, { name: string; key: string; color: number }> = {
  fire: { name: '火焰果實', key: 'fire-fruit', color: 0xe99b72 },
  wind: { name: '風果實', key: 'fruit-wind', color: 0xa8cbbc },
  water: { name: '水果實', key: 'fruit-water', color: 0x8ebee7 },
  lightning: { name: '雷電果實', key: 'fruit-lightning', color: 0xe6cc78 },
  earth: { name: '大地果實', key: 'fruit-earth', color: 0xb4ac81 },
};

export class HUDScene extends Phaser.Scene {
  private home!: HomeScene;
  private hearts!: Phaser.GameObjects.Text;
  private counts: Phaser.GameObjects.Text[] = [];
  private mission!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private energyFill!: Phaser.GameObjects.Rectangle;
  private elementText!: Phaser.GameObjects.Text;
  private elementDetail!: Phaser.GameObjects.Text;
  private fruitIcon!: Phaser.GameObjects.Image;
  private chargeText!: Phaser.GameObjects.Text;
  private chargeFill!: Phaser.GameObjects.Rectangle;
  private bossPanel!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossPhase!: Phaser.GameObjects.Text;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private guide!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private mobile!: MobileControls;
  private toastTimer?: Phaser.Time.TimerEvent;
  private base!: Phaser.GameObjects.Container;
  constructor() { super('HUD'); }

  private icon(x: number, y: number, key: string, size: number, frame?: string | number): Phaser.GameObjects.Image {
    const image = this.add.image(x, y, key, frame);
    return image.setScale(size / Math.max(image.width, image.height));
  }

  private elementIcon(x: number, y: number, fruit: string, size: number): Phaser.GameObjects.Image {
    const element = ELEMENTS[fruit];
    const loaded = this.textures.exists(element.key);
    const image = this.icon(x, y, loaded ? element.key : 'fire-fruit', size);
    return loaded ? image : image.setTint(element.color);
  }

  create(): void {
    this.home = this.scene.get('Home') as HomeScene;
    const chapter = document.querySelector('.chapter');
    if (chapter) chapter.textContent = `第 ${String(this.home.stage.index).padStart(2, '0')} 次出勤 · ${this.home.stage.title}`;
    const caption = document.querySelector('.game-caption > span:first-child');
    if (caption) caption.textContent = `${this.home.stage.title} / ${this.home.stage.bossName}`;
    this.counts = [];
    this.base = this.add.container(0, 0);
    this.base.add(panel(this, 24, 20, 294, 98, 0xfff0d8, .97));
    this.base.add(this.add.circle(67, 66, 31, 0xe0d2be).setStrokeStyle(1, 0xbda47f));
    this.base.add(this.icon(67, 66, 'portrait-snowball', 59));
    this.base.add(text(this, 110, 30, '雪球', 15));
    this.base.add(text(this, 288, 33, 'SNOW-01', 10, '#8c756a').setOrigin(1, 0));
    this.hearts = text(this, 108, 51, '', 23, '#b76565');
    this.base.add(this.hearts);
    this.energyText = text(this, 110, 80, '', 14, '#74606c');
    this.base.add([this.energyText, this.add.rectangle(110, 104, 180, 6, 0xdcd0bd).setOrigin(0, .5)]);
    this.energyFill = this.add.rectangle(110, 104, 180, 6, 0xc99757).setOrigin(0, .5);
    this.base.add(this.energyFill);

    this.base.add(panel(this, 963, 24, 216, 57, 0xfff0d8, .94));
    ['fish', 'star', 'feather'].forEach((key, index) => {
      const x = 985 + index * 66;
      this.base.add(this.icon(x, 51, key, 24));
      const value = text(this, x + 17, 42, '', 16, '#77626a');
      this.counts.push(value); this.base.add(value);
    });
    this.base.add(button(this, 1227, 51, 'Ⅱ', () => this.home.togglePause(), 54, false));
    this.base.add(panel(this, 24, 135, 390, 40, 0xfff0d8, .94));
    this.mission = text(this, 40, 144, '', 18);
    this.base.add(this.mission);

    this.base.add(panel(this, 24, 437, 240, 66, 0xfff0d8, .96));
    this.chargeText = text(this, 40, 447, '', 14, '#695263');
    this.chargeFill = this.add.rectangle(40, 490, 208, 6, 0xb996cb).setOrigin(0, .5);
    this.base.add([
      this.chargeText, text(this, 40, 469, '♥ 罐頭：2 心 ＋ 20 能量', 12, '#a36170'),
      this.add.rectangle(40, 490, 208, 6, 0xdcd0bd).setOrigin(0, .5), this.chargeFill,
    ]);
    this.base.add(panel(this, 24, 513, 240, 66, 0xfff0d8, .96));
    this.fruitIcon = this.icon(59, 546, 'fire-fruit', 42);
    this.elementText = text(this, 90, 522, '', 20);
    this.elementDetail = text(this, 90, 550, '', 14, '#876d65');
    this.base.add([this.fruitIcon, this.elementText, this.elementDetail]);
    const fruitTouch = this.add.zone(144, 546, 240, 66).setInteractive({ useHandCursor: true });
    fruitTouch.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.home.mode === 'playing') this.home.controls.setTouch('switchFruit', true, pointer.id);
    });
    const releaseFruit = (pointer: Phaser.Input.Pointer): void => this.home.controls.setTouch('switchFruit', false, pointer.id);
    fruitTouch.on('pointerup', releaseFruit); fruitTouch.on('pointerout', releaseFruit);
    this.base.add(fruitTouch);

    this.bossName = text(this, 405, 30, '扳手', 18, '#fff0d8');
    this.bossPhase = text(this, 875, 32, '', 16, '#efd4a7').setOrigin(1, 0);
    this.bossFill = this.add.rectangle(405, 66, 470, 11, 0xd58c70).setOrigin(0, .5);
    this.bossPanel = this.add.container(0, 0, [
      panel(this, 386, 20, 508, 65, 0x493c48, .96), this.bossName, this.bossPhase,
      this.add.rectangle(405, 66, 470, 11, 0x302a35).setOrigin(0, .5), this.bossFill,
    ]).setVisible(false);
    this.base.add(this.bossPanel);
    this.guide = this.add.container(640, 691, [
      this.add.rectangle(0, 0, 820, 31, 0x493c48, .89),
      text(this, 0, 0, '← → 移動    空白 跳躍    J 肉球 / E 互動    按住 K 集氣，放開發射    Q 切換    Shift 衝刺    Esc 暫停', 13, '#fff0d8').setOrigin(.5),
    ]);
    this.base.add(this.guide);
    this.overlay = this.add.container(0, 0).setDepth(200);
    this.toastText = text(this, 0, 0, '', 15, '#fff0d8').setOrigin(.5).setWordWrapWidth(540, true);
    this.toast = this.add.container(640, 218, [
      this.add.rectangle(0, 0, 584, 57, 0x493c48, .96).setStrokeStyle(1, 0xe6c79b), this.toastText,
    ]).setDepth(400).setVisible(false);
    this.mobile = new MobileControls(this, this.home.controls);
    this.home.events.on('progress', this.refresh, this);
    this.home.events.on('mode', this.renderMode, this);
    this.home.events.on('toast', this.showToast, this);
    this.home.dialogue.on('change', this.renderDialogue, this);
    this.events.once('shutdown', () => {
      this.toastTimer?.remove();
      this.home.events.off('progress', this.refresh, this); this.home.events.off('mode', this.renderMode, this);
      this.home.events.off('toast', this.showToast, this); this.home.dialogue.off('change', this.renderDialogue, this);
    });
    this.refresh(); this.renderMode(this.home.mode); this.update();
  }

  private refresh(): void {
    const maxHearts = this.home.maxHearts;
    const hearts = Phaser.Math.Clamp(this.home.hearts, 0, maxHearts);
    this.hearts.setText('♥ '.repeat(hearts) + '♡ '.repeat(maxHearts - hearts));
    this.hearts.setFontSize(maxHearts > 5 ? 21 : 23);
    this.counts[0].setText(String(this.home.fish).padStart(2, '0'));
    this.counts[1].setText(String(this.home.stars)); this.counts[2].setText(String(this.home.feathers));
  }

  update(): void {
    if (!this.home?.combat || !this.mobile) return;
    const combat = this.home.combat;
    const ratio = Phaser.Math.Clamp(combat.energy / combat.maxEnergy, 0, 1);
    const stage = this.home.stage;
    const elementsAvailable = combat.availableFruits.length > 0;
    this.energyFill.setScale(ratio, 1);
    this.energyText.setText(`呼嚕能量  ${Math.floor(combat.energy)} / ${combat.maxEnergy}`);
    this.chargeFill.setScale(Phaser.Math.Clamp(combat.chargeRatio, 0, 1), 1);
    this.chargeFill.setFillStyle(combat.chargeReady ? 0xe5a460 : 0xb996cb);
    this.chargeText.setText(combat.chargeReady ? '集氣完成 · 放開發射'
      : combat.charging ? `集氣中  ${Math.round(combat.chargeRatio * 100)}%`
      : combat.energy < 16 ? '能量恢復中 · 稍等一下'
      : this.mobile.isTouch ? '按住「集氣」· 放開發射' : '按住 K 集氣 · 放開發射');
    this.chargeText.setColor(combat.chargeReady ? '#b86637' : combat.energy < 16 ? '#8d7e73' : '#695263');
    const element = combat.fruit ? ELEMENTS[combat.fruit] : undefined;
    const iconKey = element && this.textures.exists(element.key) ? element.key : 'fire-fruit';
    if (this.fruitIcon.texture.key !== iconKey) {
      this.fruitIcon.setTexture(iconKey).setScale(42 / Math.max(this.textures.getFrame(iconKey).width, this.textures.getFrame(iconKey).height));
    }
    this.fruitIcon.clearTint().setAlpha(element ? 1 : .32);
    if (element && !this.textures.exists(element.key)) this.fruitIcon.setTint(element.color);
    this.elementText.setText(element?.name ?? '一般肉球');
    this.elementDetail.setText(elementsAvailable ? this.mobile.isTouch ? '輕觸切換元素' : 'Q 循環切換元素' : '也能發射集氣波');
    const boss = combat.boss;
    this.bossPanel.setVisible(boss.active && !boss.defeated && this.home.mode !== 'complete');
    if (boss.active && !boss.defeated) {
      this.bossName.setText(boss.name);
      this.bossPhase.setText(`階段 ${boss.phase} / 3`);
      this.bossFill.setScale(Phaser.Math.Clamp(boss.health / boss.maxHealth, 0, 1), 1);
      this.mission.setText(boss.phase === 3 ? '躲開紅色預警 · 集氣後放開反擊' : '撿愛心罐頭補血 · 長按集氣反擊');
    } else {
      const trialAvailable = stage.fruit && combat.availableFruits.includes(stage.fruit);
      this.mission.setText(boss.defeated ? '訊號已解除 · 準備和新朋友返航'
        : stage.fruit && !trialAvailable ? `向右探索 → 試用${ELEMENTS[stage.fruit].name}`
        : stage.index === 6 ? '切換五元素 · 找回失蹤的龍蛋'
        : stage.index === 7 ? '同伴正在支援 · 前往永夜方舟'
        : `繼續向右 → 找到${stage.bossName}`);
    }
    this.guide.setVisible(!this.mobile.isTouch && this.home.mode === 'playing');
    this.mobile.setContext(this.home.interactions.hasNearby, combat.fruit, combat.energy >= 16,
      combat.charging, combat.chargeRatio, combat.chargeReady);
  }

  private showToast(message: string): void {
    this.toastTimer?.remove(); this.toastText.setText(message); this.toast.setVisible(true);
    this.toastTimer = this.time.delayedCall(2900, () => this.toast.setVisible(false));
  }

  private renderMode(mode: GameMode): void {
    this.overlay.removeAll(true); this.mobile.setVisible(mode === 'playing');
    this.base.setVisible(mode === 'playing' || mode === 'dialogue');
    this.toast.setVisible(false);
    if (mode === 'playing') return;
    if (mode === 'dialogue') { this.renderDialogue(); return; }
    this.overlay.add(this.add.rectangle(640, 360, 1280, 720, 0x302936, .76).setInteractive());
    if (mode === 'complete') this.renderComplete(); else this.renderPause();
  }

  private renderDialogue(): void {
    const d = this.home.dialogue.current;
    if (!d || this.home.mode !== 'dialogue') return;
    this.overlay.removeAll(true);
    const hit = this.add.rectangle(640, 360, 1280, 720, 0x342f31, .15).setInteractive();
    hit.on('pointerup', () => this.home.dialogue.next());
    this.overlay.add(hit);
    this.overlay.add(panel(this, 222, 463, 836, 201, 0xfff0d8));
    const speakingBoss = STAGES.find(stage => d.speaker.includes(stage.bossName));
    const portraitKey = d.speaker.includes('小鈴') ? 'portrait-ai' : d.speaker.includes('扳手') ? 'portrait-wrench'
      : speakingBoss ? speakingBoss.bossKey : d.speaker.includes('MOUSE') || d.speaker.includes('老鼠') ? 'mouse'
      : d.speaker.includes('NAPPER') ? 'sleepy-cat' : 'portrait-snowball';
    this.overlay.add(this.add.circle(290, 539, 44, 0xe3d7c4));
    this.overlay.add(this.icon(290, 539, portraitKey, 87, speakingBoss && speakingBoss.id !== 'home' ? 0 : undefined));
    this.overlay.add(text(this, 355, 486, d.speaker, 17, '#a56752'));
    this.overlay.add(text(this, 355, 522, this.home.dialogue.line, 21).setWordWrapWidth(660, true));
    this.overlay.add(text(this, 1030, 634, `E / 空白鍵 / 點一下繼續   ${this.home.dialogue.index + 1} / ${d.lines.length}`, 12, '#876d65').setOrigin(1, 0));
  }

  private renderPause(): void {
    this.overlay.add(panel(this, 402, 93, 476, 548));
    this.overlay.add(text(this, 640, 132, '出勤暫停中', 29).setOrigin(.5));
    this.overlay.add(text(this, 640, 172, '休息一下，警報也能等一會。', 15, '#8b7169').setOrigin(.5));
    this.overlay.add(button(this, 640, 229, '繼續出勤', () => this.home.resume(), 344));
    const addSetting = (y: number, name: string, setting: 'music' | 'sfx'): void => {
      this.overlay.add(text(this, 454, y, name, 16));
      const value = text(this, 712, y, `${Math.round(save.data.settings[setting] * 100)}%`, 15).setOrigin(.5, 0);
      this.overlay.add(value);
      for (const [x, delta, label] of [[660, -.25, '−'], [786, .25, '+']] as const) {
        this.overlay.add(button(this, x, y + 10, label, () => {
          const next = Phaser.Math.Clamp(save.data.settings[setting] + delta, 0, 1);
          save.setSettings({ [setting]: next }); audio.setSettings(save.data.settings); value.setText(`${Math.round(next * 100)}%`);
          if (setting === 'sfx') audio.play('bell');
        }, 39, false).setScale(1, .7));
      }
    };
    addSetting(292, '音樂', 'music'); addSetting(344, '音效', 'sfx');
    this.overlay.add(button(this, 640, 412, `減少動態效果：${save.data.settings.reducedMotion ? '開啟' : '關閉'}`, () => {
      save.setSettings({ reducedMotion: !save.data.settings.reducedMotion }); this.renderMode('paused');
    }, 344, false));
    if (Capacitor.isNativePlatform()) {
      this.overlay.add(button(this, 640, 480, '回到主畫面', () => this.home.menu(), 344, false));
    } else {
      this.overlay.add(button(this, 551, 480, this.scale.isFullscreen ? '離開全螢幕' : '全螢幕', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
      }, 166, false));
      this.overlay.add(button(this, 731, 480, '回到主畫面', () => this.home.menu(), 166, false));
    }
    this.overlay.add(button(this, 640, 548, `重新挑戰第 ${this.home.stage.index} 關`, () => this.home.replay(), 344, false));
    this.overlay.add(text(this, 640, 605, '探索進度會保存在最近的檢查點。', 13, '#8b7169').setOrigin(.5));
  }

  private renderComplete(): void {
    const stage = this.home.stage;
    const final = stage.index === STAGES.length;
    this.overlay.add(panel(this, 323, 52, 634, 609));
    this.overlay.add(this.icon(640, 117, stage.id === 'home' ? 'badge-wrench' : stage.bossKey, 88, stage.id === 'home' ? undefined : 7));
    this.overlay.add(text(this, 640, 188, final ? '七次出勤，終於回家。' : `第 ${stage.index} 次出勤，任務完成！`, 29, '#8d5e54').setOrigin(.5));
    this.overlay.add(text(this, 640, 227, final ? '夜空會亮起來。夜墨也有了可以回去的地方。' : '警報解除。多一位朋友，飛船就更像家。', 15).setOrigin(.5));
    this.overlay.add(this.add.rectangle(640, 268, 530, 1, 0xc6af8a));
    if (final) {
      this.overlay.add(this.icon(411, 319, 'ship-icon', 70));
      this.overlay.add(text(this, 468, 292, '「要不要一起回家？」', 23, '#8d5e54'));
      this.overlay.add(text(this, 468, 329, '雪球沒有摧毀方舟。\n她把最後一個座位，留給了夜墨。', 17, '#876e67').setWordWrapWidth(430, true));
      this.overlay.add(text(this, 640, 411, '星貓爆發永久解鎖 · 七位同伴一起自由巡邏', 16, '#a27b4c').setOrigin(.5));
    } else {
      this.overlay.add(stage.fruit ? this.elementIcon(411, 314, stage.fruit, 54) : this.icon(411, 314, 'ship-icon', 57));
      this.overlay.add(text(this, 462, 291, stage.fruit ? `${ELEMENTS[stage.fruit].name} · 永久解鎖` : '五元素連攜 · 永久解鎖', 21));
      this.overlay.add(text(this, 462, 324, stage.fruit ? '下次出勤，從起點就能自由切換。' : '切換元素組合招式，同伴會在危急時救援。', 14, '#876e67'));
      this.overlay.add(this.icon(411, 395, stage.id === 'home' ? 'portrait-wrench' : stage.bossKey, 63, stage.id === 'home' ? undefined : 7));
      this.overlay.add(text(this, 462, 370, `${stage.bossName}加入 SNOW-01`, 20));
      this.overlay.add(text(this, 462, 402, stage.reward, 13, '#876e67').setWordWrapWidth(454, true));
    }
    const minutes = Math.floor(this.home.elapsed / 60000), seconds = Math.floor(this.home.elapsed / 1000) % 60;
    this.overlay.add(text(this, 640, 465, `本次小發現  魚乾 ${this.home.fish} · 星星 ${this.home.stars} · 羽毛 ${this.home.feathers}     ${minutes}:${String(seconds).padStart(2, '0')}`, 13, '#8b766e').setOrigin(.5));
    const next = STAGES[stage.index];
    this.overlay.add(button(this, 640, 529, final ? '自由巡邏 / 出勤星圖' : `下一次出勤 → ${next.title}`, () => {
      if (final) { this.registry.set('open-star-map', true); this.home.menu(); }
      else this.home.nextStage();
    }, 524));
    this.overlay.add(button(this, 510, 599, '再玩這一關', () => this.home.replay(), 245, false));
    this.overlay.add(button(this, 771, 599, '回到主畫面', () => this.home.menu(), 245, false));
  }
}
