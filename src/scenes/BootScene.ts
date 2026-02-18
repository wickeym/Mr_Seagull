import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../utils/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  public create(): void {
    this.scale.scaleMode = Phaser.Scale.FIT;
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH;

    this.cameras.main.setBackgroundColor(COLORS.sky);
    this.scene.start(SCENE_KEYS.Preload);
  }
}
