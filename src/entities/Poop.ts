import Phaser from 'phaser';
import { GAME_HEIGHT } from '../utils/constants';

export class Poop extends Phaser.Physics.Arcade.Sprite {
  private resolved = false;
  private readonly onMissCallback: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onMissCallback: () => void
  ) {
    super(scene, x, y, 'poop');
    this.onMissCallback = onMissCallback;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(1.1);
    this.setDepth(5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setVelocityY(280);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (!this.resolved && this.y > GAME_HEIGHT + 20) {
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
    this.setTint(0x6d4c41);

    this.scene.tweens.add({
      targets: this,
      scaleX: 1.8,
      scaleY: 0.4,
      alpha: 0.75,
      duration: 160,
      onComplete: () => this.destroy()
    });
  }

  public get isResolved(): boolean {
    return this.resolved;
  }
}
