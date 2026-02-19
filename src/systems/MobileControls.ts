import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';

interface MobileState {
  leftPressed: boolean;
  rightPressed: boolean;
  upPressed: boolean;
  downPressed: boolean;
}

export class MobileControls {
  private readonly scene: Phaser.Scene;
  private readonly state: MobileState = {
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false
  };

  private readonly root: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    onDropStart: () => void,
    onDropRelease: () => void
  ) {
    this.scene = scene;
    this.root = this.scene.add.container(0, 0);
    this.root.setDepth(60);

    const baseX = 110;
    const baseY = GAME_HEIGHT - 78;

    const leftButton = this.makeButton(baseX - 52, baseY, '<');
    const rightButton = this.makeButton(baseX + 52, baseY, '>');
    const upButton = this.makeButton(baseX, baseY - 52, '^');
    const downButton = this.makeButton(baseX, baseY + 4, 'v');
    const dropButton = this.makeButton(GAME_WIDTH - 96, GAME_HEIGHT - 74, 'DROP', 42);

    this.bindHold(leftButton, (pressed) => {
      this.state.leftPressed = pressed;
    });

    this.bindHold(rightButton, (pressed) => {
      this.state.rightPressed = pressed;
    });

    this.bindHold(upButton, (pressed) => {
      this.state.upPressed = pressed;
    });

    this.bindHold(downButton, (pressed) => {
      this.state.downPressed = pressed;
    });

    dropButton.on('pointerdown', () => onDropStart());
    dropButton.on('pointerup', () => onDropRelease());
    dropButton.on('pointerout', () => onDropRelease());

    this.root.add([leftButton, rightButton, upButton, downButton, dropButton]);
  }

  public get leftPressed(): boolean {
    return this.state.leftPressed;
  }

  public get rightPressed(): boolean {
    return this.state.rightPressed;
  }

  public get upPressed(): boolean {
    return this.state.upPressed;
  }

  public get downPressed(): boolean {
    return this.state.downPressed;
  }

  public destroy(): void {
    this.root.destroy(true);
  }

  private makeButton(x: number, y: number, label: string, radius = 32): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.circle(0, 0, radius, 0xffffff, 0.35);
    bg.setStrokeStyle(2, 0x0b2545, 0.5);

    const text = this.scene.add.text(0, 0, label, {
      fontFamily: 'Verdana',
      fontSize: label === 'DROP' ? '15px' : '22px',
      color: '#0b2545'
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(radius * 2, radius * 2);
    container.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);

    return container;
  }

  private bindHold(button: Phaser.GameObjects.Container, onStateChange: (pressed: boolean) => void): void {
    button.on('pointerdown', () => onStateChange(true));
    button.on('pointerup', () => onStateChange(false));
    button.on('pointerout', () => onStateChange(false));
  }
}
