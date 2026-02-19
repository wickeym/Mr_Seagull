import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, STORAGE_KEYS } from '../utils/constants';

interface ResultsData {
  score?: number;
  mode?: string;
  success?: boolean;
  summary?: string;
}

export class ResultsScene extends Phaser.Scene {
  private dataFromRun: Required<ResultsData> = {
    score: 0,
    mode: 'Arcade',
    success: false,
    summary: ''
  };

  constructor() {
    super(SCENE_KEYS.Results);
  }

  public init(data: ResultsData): void {
    this.dataFromRun = {
      score: data.score ?? 0,
      mode: data.mode ?? 'Arcade',
      success: data.success ?? false,
      summary: data.summary ?? ''
    };
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0xf1faee);

    this.add.text(GAME_WIDTH / 2, 88, 'Results', {
      fontFamily: 'Verdana',
      fontSize: '54px',
      color: '#1d3557'
    }).setOrigin(0.5);

    const status = this.dataFromRun.success ? 'WIN' : 'LOSE';
    const detailLines = [
      `Mode: ${this.dataFromRun.mode}`,
      `Score: ${this.dataFromRun.score}`,
      `Status: ${status}`
    ];

    if (this.dataFromRun.mode === 'Arcade') {
      const best = this.updateAndGetBestArcadeScore(this.dataFromRun.score);
      detailLines.push(`Best: ${best}`);
    }

    if (this.dataFromRun.summary.length > 0) {
      detailLines.push(this.dataFromRun.summary);
    }

    this.add.text(GAME_WIDTH / 2, 220, detailLines.join('\n'), {
      fontFamily: 'Verdana',
      fontSize: '24px',
      color: '#1d3557',
      align: 'center',
      wordWrap: { width: 820 }
    }).setOrigin(0.5);

    const backText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'Press ENTER or tap here to return to Menu', {
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

  private updateAndGetBestArcadeScore(score: number): number {
    const previousRaw = window.localStorage.getItem(STORAGE_KEYS.arcadeBestScore);
    const previousBest = previousRaw ? Number(previousRaw) : 0;
    const safePrevious = Number.isFinite(previousBest) ? previousBest : 0;

    const best = Math.max(safePrevious, score);
    window.localStorage.setItem(STORAGE_KEYS.arcadeBestScore, String(best));
    return best;
  }
}
