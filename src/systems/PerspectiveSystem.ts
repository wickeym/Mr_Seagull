import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';

export interface ProjectionResult {
  x: number;
  y: number;
  scale: number;
  depth: number;
  visible: boolean;
}

export class PerspectiveSystem {
  public readonly nearZ = 0.7;
  public readonly farZ = 10.5;

  private readonly centerX = GAME_WIDTH / 2;
  private readonly horizonY = 112;
  private readonly groundY = GAME_HEIGHT - 24;

  public project(worldX: number, worldY: number, worldZ: number): ProjectionResult {
    const visible = worldZ >= this.nearZ && worldZ <= this.farZ;
    if (!visible) {
      return {
        x: -1000,
        y: -1000,
        scale: 0,
        depth: 0,
        visible: false
      };
    }

    const depth = Phaser.Math.Clamp((this.farZ - worldZ) / (this.farZ - this.nearZ), 0, 1);
    const spread = Phaser.Math.Linear(28, 460, depth);
    const rowShift = worldY * Phaser.Math.Linear(8, 132, depth);

    return {
      x: this.centerX + worldX * spread,
      y: Phaser.Math.Linear(this.horizonY, this.groundY, depth) + rowShift,
      scale: Phaser.Math.Linear(0.2, 1.35, depth),
      depth,
      visible: true
    };
  }

  public get horizonLineY(): number {
    return this.horizonY;
  }
}
