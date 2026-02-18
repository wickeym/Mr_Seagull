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
    this.setTint(0xe63946);

    const bubble = this.scene.add.text(this.x, this.y - 28, 'HONK?!', {
      fontFamily: 'Verdana',
      fontSize: '12px',
      color: '#111'
    });
    bubble.setOrigin(0.5);

    this.scene.tweens.add({
      targets: [this, bubble],
      angle: 8,
      duration: 70,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        bubble.destroy();
        this.destroy();
      }
    });
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.x < -60 || this.x > GAME_WIDTH + 60) {
      this.destroy();
    }
  }
}
