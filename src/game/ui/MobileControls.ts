import Phaser from 'phaser';
import { InputSystem, type TouchAction } from '../systems/InputSystem';
import { text } from './widgets';

/** Independent pointer ownership permits move, jump and dash at the same time. */
export class MobileControls {
  readonly container: Phaser.GameObjects.Container;
  private release: (pointer: Phaser.Input.Pointer) => void;
  private buttons: { action: TouchAction; zone: Phaser.GameObjects.Arc; pointers: Set<number> }[] = [];
  private enabled = true;
  private touchDetected = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  constructor(private readonly scene: Phaser.Scene, private readonly input: InputSystem) {
    this.container = scene.add.container(0, 0).setDepth(300);
    const defs: [TouchAction, number, number, string][] = [
      ['left', 78, 633, '◀'], ['right', 200, 633, '▶'], ['dash', 991, 633, '»'], ['interact', 1094, 638, 'E'], ['jump', 1190, 578, '↑'],
    ];
    for (const [action, x, y, label] of defs) {
      const zone = scene.add.circle(x, y, action === 'jump' ? 49 : 43, 0xffedcf, .58).setStrokeStyle(2, 0x635148, .65).setInteractive();
      const entry = { action, zone, pointers: new Set<number>() };
      this.buttons.push(entry);
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        entry.pointers.add(pointer.id); input.setTouch(action, true, pointer.id); zone.setAlpha(.95);
      });
      zone.on('pointerout', (pointer: Phaser.Input.Pointer) => this.releasePointer(pointer.id, entry));
      this.container.add([zone, text(scene, x, y, label, 31).setOrigin(.5)]);
      this.container.add(text(scene, x, y + 57, action.toUpperCase(), 10).setOrigin(.5));
    }
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
    entry.zone.setAlpha(entry.pointers.size > 0 ? .95 : .65);
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
