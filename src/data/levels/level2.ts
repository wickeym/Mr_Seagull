import type { LevelConfig } from './level1';

export const level2: LevelConfig = {
  id: 'level2',
  name: 'Boardwalk Mayhem',
  timeLimitSec: 100,
  chaosDecayPerSec: 4,
  objectives: [
    { id: 'human_hits', label: 'Hit Humans', type: 'human', target: 8 },
    { id: 'car_hits', label: 'Hit Cars', type: 'car', target: 4 }
  ]
};
