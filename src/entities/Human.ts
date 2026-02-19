import Phaser from 'phaser';
import { GAME_WIDTH } from '../utils/constants';

export class Human extends Phaser.Physics.Arcade.Sprite {
  private alreadyHit = false;
  private readonly highValue: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, highValue = false) {
    super(scene, x, y, 'human');

    this.highValue = highValue;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(4);

    if (this.highValue) {
      this.setTint(0x9d4edd);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }

  public setMovement(speed: number, direction: 1 | -1): void {
    this.setVelocityX(speed * direction);
    this.setFlipX(direction < 0);
  }

  public onHit(): void {
    if (this.alreadyHit) {
      return;
    }

    this.alreadyHit = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    const emoji = this.scene.add.text(this.x, this.y - 28, Math.random() > 0.35 ? '🤢' : '!', {
      fontFamily: 'Verdana',
      fontSize: '20px',
      color: '#111'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 12,
      angle: 14,
      duration: 120,
      yoyo: true,
      repeat: 1
    });

    this.scene.tweens.add({
      targets: emoji,
      y: emoji.y - 16,
      alpha: 0,
      duration: 600,
      onComplete: () => emoji.destroy()
    });

    this.scene.time.delayedCall(620, () => this.destroy());
  }

  public get scoreValue(): number {
    return this.highValue ? 20 : 12;
  }

  public get chaosValue(): number {
    return this.highValue ? 9 : 6;
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.x < -40 || this.x > GAME_WIDTH + 40) {
      this.destroy();
    }
  }
}
