import Phaser from 'phaser';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { randomInt } from '../utils/rng';

interface SpawnCallbacks {
  onHumanSpawn: (human: Human) => void;
  onCarSpawn: (car: Car) => void;
}

export class SpawnSystem {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: SpawnCallbacks;
  private humanTimer?: Phaser.Time.TimerEvent;
  private carTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, callbacks: SpawnCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  public start(): void {
    this.stop();

    this.humanTimer = this.scene.time.addEvent({
      delay: 850,
      loop: true,
      callback: () => this.spawnHuman()
    });

    this.carTimer = this.scene.time.addEvent({
      delay: 1600,
      loop: true,
      callback: () => this.spawnCar()
    });
  }

  public stop(): void {
    this.humanTimer?.destroy();
    this.carTimer?.destroy();
  }

  private spawnHuman(): void {
    const highValue = Math.random() < 0.2;
    const human = new Human(this.scene, highValue);
    human.setWorldState(
      randomInt(-100, 100) / 100,
      randomInt(-65, 55) / 100,
      randomInt(86, 103) / 10,
      randomInt(14, 20) / 10
    );

    this.callbacks.onHumanSpawn(human);
  }

  private spawnCar(): void {
    const car = new Car(this.scene);
    car.setWorldState(
      randomInt(-95, 95) / 100,
      randomInt(20, 100) / 100,
      randomInt(88, 105) / 10,
      randomInt(20, 29) / 10
    );

    this.callbacks.onCarSpawn(car);
  }
}
