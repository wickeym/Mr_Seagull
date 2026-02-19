import Phaser from 'phaser';
import { Car } from '../entities/Car';
import { Human } from '../entities/Human';
import { GAME_WIDTH } from '../utils/constants';
import { pickOne, randomInt } from '../utils/rng';

export class SpawnSystem {
  private readonly scene: Phaser.Scene;
  private readonly humans: Phaser.Physics.Arcade.Group;
  private readonly cars: Phaser.Physics.Arcade.Group;
  private humanTimer?: Phaser.Time.TimerEvent;
  private carTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    humans: Phaser.Physics.Arcade.Group,
    cars: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.humans = humans;
    this.cars = cars;
  }

  public start(): void {
    this.stop();

    this.humanTimer = this.scene.time.addEvent({
      delay: 950,
      loop: true,
      callback: () => this.spawnHuman()
    });

    this.carTimer = this.scene.time.addEvent({
      delay: 1700,
      loop: true,
      callback: () => this.spawnCar()
    });
  }

  public stop(): void {
    this.humanTimer?.destroy();
    this.carTimer?.destroy();
  }

  private spawnHuman(): void {
    const direction = pickOne<1 | -1>([1, -1]);
    const x = direction === 1 ? -24 : GAME_WIDTH + 24;
    const y = randomInt(290, 415);
    const speed = randomInt(65, 125);
    const highValue = Math.random() < 0.22;

    const human = new Human(this.scene, x, y, highValue);
    human.setMovement(speed, direction);
    this.humans.add(human);
  }

  private spawnCar(): void {
    const direction = pickOne<1 | -1>([1, -1]);
    const x = direction === 1 ? -48 : GAME_WIDTH + 48;
    const y = pickOne([455, 495]);
    const speed = randomInt(145, 215);

    const car = new Car(this.scene, x, y);
    car.setMovement(speed, direction);
    this.cars.add(car);
  }
}
