import Phaser from 'phaser';
import { ArcadeScene } from './scenes/ArcadeScene';
import { BootScene } from './scenes/BootScene';
import { ChaosMissionScene } from './scenes/ChaosMissionScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultsScene } from './scenes/ResultsScene';
import { GAME_HEIGHT, GAME_WIDTH } from './utils/constants';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#8ecae6',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, PreloadScene, MenuScene, ChaosMissionScene, ArcadeScene, ResultsScene]
};

void new Phaser.Game(gameConfig);
