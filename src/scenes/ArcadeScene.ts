import Phaser from 'phaser';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { Poop } from '../entities/Poop';
import type { PoopImpact } from '../entities/Poop';
import { Seagull } from '../entities/Seagull';
import { AudioSystem } from '../systems/AudioSystem';
import { MobileControls } from '../systems/MobileControls';
import { PerspectiveSystem } from '../systems/PerspectiveSystem';
import { ScoreComboSystem } from '../systems/ScoreComboSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { WindSystem } from '../systems/WindSystem';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../utils/constants';

type FlightTarget = Human | Car;

export class ArcadeScene extends Phaser.Scene {
  private readonly humans: Human[] = [];
  private readonly cars: Car[] = [];
  private readonly poops: Poop[] = [];

  private seagull!: Seagull;
  private spawnSystem!: SpawnSystem;
  private scoreSystem!: ScoreComboSystem;
  private windSystem!: WindSystem;
  private audioSystem!: AudioSystem;
  private perspective!: PerspectiveSystem;
  private mobileControls?: MobileControls;

  private hudScore!: Phaser.GameObjects.Text;
  private hudCombo!: Phaser.GameObjects.Text;
  private hudTime!: Phaser.GameObjects.Text;
  private hudWind!: Phaser.GameObjects.Text;
  private hudDrop!: Phaser.GameObjects.Text;

  private timeLeftSec = 60;
  private finished = false;
  private spaceHeld = false;

  constructor() {
    super(SCENE_KEYS.Arcade);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(0xa9def9);

    this.perspective = new PerspectiveSystem();
    this.drawBackdrop();

    this.scoreSystem = new ScoreComboSystem(1200);
    this.windSystem = new WindSystem();
    this.audioSystem = new AudioSystem();

    this.seagull = new Seagull(this);

    this.spawnSystem = new SpawnSystem(this, {
      onHumanSpawn: (human) => this.humans.push(human),
      onCarSpawn: (car) => this.cars.push(car)
    });
    this.spawnSystem.start();

    this.hudScore = this.add.text(16, 12, '', this.hudStyle()).setDepth(70);
    this.hudCombo = this.add.text(16, 36, '', this.hudStyle()).setDepth(70);
    this.hudTime = this.add.text(16, 60, '', this.hudStyle()).setDepth(70);
    this.hudWind = this.add.text(16, 84, '', this.hudStyle()).setDepth(70);
    this.hudDrop = this.add.text(16, 108, '', this.hudStyle()).setDepth(70);

    this.bindInput();
    this.mobileControls = new MobileControls(
      this,
      () => this.startCharge(),
      () => this.releaseDrop()
    );
  }

  public update(_: number, deltaMs: number): void {
    if (this.finished) {
      return;
    }

    const deltaSec = deltaMs / 1000;

    this.seagull.setVirtualInput(
      this.mobileControls?.leftPressed ?? false,
      this.mobileControls?.rightPressed ?? false,
      this.mobileControls?.upPressed ?? false,
      this.mobileControls?.downPressed ?? false
    );
    this.seagull.updateFlight(deltaMs);

    this.scoreSystem.update(deltaMs);
    this.windSystem.update(deltaSec);
    this.timeLeftSec = Math.max(0, this.timeLeftSec - deltaSec);

    this.updateTargets(deltaSec);
    this.updatePoops(deltaSec);

    this.hudScore.setText(`Score: ${this.scoreSystem.score}`);
    this.hudCombo.setText(`Combo: x${this.scoreSystem.combo}`);
    this.hudTime.setText(`Time: ${Math.ceil(this.timeLeftSec)}s`);
    this.hudWind.setText(this.windSystem.indicatorText);
    this.hudDrop.setText(this.dropStatusText());

    if (this.timeLeftSec <= 0) {
      this.finishRun();
    }
  }

  public shutdown(): void {
    this.mobileControls?.destroy();
    this.spawnSystem.stop();
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
    const drop = this.seagull.releaseDrop(this.time.now);
    if (!drop) {
      return;
    }

    const poop = new Poop(this, {
      startX: drop.x,
      startY: drop.y,
      targetX: drop.x,
      targetY: drop.y,
      wind: this.windSystem.value,
      chargeRatio: drop.chargeRatio
    });

    this.poops.push(poop);
  }

  private updateTargets(deltaSec: number): void {
    for (const human of this.humans) {
      if (!human.active) {
        continue;
      }

      human.updateFlight(deltaSec);
      human.render(this.perspective);
      if (!human.wasHit && human.isOutOfRange) {
        human.destroy();
      }
    }

    for (const car of this.cars) {
      if (!car.active) {
        continue;
      }

      car.updateFlight(deltaSec);
      car.render(this.perspective);
      if (!car.wasHit && car.isOutOfRange) {
        car.destroy();
      }
    }

    this.compactDestroyedEntities();
  }

  private updatePoops(deltaSec: number): void {
    for (const poop of this.poops) {
      if (!poop.active) {
        continue;
      }

      poop.updateFlight(deltaSec, this.perspective);
      const impact = poop.consumeImpact();
      if (!impact) {
        continue;
      }

      this.resolveImpact(impact);
    }

    this.compactDestroyedEntities();
  }

  private resolveImpact(impact: PoopImpact): void {
    const target = this.findTargetAtImpact(impact);

    if (!target) {
      this.handleMiss(impact);
      return;
    }

    target.onHit();
    this.scoreSystem.onHit(Math.round(target.scoreValue * impact.scoreMultiplier));
    this.playSplatFeedback(target.x, target.y);
  }

  private findTargetAtImpact(impact: PoopImpact): FlightTarget | null {
    const targets: FlightTarget[] = [];

    for (const human of this.humans) {
      if (human.active && !human.wasHit) {
        targets.push(human);
      }
    }

    for (const car of this.cars) {
      if (car.active && !car.wasHit) {
        targets.push(car);
      }
    }

    let best: FlightTarget | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const target of targets) {
      const dx = Math.abs(target.worldX - impact.x);
      const dy = Math.abs(target.worldY - impact.y);
      const dz = Math.abs(target.worldZ - impact.z);

      if (dx > 0.22 || dy > 0.2 || dz > 0.55) {
        continue;
      }

      const score = dx * 1.8 + dy * 1.2 + dz;
      if (score < bestScore) {
        best = target;
        bestScore = score;
      }
    }

    return best;
  }

  private handleMiss(impact: PoopImpact): void {
    this.scoreSystem.onMiss();

    const projection = this.perspective.project(impact.x, impact.y, impact.z);
    if (projection.visible) {
      const missText = this.add.text(projection.x, projection.y - 12, 'MISS', {
        fontFamily: 'Verdana',
        fontSize: '15px',
        color: '#e63946'
      }).setOrigin(0.5).setDepth(40);

      this.tweens.add({
        targets: missText,
        y: missText.y - 10,
        alpha: 0,
        duration: 330,
        onComplete: () => missText.destroy()
      });
    }
  }

  private playSplatFeedback(x: number, y: number): void {
    this.audioSystem.playSplat();
    this.cameras.main.shake(80, 0.003);

    const splat = this.add.circle(x, y, 6, 0x6d4c41, 0.72).setDepth(32);
    this.tweens.add({
      targets: splat,
      radius: 28,
      alpha: 0,
      duration: 220,
      onComplete: () => splat.destroy()
    });

    for (let i = 0; i < 8; i += 1) {
      const dot = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0x5b3a29, 0.9).setDepth(32);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(10, 32);

      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        duration: 250,
        onComplete: () => dot.destroy()
      });
    }
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

  private compactDestroyedEntities(): void {
    this.humans.splice(0, this.humans.length, ...this.humans.filter((human) => human.active));
    this.cars.splice(0, this.cars.length, ...this.cars.filter((car) => car.active));
    this.poops.splice(0, this.poops.length, ...this.poops.filter((poop) => poop.active));
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

    return 'Drop: Hold SPACE, release to poop';
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.setDepth(1);

    g.fillStyle(0x90e0ef, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    g.fillStyle(0xd9ed92, 1);
    g.fillRect(0, this.perspective.horizonLineY, GAME_WIDTH, GAME_HEIGHT - this.perspective.horizonLineY);

    g.fillStyle(0x6d597a, 0.75);
    g.beginPath();
    g.moveTo(GAME_WIDTH * 0.46, this.perspective.horizonLineY);
    g.lineTo(GAME_WIDTH * 0.54, this.perspective.horizonLineY);
    g.lineTo(GAME_WIDTH * 0.9, GAME_HEIGHT);
    g.lineTo(GAME_WIDTH * 0.1, GAME_HEIGHT);
    g.closePath();
    g.fillPath();

    g.lineStyle(3, 0xffd166, 0.8);
    g.beginPath();
    g.moveTo(GAME_WIDTH / 2, this.perspective.horizonLineY + 6);
    g.lineTo(GAME_WIDTH / 2, GAME_HEIGHT);
    g.strokePath();
  }

  private hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Verdana',
      fontSize: '18px',
      color: '#102a43'
    };
  }
}
