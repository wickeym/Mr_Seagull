import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Menu);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0x8ecae6);

    this.add.text(GAME_WIDTH / 2, 130, 'Mr. Seagull', {
      fontFamily: 'Verdana',
      fontSize: '56px',
      color: '#102a43'
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 190, 'Drop chaos from the skies', {
      fontFamily: 'Verdana',
      fontSize: '20px',
      color: '#1b4965'
    }).setOrigin(0.5);

    this.makeButton(GAME_HEIGHT / 2 + 10, '1 / C - Start Chaos Missions', () => {
      this.scene.start(SCENE_KEYS.Chaos);
    });

    this.makeButton(GAME_HEIGHT / 2 + 76, '2 / A - Start Arcade', () => {
      this.scene.start(SCENE_KEYS.Arcade);
    });

    this.input.keyboard?.on('keydown-ONE', () => this.scene.start(SCENE_KEYS.Chaos));
    this.input.keyboard?.on('keydown-C', () => this.scene.start(SCENE_KEYS.Chaos));
    this.input.keyboard?.on('keydown-TWO', () => this.scene.start(SCENE_KEYS.Arcade));
    this.input.keyboard?.on('keydown-A', () => this.scene.start(SCENE_KEYS.Arcade));
  }

  private makeButton(y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.add.text(GAME_WIDTH / 2, y, label, {
      fontFamily: 'Verdana',
      fontSize: '28px',
      backgroundColor: '#ffffff',
      color: '#102a43',
      padding: { x: 14, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setStyle({ backgroundColor: '#ffedd5' }));
    button.on('pointerout', () => button.setStyle({ backgroundColor: '#ffffff' }));
    button.on('pointerdown', onClick);

    return button;
  }
}
