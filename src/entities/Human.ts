import Phaser from 'phaser';
import { PerspectiveSystem } from '../systems/PerspectiveSystem';

export class Human extends Phaser.GameObjects.Sprite {
  private hit = false;
  private readonly highValue: boolean;

  public worldX = 0;
  public worldY = 0;
  public worldZ = 0;
  public zSpeed = 0;

  constructor(scene: Phaser.Scene, highValue = false) {
    super(scene, 0, 0, 'human');

    this.highValue = highValue;

    scene.add.existing(this);
    this.setDepth(8);

    if (this.highValue) {
      this.setTint(0x9d4edd);
    }
  }

  public setWorldState(worldX: number, worldY: number, worldZ: number, zSpeed: number): void {
    this.worldX = worldX;
    this.worldY = worldY;
    this.worldZ = worldZ;
    this.zSpeed = zSpeed;
  }

  public updateFlight(deltaSec: number): void {
    if (this.hit) {
      return;
    }

    this.worldZ -= this.zSpeed * deltaSec;
  }

  public render(perspective: PerspectiveSystem): void {
    if (this.hit) {
      return;
    }

    const projection = perspective.project(this.worldX, this.worldY, this.worldZ);
    this.setVisible(projection.visible);
    if (!projection.visible) {
      return;
    }

    this.setPosition(projection.x, projection.y);
    this.setScale(projection.scale * (this.highValue ? 1.07 : 1));
  }

  public onHit(): void {
    if (this.hit) {
      return;
    }

    this.hit = true;

    const emoji = this.scene.add.text(this.x, this.y - 24, Math.random() > 0.35 ? '🤢' : '!', {
      fontFamily: 'Verdana',
      fontSize: '20px',
      color: '#111'
    }).setOrigin(0.5).setDepth(30);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 12,
      angle: 13,
      duration: 110,
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

  public get wasHit(): boolean {
    return this.hit;
  }

  public get isOutOfRange(): boolean {
    return this.worldZ < 0.45;
  }
}
