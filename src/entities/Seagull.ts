import Phaser from 'phaser';
import { GAME_WIDTH } from '../utils/constants';
import { Poop } from './Poop';

export class Seagull extends Phaser.Physics.Arcade.Sprite {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  private readonly aKey: Phaser.Input.Keyboard.Key | null;
  private readonly dKey: Phaser.Input.Keyboard.Key | null;
  private readonly speed = 260;
  private activePoop: Poop | null = null;

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

  public update(): void {
    const movingLeft = Boolean(this.cursors?.left?.isDown || this.aKey?.isDown);
    const movingRight = Boolean(this.cursors?.right?.isDown || this.dKey?.isDown);

    if (movingLeft && !movingRight) {
      this.setVelocityX(-this.speed);
      this.setFlipX(true);
    } else if (movingRight && !movingLeft) {
      this.setVelocityX(this.speed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    this.x = Phaser.Math.Clamp(this.x, 20, GAME_WIDTH - 20);
  }

  public dropPoop(group: Phaser.Physics.Arcade.Group, onMiss: () => void): void {
    if (this.activePoop && this.activePoop.active) {
      return;
    }

    const poop = new Poop(this.scene, this.x, this.y + 24, onMiss);
    group.add(poop);
    this.activePoop = poop;

    poop.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.activePoop = null;
    });
  }
}
