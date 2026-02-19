import Phaser from 'phaser';
import { GAME_WIDTH } from '../utils/constants';

export class Car extends Phaser.Physics.Arcade.Sprite {
  private alreadyHit = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'car');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(3);

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

    const emoji = this.scene.add.text(this.x, this.y - 30, Math.random() > 0.5 ? '🤢' : '!', {
      fontFamily: 'Verdana',
      fontSize: '20px',
      color: '#111'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 9,
      angle: 10,
      duration: 100,
      yoyo: true,
      repeat: 2
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
    return 22;
  }

  public get chaosValue(): number {
    return 14;
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.x < -65 || this.x > GAME_WIDTH + 65) {
      this.destroy();
    }
  }
}
