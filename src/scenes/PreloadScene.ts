import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

function makeRectDataUrl(
  width: number,
  height: number,
  fill: string,
  border: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('2D canvas context is unavailable');
  }

  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  return canvas.toDataURL('image/png');
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Preload);
  }

  public preload(): void {
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();

    const barWidth = 420;
    const barHeight = 28;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = (GAME_HEIGHT - barHeight) / 2;

    progressBox.fillStyle(0x1b4965, 0.35);
    progressBox.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);

    this.add.text(GAME_WIDTH / 2, y - 26, 'Loading Mr. Seagull...', {
      fontFamily: 'Verdana',
      fontSize: '18px',
      color: '#102a43'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffb703, 1);
      progressBar.fillRect(x, y, barWidth * value, barHeight);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      this.scene.start(SCENE_KEYS.Menu);
    });

    this.load.image('seagull', makeRectDataUrl(44, 22, '#f5f5f5', '#023047'));
    this.load.image('poop', makeRectDataUrl(12, 14, '#6d4c41', '#3e2723'));
    this.load.image('human', makeRectDataUrl(20, 32, '#8ecae6', '#219ebc'));
    this.load.image('car', makeRectDataUrl(46, 20, '#e76f51', '#9b2226'));
    this.load.image('ui-dot', makeRectDataUrl(8, 8, '#fb8500', '#fb8500'));
  }
}
