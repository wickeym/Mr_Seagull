export type ObjectiveType = 'human' | 'car';

export interface MissionObjective {
  id: string;
  label: string;
  type: ObjectiveType;
  target: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  timeLimitSec: number;
  objectives: MissionObjective[];
  chaosDecayPerSec: number;
}

export const level1: LevelConfig = {
  id: 'level1',
  name: 'Beach Day Breakdown',
  timeLimitSec: 90,
  chaosDecayPerSec: 3,
  objectives: [
    { id: 'human_hits', label: 'Hit Humans', type: 'human', target: 5 },
    { id: 'car_hits', label: 'Hit Cars', type: 'car', target: 2 }
  ]
};
