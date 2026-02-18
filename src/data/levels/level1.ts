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
  targetChaos: number;
  objectives: MissionObjective[];
}

export const level1: LevelConfig = {
  id: 'level1',
  name: 'Beach Day Breakdown',
  timeLimitSec: 60,
  targetChaos: 50,
  objectives: [
    { id: 'human_hits', label: 'Hit Humans', type: 'human', target: 3 },
    { id: 'car_hits', label: 'Hit Cars', type: 'car', target: 2 }
  ]
};
