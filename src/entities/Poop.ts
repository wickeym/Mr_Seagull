import Phaser from 'phaser';
import { PerspectiveSystem } from '../systems/PerspectiveSystem';

interface PoopOptions {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  wind: number;
  chargeRatio: number;
}

export interface PoopImpact {
  x: number;
  y: number;
  z: number;
  scoreMultiplier: number;
}

export class Poop extends Phaser.GameObjects.Sprite {
  private elapsedSec = 0;
  private resolved = false;
  private impactReady = false;

  private readonly startX: number;
  private readonly startY: number;
  private readonly impactX: number;
  private readonly impactY: number;
  private readonly impactZ: number;
  private readonly travelSec: number;
  private readonly scoreMultiplierValue: number;

  constructor(scene: Phaser.Scene, options: PoopOptions) {
    super(scene, 0, 0, 'poop');

    this.startX = options.startX;
    this.startY = options.startY;
    this.impactX = Phaser.Math.Clamp(options.targetX + options.wind * 0.22, -1.15, 1.15);
    this.impactY = Phaser.Math.Clamp(options.targetY + 0.08, -0.95, 1.1);
    this.impactZ = Phaser.Math.Linear(2.9, 2.1, options.chargeRatio);
    this.travelSec = Phaser.Math.Linear(0.8, 0.45, options.chargeRatio);
    this.scoreMultiplierValue = 1 + options.chargeRatio * 0.2;

    scene.add.existing(this);
    this.setDepth(18);
    this.setScale(0.4);
  }

  public updateFlight(deltaSec: number, perspective: PerspectiveSystem): void {
    if (this.resolved) {
      return;
    }

    this.elapsedSec += deltaSec;
    const t = Phaser.Math.Clamp(this.elapsedSec / this.travelSec, 0, 1);

    const worldX = Phaser.Math.Linear(this.startX, this.impactX, t);
    const worldY = Phaser.Math.Linear(this.startY, this.impactY, t);
    const worldZ = Phaser.Math.Linear(0.85, this.impactZ, t);

    const projection = perspective.project(worldX, worldY, worldZ);
    this.setVisible(projection.visible);
    if (projection.visible) {
      this.setPosition(projection.x, projection.y);
      this.setScale(projection.scale * 0.55);
      this.setAlpha(1 - t * 0.15);
    }

    if (t >= 1) {
      this.impactReady = true;
    }
  }

  public consumeImpact(): PoopImpact | null {
    if (!this.impactReady || this.resolved) {
      return null;
    }

    this.resolved = true;
    this.impactReady = false;

    const impact: PoopImpact = {
      x: this.impactX,
      y: this.impactY,
      z: this.impactZ,
      scoreMultiplier: this.scoreMultiplierValue
    };

    this.destroy();
    return impact;
  }

  public markMissed(): void {
    if (this.resolved) {
      return;
    }

    this.resolved = true;
    this.destroy();
  }

  public get isResolved(): boolean {
    return this.resolved;
  }
}
