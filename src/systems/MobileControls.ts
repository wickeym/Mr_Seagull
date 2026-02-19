import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';

interface MobileState {
  leftPressed: boolean;
  rightPressed: boolean;
}

export class MobileControls {
  private readonly scene: Phaser.Scene;
  private readonly state: MobileState = {
    leftPressed: false,
    rightPressed: false
  };

  private readonly root: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    onDropStart: () => void,
    onDropRelease: () => void
  ) {
    this.scene = scene;
    this.root = this.scene.add.container(0, 0);
    this.root.setDepth(30);

    const leftButton = this.makeButton(74, GAME_HEIGHT - 70, '<');
    const rightButton = this.makeButton(170, GAME_HEIGHT - 70, '>');
    const dropButton = this.makeButton(GAME_WIDTH - 92, GAME_HEIGHT - 70, 'DROP');

    this.bindHold(leftButton, (pressed) => {
      this.state.leftPressed = pressed;
      if (pressed) {
        this.state.rightPressed = false;
      }
    });

    this.bindHold(rightButton, (pressed) => {
      this.state.rightPressed = pressed;
      if (pressed) {
        this.state.leftPressed = false;
      }
    });

    dropButton.on('pointerdown', () => onDropStart());
    dropButton.on('pointerup', () => onDropRelease());
    dropButton.on('pointerout', () => onDropRelease());

    this.root.add([leftButton, rightButton, dropButton]);
  }

  public get leftPressed(): boolean {
    return this.state.leftPressed;
  }

  public get rightPressed(): boolean {
    return this.state.rightPressed;
  }

  public destroy(): void {
    this.root.destroy(true);
  }

  private makeButton(x: number, y: number, label: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.circle(0, 0, 36, 0xffffff, 0.35);
    bg.setStrokeStyle(2, 0x0b2545, 0.5);

    const text = this.scene.add.text(0, 0, label, {
      fontFamily: 'Verdana',
      fontSize: label === 'DROP' ? '16px' : '22px',
      color: '#0b2545'
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(72, 72);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains);

    return container;
  }

  private bindHold(button: Phaser.GameObjects.Container, onStateChange: (pressed: boolean) => void): void {
    button.on('pointerdown', () => onStateChange(true));
    button.on('pointerup', () => onStateChange(false));
    button.on('pointerout', () => onStateChange(false));
  }
}
