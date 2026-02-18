import Phaser from 'phaser';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { Poop } from '../entities/Poop';
import { Seagull } from '../entities/Seagull';
import { ScoreComboSystem } from '../systems/ScoreComboSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

export class ArcadeScene extends Phaser.Scene {
  private seagull!: Seagull;
  private poops!: Phaser.Physics.Arcade.Group;
  private humans!: Phaser.Physics.Arcade.Group;
  private cars!: Phaser.Physics.Arcade.Group;

  private spawnSystem!: SpawnSystem;
  private scoreSystem!: ScoreComboSystem;

  private hudScore!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudTime!: Phaser.GameObjects.Text;

  private timeLeftSec = 60;
  private finished = false;

  constructor() {
    super(SCENE_KEYS.Arcade);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0xbde0fe);
    this.drawBackdrop();

    this.poops = this.physics.add.group({ runChildUpdate: true });
    this.humans = this.physics.add.group({ runChildUpdate: true });
    this.cars = this.physics.add.group({ runChildUpdate: true });

    this.scoreSystem = new ScoreComboSystem();
    this.seagull = new Seagull(this, GAME_WIDTH / 2, 70);

    this.spawnSystem = new SpawnSystem(this, this.humans, this.cars);
    this.spawnSystem.start();

    this.physics.add.overlap(this.poops, this.humans, (poopObj, humanObj) => {
      this.handleHit(poopObj as Poop, humanObj as Human, 10);
    });

    this.physics.add.overlap(this.poops, this.cars, (poopObj, carObj) => {
      this.handleHit(poopObj as Poop, carObj as Car, 20);
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.seagull.dropPoop(this.poops, () => this.scoreSystem.onMiss());
    });
    this.input.on('pointerdown', () => {
      this.seagull.dropPoop(this.poops, () => this.scoreSystem.onMiss());
    });

    this.hudScore = this.add.text(16, 12, '', this.hudStyle());
    this.hudCombo = this.add.text(16, 36, '', this.hudStyle());
    this.hudTime = this.add.text(16, 60, '', this.hudStyle());
  }

  public update(_: number, delta: number): void {
    if (this.finished) {
      return;
    }

    this.seagull.update();
    this.scoreSystem.update(delta);
    this.timeLeftSec = Math.max(0, this.timeLeftSec - delta / 1000);

    this.hudScore.setText(`Score: ${this.scoreSystem.score}`);
    this.hudCombo.setText(`Combo: x${this.scoreSystem.combo}`);
    this.hudTime.setText(`Time: ${Math.ceil(this.timeLeftSec)}s`);

    if (this.timeLeftSec <= 0) {
      this.finishRun();
    }
  }

  private handleHit(poop: Poop, target: Human | Car, scoreValue: number): void {
    if (poop.isResolved) {
      return;
    }

    poop.splat();
    target.onHit();
    this.scoreSystem.onHit(scoreValue);
  }

  private finishRun(): void {
    this.finished = true;
    this.spawnSystem.stop();
    this.scene.start(SCENE_KEYS.Results, {
      score: this.scoreSystem.score,
      mode: 'Arcade',
      success: true
    });
  }

  private drawBackdrop(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 42, GAME_WIDTH, 84, 0x588157).setOrigin(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 110, GAME_WIDTH, 52, 0xa3b18a).setOrigin(0.5);
  }

  private hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Verdana',
      fontSize: '18px',
      color: '#1d3557'
    };
  }
}
