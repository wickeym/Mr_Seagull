import { randomInt } from '../utils/rng';

export class WindSystem {
  private windValue = 0;
  private windTarget = 0;
  private targetRefreshSec = 0;

  public update(deltaSec: number): void {
    this.targetRefreshSec -= deltaSec;
    if (this.targetRefreshSec <= 0) {
      this.windTarget = randomInt(-100, 100) / 100;
      this.targetRefreshSec = randomInt(2, 5);
    }

    const lerpFactor = Math.min(1, deltaSec * 0.55);
    this.windValue += (this.windTarget - this.windValue) * lerpFactor;
  }

  public get value(): number {
    return this.windValue;
  }

  public get indicatorText(): string {
    const magnitude = Math.abs(this.windValue);
    if (magnitude < 0.15) {
      return 'Wind: calm';
    }

    const arrow = this.windValue > 0 ? '->' : '<-';
    const strength = magnitude > 0.75 ? 'strong' : magnitude > 0.35 ? 'steady' : 'light';
    return `Wind: ${arrow} ${strength}`;
  }
}
