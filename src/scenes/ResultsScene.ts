import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

interface ResultsData {
  score?: number;
  mode?: string;
  success?: boolean;
}

export class ResultsScene extends Phaser.Scene {
  private dataFromRun: Required<ResultsData> = {
    score: 0,
    mode: 'Arcade',
    success: false
  };

  constructor() {
    super(SCENE_KEYS.Results);
  }

  public init(data: ResultsData): void {
    this.dataFromRun = {
      score: data.score ?? 0,
      mode: data.mode ?? 'Arcade',
      success: data.success ?? false
    };
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0xf1faee);

    this.add.text(GAME_WIDTH / 2, 120, 'Results', {
      fontFamily: 'Verdana',
      fontSize: '54px',
      color: '#1d3557'
    }).setOrigin(0.5);

    this.add.text(
      GAME_WIDTH / 2,
      220,
      `Mode: ${this.dataFromRun.mode}\nScore: ${this.dataFromRun.score}\nStatus: ${
        this.dataFromRun.success ? 'Success' : 'Mission Failed'
      }`,
      {
        fontFamily: 'Verdana',
        fontSize: '26px',
        color: '#1d3557',
        align: 'center'
      }
    ).setOrigin(0.5);

    const backText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 120, 'Press ENTER or click to return to Menu', {
      fontFamily: 'Verdana',
      fontSize: '24px',
      color: '#e63946',
      backgroundColor: '#ffffff',
      padding: { x: 12, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const goBack = (): void => {
      this.scene.start(SCENE_KEYS.Menu);
    };

    backText.on('pointerdown', goBack);
    this.input.keyboard?.once('keydown-ENTER', goBack);
  }
}
