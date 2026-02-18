import Phaser from 'phaser';
import { level1 } from '../data/levels/level1';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { Poop } from '../entities/Poop';
import { Seagull } from '../entities/Seagull';
import { MissionSystem } from '../systems/MissionSystem';
import { ScoreComboSystem } from '../systems/ScoreComboSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

export class ChaosMissionScene extends Phaser.Scene {
  private seagull!: Seagull;
  private poops!: Phaser.Physics.Arcade.Group;
  private humans!: Phaser.Physics.Arcade.Group;
  private cars!: Phaser.Physics.Arcade.Group;

  private spawnSystem!: SpawnSystem;
  private scoreSystem!: ScoreComboSystem;
  private missionSystem!: MissionSystem;

  private hudScore!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudChaos!: Phaser.GameObjects.Text;
  private hudObjectives!: Phaser.GameObjects.Text;

  private finished = false;

  constructor() {
    super(SCENE_KEYS.Chaos);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0x8ecae6);

    this.drawBackdrop();

    this.poops = this.physics.add.group({ runChildUpdate: true });
    this.humans = this.physics.add.group({ runChildUpdate: true });
    this.cars = this.physics.add.group({ runChildUpdate: true });

    this.scoreSystem = new ScoreComboSystem();
    this.missionSystem = new MissionSystem(level1);

    this.seagull = new Seagull(this, GAME_WIDTH / 2, 70);

    this.spawnSystem = new SpawnSystem(this, this.humans, this.cars);
    this.spawnSystem.start();

    this.physics.add.overlap(this.poops, this.humans, (poopObj, humanObj) => {
      this.handleHit(poopObj as Poop, humanObj as Human, 12, 8);
    });

    this.physics.add.overlap(this.poops, this.cars, (poopObj, carObj) => {
      this.handleHit(poopObj as Poop, carObj as Car, 22, 12);
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.seagull.dropPoop(this.poops, () => this.onMiss());
    });
    this.input.on('pointerdown', () => {
      this.seagull.dropPoop(this.poops, () => this.onMiss());
    });

    this.hudScore = this.add.text(16, 12, '', this.hudStyle());
    this.hudCombo = this.add.text(16, 36, '', this.hudStyle());
    this.hudChaos = this.add.text(16, 60, '', this.hudStyle());
    this.hudObjectives = this.add.text(16, 84, '', this.hudStyle());
  }

  public update(_: number, delta: number): void {
    if (this.finished) {
      return;
    }

    this.seagull.update();
    this.scoreSystem.update(delta);
    this.missionSystem.update(delta / 1000);

    this.hudScore.setText(`Score: ${this.scoreSystem.score}`);
    this.hudCombo.setText(`Combo: x${this.scoreSystem.combo}`);
    this.hudChaos.setText(`Chaos: ${this.missionSystem.chaosMeter}/100`);
    this.hudObjectives.setText(
      `${this.missionSystem.objectivesText} | Time: ${Math.ceil(this.missionSystem.timeRemainingSec)}s`
    );

    if (this.missionSystem.isComplete || this.missionSystem.isFailed) {
      this.finishRun();
    }
  }

  private onMiss(): void {
    this.scoreSystem.onMiss();
  }

  private handleHit(
    poop: Poop,
    target: Human | Car,
    scoreValue: number,
    chaosGain: number
  ): void {
    if (poop.isResolved) {
      return;
    }

    poop.splat();
    target.onHit();
    this.scoreSystem.onHit(scoreValue);

    if (target instanceof Human) {
      this.missionSystem.registerHit('human', chaosGain);
      return;
    }

    this.missionSystem.registerHit('car', chaosGain);
  }

  private finishRun(): void {
    this.finished = true;
    this.spawnSystem.stop();

    this.scene.start(SCENE_KEYS.Results, {
      score: this.scoreSystem.score,
      mode: 'Chaos Missions',
      success: this.missionSystem.isComplete
    });
  }

  private drawBackdrop(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 36, GAME_WIDTH, 72, 0x7f5539).setOrigin(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 105, GAME_WIDTH, 62, 0x9c6644).setOrigin(0.5);
  }

  private hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Verdana',
      fontSize: '18px',
      color: '#102a43'
    };
  }
}
