import Phaser from 'phaser';
import { GAME_WIDTH } from '../utils/constants';
import { Poop } from './Poop';

interface DropOptions {
  windProvider: () => number;
  onMiss: () => void;
}

export class Seagull extends Phaser.Physics.Arcade.Sprite {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly aKey: Phaser.Input.Keyboard.Key | null;
  private readonly dKey: Phaser.Input.Keyboard.Key | null;

  private virtualLeft = false;
  private virtualRight = false;

  private readonly acceleration = 1100;
  private readonly maxSpeed = 320;
  private readonly drag = 1700;

  private activePoop: Poop | null = null;
  private readonly dropCooldownMs = 600;
  private readonly maxChargeMs = 800;
  private lastDropMs = -1000;
  private charging = false;
  private chargeStartMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'seagull');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const keyboard = scene.input.keyboard;
    this.cursors = keyboard?.createCursorKeys() ?? null;
    this.aKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A) ?? null;
    this.dKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? null;
  }

  public update(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    const movingLeft = Boolean(this.cursors?.left?.isDown || this.aKey?.isDown || this.virtualLeft);
    const movingRight = Boolean(this.cursors?.right?.isDown || this.dKey?.isDown || this.virtualRight);

    if (movingLeft && !movingRight) {
      body.velocity.x = Math.max(body.velocity.x - this.acceleration * (deltaMs / 1000), -this.maxSpeed);
      this.setFlipX(true);
    } else if (movingRight && !movingLeft) {
      body.velocity.x = Math.min(body.velocity.x + this.acceleration * (deltaMs / 1000), this.maxSpeed);
      this.setFlipX(false);
    } else {
      const dragAmount = this.drag * (deltaMs / 1000);
      if (Math.abs(body.velocity.x) <= dragAmount) {
        body.velocity.x = 0;
      } else {
        body.velocity.x -= Math.sign(body.velocity.x) * dragAmount;
      }
    }

    this.x = Phaser.Math.Clamp(this.x, 26, GAME_WIDTH - 26);

    if (this.charging) {
      const charge = this.chargeRatio(this.scene.time.now);
      this.setScale(1 + charge * 0.15);
      this.setTint(0xfef08a);
    } else {
      this.clearTint();
      this.setScale(1);
    }
  }

  public setVirtualInput(left: boolean, right: boolean): void {
    this.virtualLeft = left;
    this.virtualRight = right;
  }

  public startCharge(nowMs: number): void {
    if (!this.canDrop(nowMs)) {
      return;
    }

    this.charging = true;
    this.chargeStartMs = nowMs;
  }

  public releaseDrop(nowMs: number, group: Phaser.Physics.Arcade.Group, options: DropOptions): Poop | null {
    if (!this.canDrop(nowMs)) {
      this.charging = false;
      return null;
    }

    const chargeRatio = this.chargeRatio(nowMs);
    const poop = new Poop(this.scene, this.x, this.y + 26, {
      baseFallSpeed: 320,
      chargeRatio,
      windProvider: options.windProvider,
      onMiss: options.onMiss
    });

    group.add(poop);

    this.lastDropMs = nowMs;
    this.charging = false;
    this.activePoop = poop;

    poop.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.activePoop = null;
    });

    return poop;
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
    if (this.activePoop && this.activePoop.active) {
      return false;
    }

    return nowMs - this.lastDropMs >= this.dropCooldownMs;
  }

  private chargeRatio(nowMs: number): number {
    if (!this.charging) {
      return 0;
    }

    return Phaser.Math.Clamp((nowMs - this.chargeStartMs) / this.maxChargeMs, 0, 1);
  }
}
