import Phaser from 'phaser';

export type InputAction = 'left' | 'right' | 'jump' | 'interact' | 'dash' | 'pause';
export type TouchAction = Exclude<InputAction, 'pause'>;

const KEY_ACTIONS: Readonly<Record<string, InputAction>> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyE: 'interact', ShiftLeft: 'dash', ShiftRight: 'dash', Escape: 'pause',
};

/** One edge-triggered action queue shared by keyboard and independent touch pointers. */
export class InputSystem {
  private readonly keys = new Set<string>();
  private readonly touch = new Map<InputAction, Set<number>>();
  private readonly pressed = new Set<InputAction>();

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.keyboard?.addCapture(['SPACE', 'LEFT', 'RIGHT', 'UP', 'DOWN']);
    scene.input.keyboard?.on('keydown', this.onKeyDown);
    scene.input.keyboard?.on('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code];
    if (!action || event.repeat || this.keys.has(event.code)) return;
    const wasDown = this.isDown(action);
    this.keys.add(event.code);
    if (!wasDown) this.pressed.add(action);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  setTouch(action: TouchAction, down: boolean, pointerId: number): void {
    const wasDown = this.isDown(action);
    const pointers = this.touch.get(action) ?? new Set<number>();
    if (down) pointers.add(pointerId);
    else pointers.delete(pointerId);
    this.touch.set(action, pointers);
    if (down && !wasDown) this.pressed.add(action);
  }

  private isDown(action: InputAction): boolean {
    if ((this.touch.get(action)?.size ?? 0) > 0) return true;
    for (const code of this.keys) if (KEY_ACTIONS[code] === action) return true;
    return false;
  }

  get axis(): number { return Number(this.isDown('right')) - Number(this.isDown('left')); }
  get jumpHeld(): boolean { return this.isDown('jump'); }
  private consume(action: InputAction): boolean {
    const result = this.pressed.has(action);
    this.pressed.delete(action);
    return result;
  }
  consumeJump(): boolean { return this.consume('jump'); }
  consumeInteract(): boolean { return this.consume('interact'); }
  consumeDash(): boolean { return this.consume('dash'); }
  consumePause(): boolean { return this.consume('pause'); }

  clear = (): void => {
    this.keys.clear();
    this.touch.clear();
    this.pressed.clear();
  };

  destroy(): void {
    this.clear();
    this.scene.input.keyboard?.off('keydown', this.onKeyDown);
    this.scene.input.keyboard?.off('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }
}
