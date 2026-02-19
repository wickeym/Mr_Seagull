import Phaser from 'phaser';
import { GAME_HEIGHT } from '../utils/constants';

interface PoopOptions {
  baseFallSpeed: number;
  chargeRatio: number;
  windProvider: () => number;
  onMiss: () => void;
}

export class Poop extends Phaser.Physics.Arcade.Sprite {
  private resolved = false;
  private readonly baseFallSpeed: number;
  private readonly windProvider: () => number;
  private readonly onMissCallback: () => void;
  private readonly scoreMultiplierValue: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PoopOptions) {
    super(scene, x, y, 'poop');

    this.baseFallSpeed = options.baseFallSpeed * (1 + options.chargeRatio * 0.75);
    this.scoreMultiplierValue = 1 + options.chargeRatio * 0.2;
    this.windProvider = options.windProvider;
    this.onMissCallback = options.onMiss;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(6);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setScale(1 + options.chargeRatio * 0.4);
    this.setVelocity(0, this.baseFallSpeed);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.resolved) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const windForce = this.windProvider() * 180;
    const lerpFactor = Math.min(1, delta / 220);
    body.velocity.x += (windForce - body.velocity.x) * lerpFactor;
    body.velocity.y = this.baseFallSpeed;

    if (this.y > GAME_HEIGHT - 24) {
      this.resolved = true;
      this.onMissCallback();
      this.destroy();
    }
  }

  public splat(): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    this.setVelocity(0, 0);
    this.setTint(0x5b3a29);

    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 2,
      scaleY: this.scaleY * 0.35,
      alpha: 0.68,
      duration: 190,
      onComplete: () => this.destroy()
    });
  }

  public get isResolved(): boolean {
    return this.resolved;
  }

  public get scoreMultiplier(): number {
    return this.scoreMultiplierValue;
  }
}
