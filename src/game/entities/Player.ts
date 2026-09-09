import Phaser from 'phaser';
import { InputSystem } from '../systems/InputSystem';

export type PlayerState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'dash' |
  'sit' | 'sleep' | 'interact' | 'celebrate' | 'victory' | 'stumble';

export const PLAYER_TUNING = {
  walkSpeed: 210, runSpeed: 280, acceleration: 1700, deceleration: 2100,
  jumpVelocity: -420, dashVelocity: 450, dashDuration: 140, dashCooldown: 600,
  coyoteTime: 100, jumpBuffer: 120, runAfter: 550,
} as const;

/** Feet remain at the same origin through every animation and collision state. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  facing: -1 | 1 = 1;
  movementState: PlayerState = 'idle';
  private frozen = false;
  private lastGrounded = -Infinity;
  private lastJumpPressed = -Infinity;
  private nextDash = 0;
  private dashUntil = 0;
  private idleFor = 0;
  private runningFor = 0;
  private wasGrounded = false;
  private hasJumped = false;
  private poseUntil = 0;
  private forcedPose: PlayerState | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly controls: InputSystem) {
    super(scene, x, y, 'snowball', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(20);
    this.body.setSize(30, 42).setOffset(17, 22);
    this.body.setMaxVelocity(500, 700);
    this.body.setCollideWorldBounds(false);
  }

  get grounded(): boolean {
    // Arcade contact flags can survive a render frame without a physics step.
    // Rising velocity must never refresh coyote time or re-arm a second jump.
    return this.body.velocity.y >= 0 && (this.body.blocked.down || this.body.touching.down);
  }
  get isDashing(): boolean { return this.scene.time.now < this.dashUntil; }

  freeze(frozen: boolean): void {
    this.frozen = frozen;
    this.body.setVelocity(0, 0);
    this.body.setAcceleration(0, 0);
    this.body.setAllowGravity(!frozen);
    this.lastJumpPressed = -Infinity;
    this.dashUntil = 0;
    if (frozen) this.controls.clear();
  }

  respawn(x: number, y: number): void {
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(true);
    this.setAlpha(1);
    this.frozen = false;
    this.dashUntil = 0;
    this.nextDash = 0;
    this.lastGrounded = -Infinity;
    this.lastJumpPressed = -Infinity;
    this.hasJumped = false;
    this.wasGrounded = false;
    this.poseUntil = 0;
    this.forcedPose = undefined;
    this.controls.clear();
    this.transitionState('idle');
  }

  pose(state: PlayerState, duration = 700): void {
    this.forcedPose = state;
    this.poseUntil = this.scene.time.now + duration;
    this.transitionState(state);
  }

  update(time: number, delta: number): void {
    if (!this.active) return;
    if (this.frozen) {
      if (this.forcedPose && time < this.poseUntil) this.transitionState(this.forcedPose);
      return;
    }
    const dt = Math.min(delta, 50) / 1000;
    const onGround = this.grounded;
    if (onGround) {
      this.lastGrounded = time;
      this.hasJumped = false;
      if (!this.wasGrounded) {
        this.scene.events.emit('player-landed', this.x, this.y);
        if (!this.forcedPose || time >= this.poseUntil) this.pose('land', 90);
      }
    }
    this.wasGrounded = onGround;
    if (this.controls.consumeJump()) this.lastJumpPressed = time;
    const axis = this.controls.axis;
    if (axis !== 0) {
      this.facing = axis < 0 ? -1 : 1;
      this.setFlipX(this.facing < 0);
      this.runningFor += delta;
      this.idleFor = 0;
    } else {
      this.runningFor = 0;
      this.idleFor = onGround ? this.idleFor + delta : 0;
    }
    if (this.controls.consumeDash() && time >= this.nextDash) {
      this.dashUntil = time + PLAYER_TUNING.dashDuration;
      this.nextDash = time + PLAYER_TUNING.dashCooldown;
      this.scene.events.emit('player-dashed', this.x, this.y, this.facing);
    }
    if (time < this.dashUntil) {
      this.body.setAllowGravity(false);
      this.body.setVelocity(this.facing * PLAYER_TUNING.dashVelocity, 0);
      this.transitionState('dash');
      return;
    }
    this.body.setAllowGravity(true);
    const speed = this.runningFor >= PLAYER_TUNING.runAfter ? PLAYER_TUNING.runSpeed : PLAYER_TUNING.walkSpeed;
    const targetVelocity = axis * speed;
    const velocityStep = (axis ? PLAYER_TUNING.acceleration : PLAYER_TUNING.deceleration) * dt;
    this.body.setVelocityX(this.body.velocity.x + Phaser.Math.Clamp(
      targetVelocity - this.body.velocity.x, -velocityStep, velocityStep));
    if (!this.hasJumped && time - this.lastGrounded <= PLAYER_TUNING.coyoteTime &&
        time - this.lastJumpPressed <= PLAYER_TUNING.jumpBuffer) {
      this.body.setVelocityY(PLAYER_TUNING.jumpVelocity);
      this.hasJumped = true;
      this.lastGrounded = -Infinity;
      this.lastJumpPressed = -Infinity;
      this.forcedPose = undefined;
      this.scene.events.emit('player-jumped', this.x, this.y);
    }
    // Release cuts the rising phase; holding jump never queues a second jump.
    if (!this.controls.jumpHeld && this.body.velocity.y < -170) this.body.setVelocityY(-170);

    let state: PlayerState;
    if (this.body.velocity.y < -12) state = 'jump';
    else if (!onGround && this.body.velocity.y > 12) state = 'fall';
    else if (this.forcedPose && time < this.poseUntil && !axis) state = this.forcedPose;
    else if (axis) state = speed === PLAYER_TUNING.runSpeed ? 'run' : 'walk';
    else if (this.idleFor >= 30000) state = 'sleep';
    else if (this.idleFor >= 15000) state = 'sit';
    else state = 'idle';
    this.transitionState(state);
  }

  private transitionState(state: PlayerState): void {
    const changed = this.movementState !== state;
    this.movementState = state;
    const preferred = `snowball-${state}`;
    const alias = state === 'jump' ? 'snowball-jump-rise' : preferred;
    const animation = this.scene.anims.exists(preferred) ? preferred : alias;
    if (this.scene.anims.exists(animation)) this.play(animation, true);
    else if (changed) this.setFrame(0);
    if (changed) this.scene.events.emit('player-state-changed', state);
  }
}
