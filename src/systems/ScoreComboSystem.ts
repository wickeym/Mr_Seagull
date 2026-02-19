export class ScoreComboSystem {
  private scoreValue = 0;
  private comboMultiplier = 1;
  private comboWindowRemainingMs = 0;
  private readonly comboWindowMs: number;

  constructor(comboWindowMs = 1200) {
    this.comboWindowMs = comboWindowMs;
  }

  public update(deltaMs: number): void {
    if (this.comboWindowRemainingMs <= 0) {
      return;
    }

    this.comboWindowRemainingMs = Math.max(0, this.comboWindowRemainingMs - deltaMs);

    if (this.comboWindowRemainingMs === 0) {
      this.comboMultiplier = 1;
    }
  }

  public onHit(value: number): number {
    if (this.comboWindowRemainingMs > 0) {
      this.comboMultiplier += 1;
    } else {
      this.comboMultiplier = 1;
    }

    const gained = Math.round(value * this.comboMultiplier);
    this.scoreValue += gained;
    this.comboWindowRemainingMs = this.comboWindowMs;
    return gained;
  }

  public onMiss(): void {
    this.comboMultiplier = 1;
    this.comboWindowRemainingMs = 0;
  }

  public get score(): number {
    return this.scoreValue;
  }

  public get combo(): number {
    return this.comboMultiplier;
  }
}
