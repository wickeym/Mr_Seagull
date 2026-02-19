import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';

export interface DropSpec {
  x: number;
  y: number;
  chargeRatio: number;
}

export class Seagull extends Phaser.GameObjects.Sprite {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly aKey: Phaser.Input.Keyboard.Key | null;
  private readonly dKey: Phaser.Input.Keyboard.Key | null;
  private readonly wKey: Phaser.Input.Keyboard.Key | null;
  private readonly sKey: Phaser.Input.Keyboard.Key | null;

  private virtualLeft = false;
  private virtualRight = false;
  private virtualUp = false;
  private virtualDown = false;

  private xNorm = 0;
  private yNorm = 0;
  private vx = 0;
  private vy = 0;

  private readonly acceleration = 3.8;
  private readonly maxSpeed = 2.5;
  private readonly drag = 6.4;

  private readonly dropCooldownMs = 600;
  private readonly maxChargeMs = 800;
  private lastDropMs = -1000;
  private charging = false;
  private chargeStartMs = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, GAME_WIDTH / 2, GAME_HEIGHT - 120, 'seagull');

    scene.add.existing(this);
    this.setDepth(25);

    const keyboard = scene.input.keyboard;
    this.cursors = keyboard?.createCursorKeys() ?? null;
    this.aKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? null;
    this.dKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? null;
    this.wKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W) ?? null;
    this.sKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S) ?? null;
  }

  public updateFlight(deltaMs: number): void {
    const dt = deltaMs / 1000;

    const movingLeft = Boolean(this.cursors?.left?.isDown || this.aKey?.isDown || this.virtualLeft);
    const movingRight = Boolean(this.cursors?.right?.isDown || this.dKey?.isDown || this.virtualRight);
    const movingUp = Boolean(this.cursors?.up?.isDown || this.wKey?.isDown || this.virtualUp);
    const movingDown = Boolean(this.cursors?.down?.isDown || this.sKey?.isDown || this.virtualDown);

    this.vx = this.computeAxisVelocity(this.vx, movingLeft, movingRight, dt);
    this.vy = this.computeAxisVelocity(this.vy, movingUp, movingDown, dt);

    this.xNorm = Phaser.Math.Clamp(this.xNorm + this.vx * dt, -1, 1);
    this.yNorm = Phaser.Math.Clamp(this.yNorm + this.vy * dt, -0.95, 0.95);

    this.x = GAME_WIDTH / 2 + this.xNorm * 280;
    this.y = GAME_HEIGHT - 132 + this.yNorm * 118;

    if (this.charging) {
      const charge = this.chargeRatio(this.scene.time.now);
      this.setScale(1 + charge * 0.15);
      this.setTint(0xfef08a);
    } else {
      this.clearTint();
      this.setScale(1);
    }
  }

  public setVirtualInput(left: boolean, right: boolean, up: boolean, down: boolean): void {
    this.virtualLeft = left;
    this.virtualRight = right;
    this.virtualUp = up;
    this.virtualDown = down;
  }

  public startCharge(nowMs: number): void {
    if (!this.canDrop(nowMs)) {
      return;
    }

    this.charging = true;
    this.chargeStartMs = nowMs;
  }

  public releaseDrop(nowMs: number): DropSpec | null {
    if (!this.canDrop(nowMs)) {
      this.charging = false;
      return null;
    }

    const chargeRatio = this.chargeRatio(nowMs);
    this.lastDropMs = nowMs;
    this.charging = false;

    return {
      x: this.xNorm,
      y: this.yNorm,
      chargeRatio
    };
  }

  public get chargePreviewRatio(): number {
    if (!this.charging) {
      return 0;
    }

    return this.chargeRatio(this.scene.time.now);
  }

  public get cooldownRemainingMs(): number {
    return Math.max(0, this.dropCooldownMs - (this.scene.time.now - this.lastDropMs));
  }

  private canDrop(nowMs: number): boolean {
    return nowMs - this.lastDropMs >= this.dropCooldownMs;
  }

  private chargeRatio(nowMs: number): number {
    if (!this.charging) {
      return 0;
    }

    return Phaser.Math.Clamp((nowMs - this.chargeStartMs) / this.maxChargeMs, 0, 1);
  }

  private computeAxisVelocity(current: number, negative: boolean, positive: boolean, dt: number): number {
    if (negative && !positive) {
      return Math.max(current - this.acceleration * dt, -this.maxSpeed);
    }

    if (positive && !negative) {
      return Math.min(current + this.acceleration * dt, this.maxSpeed);
    }

    const dragAmount = this.drag * dt;
    if (Math.abs(current) <= dragAmount) {
      return 0;
    }

    return current - Math.sign(current) * dragAmount;
  }
}
