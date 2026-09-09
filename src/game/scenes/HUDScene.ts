import Phaser from 'phaser';
import { HomeScene, type GameMode } from './HomeScene';
import { MobileControls } from '../ui/MobileControls';
import { button, panel, text } from '../ui/widgets';
import { audio, save } from '../services';

export class HUDScene extends Phaser.Scene {
  private home!: HomeScene;
  private hearts!: Phaser.GameObjects.Text;
  private counts: Phaser.GameObjects.Text[] = [];
  private mission!: Phaser.GameObjects.Text;
  private missionDetail!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private mobile!: MobileControls;
  private toastTimer?: Phaser.Time.TimerEvent;
  private base!: Phaser.GameObjects.Container;
  constructor() { super('HUD'); }
  create(): void {
    this.home = this.scene.get('Home') as HomeScene;
    this.base = this.add.container(0, 0);
    this.base.add(panel(this, 26, 24, 263, 78, 0xffefd5, .94));
    const portrait = this.add.image(67, 75, 'snowball', 0).setScale(1).setOrigin(.5, 1);
    this.base.add(portrait);
    this.base.add(text(this, 109, 37, 'SNOWBALL', 13));
    this.hearts = text(this, 107, 58, '♥ ♥ ♥ ♥ ♥', 23, '#b57467'); this.base.add(this.hearts);
    this.base.add(panel(this, 850, 24, 328, 60, 0xffefd5, .94));
    this.base.add(this.add.image(878, 54, 'fish'));
    this.base.add(this.add.image(991, 54, 'star'));
    this.base.add(this.add.image(1096, 54, 'feather'));
    this.counts = [902, 1014, 1120].map(x => text(this, x, 45, '', 18)); this.base.add(this.counts);
    const pause = button(this, 1225, 54, 'Ⅱ', () => this.home.setMode(this.home.mode === 'paused' ? 'playing' : 'paused'), 56, false);
    this.base.add(pause);
    const missionBox = panel(this, 26, 120, 305, 90, 0xffefd5, .9); this.base.add(missionBox);
    this.base.add(text(this, 42, 132, 'A LITTLE MISSION', 10, '#a27e60'));
    this.mission = text(this, 42, 153, '', 15); this.base.add(this.mission);
    this.missionDetail = text(this, 42, 178, '', 11, '#8f7b63'); this.base.add(this.missionDetail);
    this.overlay = this.add.container(0, 0).setDepth(200);
    this.toastText = text(this, 0, 0, '', 15, '#fff0d4').setOrigin(.5);
    this.toast = this.add.container(640, 113, [this.add.rectangle(0, 0, 580, 42, 0x53473f, .94).setStrokeStyle(1, 0xe6c79b), this.toastText]).setDepth(400).setVisible(false);
    this.mobile = new MobileControls(this, this.home.controls);
    this.home.events.on('progress', this.refresh, this);
    this.home.events.on('mode', this.renderMode, this);
    this.home.events.on('toast', this.showToast, this);
    this.home.dialogue.on('change', this.renderDialogue, this);
    this.events.once('shutdown', () => {
      this.home.events.off('progress', this.refresh, this); this.home.events.off('mode', this.renderMode, this);
      this.home.events.off('toast', this.showToast, this); this.home.dialogue.off('change', this.renderDialogue, this);
    });
    this.refresh(); this.renderMode(this.home.mode);
  }
  private refresh(): void {
    this.hearts.setText('♥ '.repeat(this.home.hearts) + '♡ '.repeat(5 - this.home.hearts));
    this.counts[0].setText(String(this.home.fish).padStart(2, '0'));
    this.counts[1].setText(`${this.home.stars}/3`); this.counts[2].setText(`${this.home.feathers}/3`);
    const active = this.home.missions.active;
    this.mission.setText(active ? active.label : 'Follow the flag home');
    const hints: Record<string, string> = {
      'key-found': 'Follow the shelves up the cat tower.', 'mouse-helped': 'A plush friend needs a ride home.',
      'box-open': 'A kindness. A scratch. A little star.', 'balcony-open': 'A brighter tomorrow is waiting.',
    };
    this.missionDetail.setText(active ? hints[active.flag] ?? '' : 'You have earned a very good day.');
  }
  private showToast(message: string): void {
    this.toastTimer?.remove(); this.toastText.setText(message); this.toast.setVisible(true);
    this.toastTimer = this.time.delayedCall(2900, () => this.toast.setVisible(false));
  }
  private renderMode(mode: GameMode): void {
    this.overlay.removeAll(true); this.mobile.setVisible(mode === 'playing');
    if (mode === 'playing' || mode === 'dialogue') return;
    this.overlay.add(this.add.rectangle(640, 360, 1280, 720, 0x2d2c37, .68).setInteractive());
    if (mode === 'complete') this.renderComplete();
    else this.renderPause();
  }
  private renderDialogue(): void {
    const d = this.home.dialogue.current;
    if (!d) return;
    this.overlay.removeAll(true);
    const hit = this.add.rectangle(640, 360, 1280, 720, 0x342f31, .13).setInteractive();
    hit.on('pointerup', () => this.home.dialogue.next());
    this.overlay.add(hit);
    this.overlay.add(panel(this, 235, 471, 810, 191, 0xffefd5));
    this.overlay.add(this.add.image(291, 567, d.speaker.includes('MOUSE') ? 'mouse' : 'snowball').setScale(1));
    this.overlay.add(text(this, 341, 494, d.speaker, 12, '#a46652').setLetterSpacing(2));
    this.overlay.add(text(this, 341, 526, this.home.dialogue.line, 18));
    this.overlay.add(text(this, 1019, 629, `E / SPACE / TAP TO CONTINUE  ${this.home.dialogue.index + 1}/${d.lines.length}`, 10, '#9c8064').setOrigin(1, 0));
  }
  private renderPause(): void {
    this.overlay.add(panel(this, 402, 110, 476, 526));
    this.overlay.add(text(this, 640, 144, 'A TINY PAUSE', 29).setOrigin(.5));
    this.overlay.add(text(this, 640, 183, 'The adventure can wait a moment.', 12, '#9a7e65').setOrigin(.5));
    this.overlay.add(button(this, 640, 240, 'BACK TO ADVENTURE', () => this.home.setMode('playing'), 344));
    const addSetting = (y: number, name: string, setting: 'music' | 'sfx'): void => {
      this.overlay.add(text(this, 452, y, name, 14));
      const value = text(this, 712, y, `${Math.round(save.data.settings[setting] * 100)}%`, 14).setOrigin(.5, 0);
      this.overlay.add(value);
      for (const [x, delta, label] of [[660, -.25, '−'], [786, .25, '+']] as const) {
        this.overlay.add(button(this, x, y + 8, label, () => {
          const next = Math.max(0, Math.min(1, save.data.settings[setting] + delta));
          save.setSettings({ [setting]: next }); audio.setSettings(save.data.settings); value.setText(`${Math.round(next * 100)}%`);
          if (setting === 'sfx') audio.play('bell');
        }, 39, false).setScale(1, .7));
      }
    };
    addSetting(299, 'MUSIC', 'music'); addSetting(350, 'SOUND', 'sfx');
    this.overlay.add(button(this, 640, 414, `GENTLE EFFECTS: ${save.data.settings.reducedMotion ? 'ON' : 'OFF'}`, () => {
      save.setSettings({ reducedMotion: !save.data.settings.reducedMotion }); this.renderMode('paused');
    }, 344, false));
    this.overlay.add(button(this, 554, 481, 'FULLSCREEN', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
    }, 170, false));
    this.overlay.add(button(this, 733, 481, 'TITLE', () => this.home.menu(), 170, false));
    this.overlay.add(button(this, 640, 548, 'RESTART HOME', () => this.home.replay(), 344, false));
    this.overlay.add(text(this, 640, 600, 'Progress saved at your last checkpoint.', 11, '#9a7e65').setOrigin(.5));
  }
  private renderComplete(): void {
    this.overlay.add(panel(this, 362, 100, 556, 535));
    this.overlay.add(this.add.image(640, 169, 'snowball', 0).setScale(1));
    const cat = this.add.sprite(640, 170, 'snowball').play('snowball-victory').setScale(1); this.overlay.add(cat);
    this.overlay.add(text(this, 640, 224, 'STAGE CLEAR', 38, '#a56b4c').setOrigin(.5));
    this.overlay.add(text(this, 640, 271, 'GOOD CAT. BETTER DAYS.', 15).setOrigin(.5));
    this.overlay.add(text(this, 640, 315, '★'.repeat(this.home.stars) + '☆'.repeat(3 - this.home.stars), 34, '#d2a04e').setOrigin(.5));
    const minutes = Math.floor(this.home.elapsed / 60000), seconds = Math.floor(this.home.elapsed / 1000) % 60;
    this.overlay.add(text(this, 454, 358, `FISH          ${String(this.home.fish).padStart(2, '0')} / 30\nFEATHERS       ${this.home.feathers} / 3\nSECRETS        ${this.home.secrets} / 3\nTIME          ${minutes}:${String(seconds).padStart(2, '0')}`, 18));
    this.overlay.add(button(this, 640, 510, 'ONE MORE LITTLE ADVENTURE', () => this.home.replay(), 410));
    this.overlay.add(button(this, 640, 575, 'BACK TO TITLE', () => this.home.menu(), 410, false));
    this.overlay.add(text(this, 640, 676, 'The rooftops are waiting. More chapters to come.', 13, '#ebd9bb').setOrigin(.5));
  }
}
