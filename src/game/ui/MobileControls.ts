import Phaser from 'phaser';
import { InputSystem, type TouchAction } from '../systems/InputSystem';
import { text } from './widgets';

const ELEMENT_COLORS: Record<string, { fill: number; ink: string; ring: number }> = {
  fire: { fill: 0xf0bc83, ink: '#733e39', ring: 0xefaf79 },
  wind: { fill: 0xbce0d2, ink: '#426c60', ring: 0x9cead5 },
  water: { fill: 0xb6d9f1, ink: '#42698d', ring: 0x99d3ff },
  lightning: { fill: 0xefdfa0, ink: '#81682d', ring: 0xffe991 },
  earth: { fill: 0xd7c3a1, ink: '#796346', ring: 0xdcc08c },
  base: { fill: 0xdbc9e8, ink: '#695263', ring: 0xbba0d1 },
};

/** Independent pointer ownership permits move, jump and dash at the same time. */
export class MobileControls {
  readonly container: Phaser.GameObjects.Container;
  private release: (pointer: Phaser.Input.Pointer) => void;
  private buttons: { action: TouchAction; zone: Phaser.GameObjects.Arc; pointers: Set<number> }[] = [];
  private enabled = true;
  private touchDetected = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  private pawLabel!: Phaser.GameObjects.Text;
  private specialLabel!: Phaser.GameObjects.Text;
  private specialZone!: Phaser.GameObjects.Arc;
  private specialRing: Phaser.GameObjects.Graphics;
  private chargeProgress = -1;
  private chargeRingReady = false;
  private chargeRingFruit: string | null = null;
  private context = '';
  constructor(private readonly scene: Phaser.Scene, private readonly input: InputSystem) {
    this.container = scene.add.container(0, 0).setDepth(300);
    const defs: [TouchAction, number, number, string][] = [
      ['left', 78, 641, '◀'], ['right', 200, 641, '▶'],
      ['special', 1066, 546, '集氣'], ['jump', 1186, 546, '跳躍'],
      ['dash', 1066, 656, '衝刺'], ['interact', 1186, 656, '肉球'],
    ];
    for (const [action, x, y, label] of defs) {
      const movement = action === 'left' || action === 'right';
      const zone = scene.add.circle(x, y, movement ? 45 : 44, action === 'special' ? 0xf0bc83 : 0xffedcf, .8).setStrokeStyle(2, 0x695263, .75).setInteractive();
      const entry = { action, zone, pointers: new Set<number>() };
      this.buttons.push(entry);
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        entry.pointers.add(pointer.id); input.setTouch(action, true, pointer.id); zone.setAlpha(.95);
      });
      zone.on('pointerout', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id, entry));
      const labelObject = text(scene, x, y, label, movement ? 27 : 21).setOrigin(.5);
      this.container.add([zone, labelObject]);
      if (action === 'interact') this.pawLabel = labelObject;
      if (action === 'special') { this.specialLabel = labelObject; this.specialZone = zone; }
    }
    this.specialRing = scene.add.graphics();
    this.container.add(this.specialRing);
    this.release = pointer => this.buttons.forEach(entry => this.releasePointer(pointer.id, entry));
    scene.input.on('pointerup', this.release);
    scene.input.on('pointerupoutside', this.release);
    this.container.setVisible(this.touchDetected);
    scene.input.on('pointerdown', this.detectTouch, this);
    scene.events.once('shutdown', this.destroy, this);
  }
  private detectTouch(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) this.touchDetected = true;
    this.container.setVisible(this.enabled && this.touchDetected);
  }
  private releasePointer(id: number, entry: typeof this.buttons[number]): void {
    if (!entry.pointers.delete(id)) return;
    this.input.setTouch(entry.action, false, id);
    entry.zone.setAlpha(entry.pointers.size > 0 ? .95 : 1);
  }
  get isTouch(): boolean { return this.touchDetected; }
  setContext(nearby: boolean, fruit: string | null, ready: boolean, charging = false, chargeRatio = 0, chargeReady = false): void {
    const colors = ELEMENT_COLORS[fruit ?? 'base'];
    const progress = charging ? Math.round(Phaser.Math.Clamp(chargeRatio, 0, 1) * 100) : 0;
    if (progress !== this.chargeProgress || chargeReady !== this.chargeRingReady || fruit !== this.chargeRingFruit) {
      this.chargeProgress = progress; this.chargeRingReady = chargeReady; this.chargeRingFruit = fruit;
      this.specialRing.clear();
      if (progress > 0) {
        this.specialRing.lineStyle(5, chargeReady ? 0xffe9a0 : colors.ring, 1);
        this.specialRing.beginPath();
        this.specialRing.arc(1066, 546, 48, -Math.PI / 2, -Math.PI / 2 + progress / 100 * Math.PI * 2);
        this.specialRing.strokePath();
      }
    }
    const context = `${nearby}:${fruit}:${ready}:${charging}:${chargeReady}`;
    if (context === this.context) return;
    this.context = context;
    this.pawLabel.setText(nearby ? '互動' : '肉球');
    this.specialZone.setFillStyle(colors.fill, ready ? .85 : .55);
    this.specialLabel.setText(chargeReady ? '放開！' : charging ? '集氣中' : '集氣')
      .setFontSize(charging ? 18 : 21).setColor(ready ? colors.ink : '#8d7e73');
  }
  setVisible(visible: boolean): void {
    this.enabled = visible;
    this.container.setVisible(visible && this.touchDetected);
    if (!visible) for (const entry of this.buttons) {
      for (const id of [...entry.pointers]) this.releasePointer(id, entry);
    }
  }
  destroy(): void {
    this.input.clear(); this.scene.input.off('pointerup', this.release); this.scene.input.off('pointerupoutside', this.release);
    this.scene.input.off('pointerdown', this.detectTouch, this);
  }
}
