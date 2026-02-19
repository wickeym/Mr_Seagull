import Phaser from 'phaser';
import { level1 } from '../data/levels/level1';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { Poop } from '../entities/Poop';
import { Seagull } from '../entities/Seagull';
import { AudioSystem } from '../systems/AudioSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { MobileControls } from '../systems/MobileControls';
import { ScoreComboSystem } from '../systems/ScoreComboSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WindSystem } from '../systems/WindSystem';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

export class ChaosMissionScene extends Phaser.Scene {
  private seagull!: Seagull;
  private poops!: Phaser.Physics.Arcade.Group;
  private humans!: Phaser.Physics.Arcade.Group;
  private cars!: Phaser.Physics.Arcade.Group;

  private spawnSystem!: SpawnSystem;
  private scoreSystem!: ScoreComboSystem;
  private missionSystem!: MissionSystem;
  private windSystem!: WindSystem;
  private audioSystem!: AudioSystem;
  private mobileControls?: MobileControls;

  private hudScore!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudChaos!: Phaser.GameObjects.Text;
  private hudObjectives!: Phaser.GameObjects.Text;
  private hudWind!: Phaser.GameObjects.Text;
  private hudDrop!: Phaser.GameObjects.Text;

  private finished = false;
  private spaceHeld = false;

  constructor() {
    super(SCENE_KEYS.Chaos);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0x8ecae6);

    this.drawBackdrop();

    this.poops = this.physics.add.group({ runChildUpdate: true });
    this.humans = this.physics.add.group({ runChildUpdate: true });
    this.cars = this.physics.add.group({ runChildUpdate: true });

    this.scoreSystem = new ScoreComboSystem(1200);
    this.missionSystem = new MissionSystem(level1);
    this.windSystem = new WindSystem();
    this.audioSystem = new AudioSystem();

    this.seagull = new Seagull(this, GAME_WIDTH / 2, 72);

    this.spawnSystem = new SpawnSystem(this, this.humans, this.cars);
    this.spawnSystem.start();

    this.physics.add.overlap(this.poops, this.humans, (poopObj, humanObj) => {
      this.handleHit(poopObj as Poop, humanObj as Human);
    });

    this.physics.add.overlap(this.poops, this.cars, (poopObj, carObj) => {
      this.handleHit(poopObj as Poop, carObj as Car);
    });

    this.hudScore = this.add.text(16, 12, '', this.hudStyle());
    this.hudCombo = this.add.text(16, 36, '', this.hudStyle());
    this.hudChaos = this.add.text(16, 60, '', this.hudStyle());
    this.hudObjectives = this.add.text(16, 84, '', this.hudStyle());
    this.hudWind = this.add.text(16, 108, '', this.hudStyle());
    this.hudDrop = this.add.text(16, 132, '', this.hudStyle());

    this.bindInput();
    this.mobileControls = new MobileControls(
      this,
      () => this.startCharge(),
      () => this.releaseDrop()
    );
  }

  public update(_: number, delta: number): void {
    if (this.finished) {
      return;
    }

    this.seagull.setVirtualInput(
      this.mobileControls?.leftPressed ?? false,
      this.mobileControls?.rightPressed ?? false
    );
    this.seagull.update(delta);

    this.windSystem.update(delta / 1000);
    this.scoreSystem.update(delta);
    this.missionSystem.update(delta / 1000);

    this.hudScore.setText(`Score: ${this.scoreSystem.score}`);
    this.hudCombo.setText(`Combo: x${this.scoreSystem.combo}`);
    this.hudChaos.setText(`Chaos Meter: ${this.missionSystem.chaosMeter}/100`);
    this.hudObjectives.setText(
      `${this.missionSystem.objectivesText} | Time: ${Math.ceil(this.missionSystem.timeRemainingSec)}s`
    );
    this.hudWind.setText(this.windSystem.indicatorText);
    this.hudDrop.setText(this.dropStatusText());

    if (this.missionSystem.isComplete || this.missionSystem.isFailed) {
      this.finishRun();
    }
  }

  public shutdown(): void {
    this.mobileControls?.destroy();
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.on('keydown-SPACE', () => {
      if (this.spaceHeld || this.finished) {
        return;
      }

      this.spaceHeld = true;
      this.startCharge();
    });

    keyboard?.on('keyup-SPACE', () => {
      if (!this.spaceHeld || this.finished) {
        return;
      }

      this.spaceHeld = false;
      this.releaseDrop();
    });

    const primeAudio = (): void => this.audioSystem.prime();
    this.input.once('pointerdown', primeAudio);
    keyboard?.once('keydown', primeAudio);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  private startCharge(): void {
    this.audioSystem.prime();
    this.seagull.startCharge(this.time.now);
  }

  private releaseDrop(): void {
    const poop = this.seagull.releaseDrop(this.time.now, this.poops, {
      windProvider: () => this.windSystem.value,
      onMiss: () => this.onMiss()
    });

    if (!poop) {
      return;
    }
  }

  private onMiss(): void {
    this.scoreSystem.onMiss();

    const missText = this.add.text(this.seagull.x, GAME_HEIGHT - 52, 'MISS', {
      fontFamily: 'Verdana',
      fontSize: '16px',
      color: '#e63946'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: missText,
      y: missText.y - 12,
      alpha: 0,
      duration: 380,
      onComplete: () => missText.destroy()
    });
  }

  private handleHit(poop: Poop, target: Human | Car): void {
    if (poop.isResolved) {
      return;
    }

    poop.splat();
    target.onHit();

    const baseScore = this.scoreFromTarget(target);
    this.scoreSystem.onHit(Math.round(baseScore * poop.scoreMultiplier));

    const chaosGain = target.chaosValue;
    this.missionSystem.registerHit(target instanceof Human ? 'human' : 'car', chaosGain);

    this.playSplatFeedback(target.x, target.y);
  }

  private scoreFromTarget(target: Human | Car): number {
    if (target instanceof Human) {
      return target.scoreValue;
    }

    return target.scoreValue;
  }

  private playSplatFeedback(x: number, y: number): void {
    this.audioSystem.playSplat();
    this.cameras.main.shake(80, 0.0035);

    const splat = this.add.circle(x, y, 6, 0x6d4c41, 0.7).setDepth(9);
    this.tweens.add({
      targets: splat,
      radius: 28,
      alpha: 0,
      duration: 240,
      onComplete: () => splat.destroy()
    });

    for (let i = 0; i < 8; i += 1) {
      const dot = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0x5b3a29, 0.9).setDepth(9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(12, 36);

      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 260,
        onComplete: () => dot.destroy()
      });
    }
  }

  private finishRun(): void {
    this.finished = true;
    this.spawnSystem.stop();

    this.scene.start(SCENE_KEYS.Results, {
      score: this.scoreSystem.score,
      mode: 'Chaos Missions',
      success: this.missionSystem.isComplete,
      summary: this.missionSystem.summary
    });
  }

  private dropStatusText(): string {
    const cooldown = this.seagull.cooldownRemainingMs;
    if (cooldown > 0) {
      return `Drop Cooldown: ${(cooldown / 1000).toFixed(1)}s`;
    }

    const charge = this.seagull.chargePreviewRatio;
    if (charge > 0) {
      return `Charge: ${Math.round(charge * 100)}%`;
    }

    return 'Drop: SPACE (hold to charge)';
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
