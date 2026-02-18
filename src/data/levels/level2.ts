import type { LevelConfig } from './level1';

export const level2: LevelConfig = {
  id: 'level2',
  name: 'Boardwalk Mayhem',
  timeLimitSec: 75,
  targetChaos: 70,
  objectives: [
    { id: 'human_hits', label: 'Hit Humans', type: 'human', target: 5 },
    { id: 'car_hits', label: 'Hit Cars', type: 'car', target: 4 }
  ]
};
