export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const SCENE_KEYS = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Menu: 'MenuScene',
  Chaos: 'ChaosMissionScene',
  Arcade: 'ArcadeScene',
  Results: 'ResultsScene'
} as const;

export const COLORS = {
  sky: 0x8ecae6,
  ground: 0x8d6e63,
  text: '#102a43',
  panel: 0xffffff
} as const;
