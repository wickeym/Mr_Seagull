import type { LevelConfig, ObjectiveType } from '../data/levels/level1';

interface ObjectiveProgress {
  id: string;
  label: string;
  type: ObjectiveType;
  target: number;
  current: number;
}

export class MissionSystem {
  private readonly level: LevelConfig;
  private readonly objectives: ObjectiveProgress[];
  private chaosMeterValue = 0;
  private timeRemainingSecValue: number;

  constructor(level: LevelConfig) {
    this.level = level;
    this.objectives = level.objectives.map((objective) => ({
      ...objective,
      current: 0
    }));
    this.timeRemainingSecValue = level.timeLimitSec;
  }

  public update(deltaSec: number): void {
    this.timeRemainingSecValue = Math.max(0, this.timeRemainingSecValue - deltaSec);
  }

  public registerHit(type: ObjectiveType, chaosGain: number): void {
    this.chaosMeterValue = Math.min(100, this.chaosMeterValue + chaosGain);

    const objective = this.objectives.find((item) => item.type === type);
    if (objective) {
      objective.current = Math.min(objective.target, objective.current + 1);
    }
  }

  public get chaosMeter(): number {
    return this.chaosMeterValue;
  }

  public get timeRemainingSec(): number {
    return this.timeRemainingSecValue;
  }

  public get objectivesText(): string {
    return this.objectives.map((item) => `${item.label}: ${item.current}/${item.target}`).join(' | ');
  }

  public get isComplete(): boolean {
    const objectivesDone = this.objectives.every((item) => item.current >= item.target);
    return objectivesDone && this.chaosMeterValue >= this.level.targetChaos;
  }

  public get isFailed(): boolean {
    return this.timeRemainingSecValue <= 0 && !this.isComplete;
  }
}
