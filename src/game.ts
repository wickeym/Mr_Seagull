import { CFG, COLORS, FOV, H, HORIZON, PX, W } from './config';
import { ART, CLOSE_UP_DENSITY, createAtlas, type Atlas, type ReactionActor, type ReactionPose, type SpriteName } from './art';
import { drawText } from './font';
import {
  advanceThrottle, flightSpeed, forecastFlight, friesAltitude, friesDistance, hitsStone, hitsUmbrella,
  steerVelocity, STONE_GRAVITY, UMBRELLA_CEILING, UMBRELLA_RADIUS, type FlightCues
} from './flight';
import { Audio } from './audio';
import { Input, touchLayout } from './input';

type Scene = 'title' | 'help' | 'play' | 'over';
type Kind = ReactionActor | 'car';

interface FaceReaction {
  age: number;
  side: number;
  jumbo: boolean;
}

interface Target {
  kind: Kind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  lane: number;
  score: number;
  radius: number;
  hit: boolean;
  scare: number;
  scareT: number;
  rampage?: boolean;
  wrecked?: boolean;
  spin?: number;
  spinV?: number;
  swerve?: number;
  chain?: number;
  mul?: number;
  drift?: number;
  aimT?: number;
  shotT?: number;
  shots?: number;
  starter?: boolean;
  splatKick?: number;
  reaction?: FaceReaction;
  skidTrail?: { x: number; z: number };
}

interface Hazard {
  x: number;
  z: number;
  hit: boolean;
}

interface Stone {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  alive: boolean;
}

interface Pickup {
  x: number;
  y: number;
  baseY: number;
  z: number;
  taken: boolean;
}

interface PoopShot {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  z1: number;
  t: number;
  dur: number;
  alive: boolean;
  fat: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

interface Decal {
  x: number;
  z: number;
  life: number;
  size: number;
}

interface SplatFx {
  x: number;
  z: number;
  follow: Target | null;
  life: number;
  max: number;
  size: number;
}

interface SplashRing {
  x: number;
  z: number;
  life: number;
  size: number;
}

interface SkidMark {
  fromX: number;
  fromZ: number;
  x: number;
  z: number;
  life: number;
}

const CLOSE_UP_DURATION = 0.98;
const CLOSE_UP_COOLDOWN = 6.5;
const SKID_LIFE = 0.9;

const KINDS: Record<Kind, { score: number; radius: number; sprite: SpriteName }> = {
  sunbather: { score: 90, radius: 4.6, sprite: 'sunbather' },
  tourist: { score: 130, radius: 4.2, sprite: 'tourist' },
  jogger: { score: 190, radius: 4.2, sprite: 'jogger' },
  kid: { score: 240, radius: 3.8, sprite: 'kid' },
  slinger: { score: 280, radius: 3.8, sprite: 'slinger' },
  car: { score: 320, radius: 8.0, sprite: 'car' }
};

const LANE_OUT = 10;
const LANE_IN = -10;

const COMBO_WORD = ['HIT', 'NICE', 'GREAT', 'SAVAGE', 'LEGENDARY'];

function pack(r: number, g: number, b: number): number {
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

function hash(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function onCrosswalk(z: number): boolean {
  const span = CFG.crossEvery;
  const m = ((z % span) + span) % span;
  return m < CFG.crossDepth;
}

function snapToCrosswalk(z: number): number {
  const span = CFG.crossEvery;
  const base = Math.floor(z / span) * span;
  return base + CFG.crossDepth * 0.5;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function cameraHeight(altitude: number): number {
  return 24 + altitude * 0.52;
}

function comboWord(combo: number): string {
  if (combo >= 12) return COMBO_WORD[4]!;
  if (combo >= 8) return COMBO_WORD[3]!;
  if (combo >= 5) return COMBO_WORD[2]!;
  if (combo >= 3) return COMBO_WORD[1]!;
  return COMBO_WORD[0]!;
}

export class Game {
  readonly audio = new Audio();
  private readonly display: {
    ctx: CanvasRenderingContext2D;
    atlas: Atlas;
    ground: ImageData;
    ground32: Uint32Array;
  } | null;
  private titleImg: HTMLImageElement | null = null;
  scene: Scene = 'title';
  private time = 0;
  private lock = 0;
  private camX = 0;
  private camZ = 0;
  private px = 0;
  private pAlt = 28;
  private camH = cameraHeight(this.pAlt);
  private pvx = 0;
  private pvy = 0;
  private ammo = CFG.maxAmmo;
  private lives = CFG.lives;
  private invuln = 0;
  private speed = CFG.speedStart;
  private throttle = (CFG.speedStart - CFG.speedMin) / (CFG.speedMax - CFG.speedMin);
  private wind = 0;
  private windT = 0;
  private spawnT = 0.6;
  private fryT = 4;
  private setupT = 9;
  private umbT = 2.2;
  private slingT = 5.5;
  private score = 0;
  private combo = 0;
  private comboT = 0;
  private bestCombo = 0;
  private hits = 0;
  private distance = 0;
  private shake = 0;
  private hitStop = 0;
  private flash = 0;
  private flapT = 0;
  private lastFlap = 0;
  private targets: Target[] = [];
  private hazards: Hazard[] = [];
  private stones: Stone[] = [];
  private pickups: Pickup[] = [];
  private poops: PoopShot[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private decals: Decal[] = [];
  private splats: SplatFx[] = [];
  private splashRings: SplashRing[] = [];
  private skids: SkidMark[] = [];
  private closeUp: { target: Target; age: number } | null = null;
  private closeUpReadyAt = 0;
  private cooldown = 0;
  private charging = false;
  private charge = 0;
  private chargePing = false;
  private wantCharge = false;
  private ammoRegen = 0;
  private best = 0;
  private banner = '';
  private bannerT = 0;
  private hurtFlash = 0;
  private bonk: Hazard | null = null;
  private clouds = [
    { x: 80, y: 44, s: 2, v: 8 },
    { x: 360, y: 60, s: 2.6, v: 5 },
    { x: 640, y: 36, s: 1.6, v: 11 },
    { x: 840, y: 72, s: 2.2, v: 6 }
  ];

  constructor(
    ctx: CanvasRenderingContext2D | null,
    private readonly input: Input,
    private readonly storage: Storage | null = ctx ? localStorage : null
  ) {
    this.display = null;
    this.best = Number(this.storage?.getItem('mrseagull-best') || '0') || 0;
    if (!ctx) return;
    const ground = new ImageData(W, H);
    this.display = { ctx, atlas: createAtlas(), ground, ground32: new Uint32Array(ground.data.buffer) };
    const img = new Image();
    img.onload = () => {
      this.titleImg = img;
    };
    img.src = './title.png';
  }

  private get ctx(): CanvasRenderingContext2D {
    return this.display!.ctx;
  }

  get atlas(): Atlas {
    return this.display!.atlas;
  }

  get debug() {
    return {
      scene: this.scene,
      score: this.score,
      combo: this.combo,
      lives: this.lives,
      ammo: this.ammo,
      alt: this.pAlt,
      x: this.px,
      speed: this.speed
    };
  }

  get playtest() {
    const playerZ = this.playerZ();
    const sight = this.sight();
    const target = this.aimTarget(sight);
    const flight = this.flightCues();
    return {
      ...this.debug,
      distance: this.distance,
      bestCombo: this.bestCombo,
      hits: this.hits,
      wind: this.wind,
      charge: this.charge,
      cooldown: this.cooldown,
      closeUp: this.closeUp?.target.kind,
      flight: {
        umbrella: flight.umbrella?.danger ? 'collision' : flight.umbrella ? 'clear' : undefined,
        fries: flight.fries ? (flight.fries.aligned ? 'aligned' : 'off course') : undefined,
        stone: flight.stone ? 'collision' : undefined
      },
      aim: { x: sight.x, dz: sight.z - playerZ, fall: sight.fall, target: target?.kind },
      targets: this.targets.filter((t) => !t.hit || t.rampage).map((t) => ({
        kind: t.kind, x: t.x, dz: t.z - playerZ, vx: t.vx, vz: t.vz,
        aiming: (t.aimT ?? 0) > 0, rampage: !!t.rampage
      })),
      umbrellas: this.hazards.filter((h) => !h.hit).map((h) => ({
        x: h.x, dz: h.z - playerZ, y: CFG.umbH
      })),
      fries: this.pickups.map((p) => ({ x: p.x, dz: p.z - playerZ, y: p.y })),
      stones: this.stones.map((s) => ({ x: s.x, dz: s.z - playerZ, y: s.y })),
      drops: this.poops.map((p) => {
        const pos = this.poopPos(p);
        return { x: pos.x, dz: pos.z - playerZ, y: pos.y, fat: p.fat };
      })
    };
  }

  get playtestFeedback(): string[] {
    const labels = this.floaters.map((f) => f.text);
    if (this.bannerT > 0) labels.unshift(this.banner);
    return labels;
  }

  startRun(): void {
    this.scene = 'play';
    this.time = 0;
    this.lock = 0.12;
    this.camX = LANE_OUT;
    this.camZ = 0;
    this.px = LANE_OUT;
    this.pAlt = 28;
    this.camH = cameraHeight(this.pAlt);
    this.pvx = 0;
    this.pvy = 0;
    this.ammo = CFG.maxAmmo;
    this.lives = CFG.lives;
    this.invuln = 0;
    this.speed = CFG.speedStart;
    this.throttle = (CFG.speedStart - CFG.speedMin) / (CFG.speedMax - CFG.speedMin);
    this.wind = 0;
    this.windT = 4.5;
    this.spawnT = 2.4;
    this.fryT = 6.5;
    this.setupT = 9;
    this.umbT = 1.6;
    this.slingT = 4.8;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.hits = 0;
    this.distance = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.flash = 0;
    this.targets = [];
    this.hazards = [];
    this.stones = [];
    this.pickups = [];
    this.poops = [];
    this.particles = [];
    this.floaters = [];
    this.decals = [];
    this.splats = [];
    this.splashRings = [];
    this.skids = [];
    this.closeUp = null;
    this.closeUpReadyAt = 0;
    this.cooldown = 0;
    this.charging = false;
    this.charge = 0;
    this.chargePing = false;
    this.wantCharge = false;
    this.ammoRegen = 0;
    this.banner = 'GO!';
    this.bannerT = 1.1;
    this.hurtFlash = 0;
    this.bonk = null;
    const starter = this.addCar(CFG.playerRel + 10, false, 9);
    if (starter) starter.starter = true;
    this.addCar(CFG.playerRel + 49, true, -8);
    this.addBeachPair(38, CFG.playerRel + 72);
    this.addLowRoute(38, CFG.playerRel + 59);
    this.audio.start();
  }

  update(dt: number): void {
    if (this.closeUp) {
      this.closeUp.age += dt;
      if (this.closeUp.age >= CLOSE_UP_DURATION) this.closeUp = null;
      else dt *= lerp(1, 0.28, this.closeUpEase());
    }
    if (this.scene === 'play' && this.hitStop > 0) {
      this.hitStop -= dt;
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 0.35);
      this.updateFx(dt * 0.4);
      return;
    }

    this.input.beginFrame();
    if (this.input.mutePressed) this.audio.toggleMute();

    if (this.scene === 'title') {
      this.time += dt;
      if (this.input.startPressed || this.input.clickPressed) {
        if (this.display) void this.audio.unlock();
        this.audio.ui();
        this.startRun();
      } else if (this.input.helpPressed) {
        if (this.display) void this.audio.unlock();
        this.scene = 'help';
        this.audio.ui();
      }
      return;
    }

    if (this.scene === 'help') {
      if (this.input.startPressed || this.input.clickPressed || this.input.helpPressed || this.input.keys.has('escape')) {
        this.scene = 'title';
        this.audio.ui();
      }
      return;
    }

    if (this.scene === 'over') {
      this.time += dt;
      if ((this.input.startPressed || this.input.clickPressed) && this.time > 0.7) {
        this.audio.ui();
        this.scene = 'title';
        this.lock = 0.2;
      }
      return;
    }

    this.time += dt;
    this.lock = Math.max(0, this.lock - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.ammoRegen += dt;
    if (this.ammoRegen >= 3.4 && this.ammo < CFG.maxAmmo) {
      this.ammo += 1;
      this.ammoRegen = 0;
    }
    this.comboT = Math.max(0, this.comboT - dt);
    this.shake *= Math.pow(0.04, dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.comboT <= 0 && this.combo > 0) this.combo = 0;

    this.throttle = advanceThrottle(this.throttle, this.input.throttleDelta, dt);
    this.speed = flightSpeed(this.throttle);
    this.camZ += this.speed * dt;
    this.distance += this.speed * dt;

    this.windT -= dt;
    if (this.windT <= 0) {
      this.wind = (Math.random() * 2 - 1) * CFG.windMax * (0.35 + this.speed / CFG.speedMax);
      this.windT = 2.2 + Math.random() * 2.4;
    }

    const ax = this.input.xAxis;
    const ay = this.input.yAxis;
    this.pvx = steerVelocity(this.pvx, ax * CFG.maxStrafe, dt);
    this.pvy = steerVelocity(this.pvy, -ay * CFG.maxClimb, dt);
    this.px = clamp(this.px + this.pvx * dt, -CFG.xBound, CFG.xBound);
    this.pAlt = clamp(this.pAlt + this.pvy * dt, CFG.altMin, CFG.altMax);
    this.camX += (this.px - this.camX) * Math.min(1, 5.2 * dt);
    this.camH = cameraHeight(this.pAlt);

    this.flapT += dt * (6 + this.speed * 0.03);
    if (this.time - this.lastFlap > 0.36) {
      this.audio.flap();
      this.lastFlap = this.time;
    }

    this.updateCharge(dt);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnTarget();
      if (Math.random() < 0.35 + this.speed * 0.004) this.spawnTarget();
      const interval = lerp(CFG.spawnStart, CFG.spawnMin, this.speed / CFG.speedMax);
      this.spawnT = interval * (0.75 + Math.random() * 0.5);
    }
    this.fryT -= dt;
    if (this.fryT <= 0) {
      this.spawnFries();
      this.fryT = this.ammo <= 2 ? 1.6 : 3.2 + Math.random() * 1.6;
    }
    this.setupT -= dt;
    if (this.setupT <= 0) {
      this.spawnSetup();
      this.setupT = 5.5 + Math.random() * 2 - this.speed * 0.045;
    }
    this.umbT -= dt;
    if (this.umbT <= 0) {
      this.spawnUmbrella();
      this.umbT = 1.7 + Math.random() * 1.6 - this.speed * 0.008;
    }
    this.slingT -= dt;
    if (this.slingT <= 0) {
      this.spawnSlinger();
      this.slingT = 7.2 + Math.random() * 5.5 - this.speed * 0.04;
    }

    this.updateWorld(dt);
    this.updatePoops(dt);
    this.updateFx(dt);

    if (this.lives <= 0) this.finish();
  }

  private finish(): void {
    this.scene = 'over';
    this.closeUp = null;
    this.time = 0;
    if (this.score > this.best) {
      this.best = this.score;
      this.storage?.setItem('mrseagull-best', String(this.best));
    }
    this.audio.over();
  }

  private playerZ(): number {
    return this.camZ + CFG.playerRel;
  }

  private flightCues(): FlightCues {
    if (this.scene !== 'play') return {};
    return forecastFlight({
      x: this.px, y: this.pAlt, z: this.playerZ(), vx: this.pvx, vy: this.pvy, throttle: this.throttle
    }, {
      x: this.input.xAxis, y: this.input.yAxis, throttle: this.input.throttleDelta
    }, this.time, this.invuln, this.hazards, this.pickups, this.stones);
  }

  private sight(): { x: number; z: number; fall: number } {
    const fall = Math.max(0.4, Math.sqrt((2 * this.pAlt) / CFG.gravity));
    const lead = this.speed * fall * CFG.dropLead;
    const x = this.px + this.wind * fall * 0.5;
    const z = this.playerZ() + lead;
    return { x, z, fall };
  }

  private hitRadius(t: Target, jumbo: boolean): number {
    return (t.radius + (t.starter ? 4 : 0)) * (jumbo ? 1.8 : 1);
  }

  private aimTarget(sight: ReturnType<Game['sight']>): Target | undefined {
    if (this.cooldown > 0 || this.ammo <= 0 || this.lock > 0) return;
    const jumbo = this.charging && this.charge >= 1 && this.ammo >= 2;
    let nearest: Target | undefined;
    let best = Infinity;
    for (const t of this.targets) {
      if (t.hit) continue;
      const z = t.z + t.vz * sight.fall;
      let x = t.x + t.vx * sight.fall;
      if (t.kind !== 'car' && t.kind !== 'sunbather') x = this.personX(x, z, t.x);
      const distance = Math.hypot(x - sight.x, z - sight.z);
      if (distance > this.hitRadius(t, jumbo) * 0.88 || distance >= best) continue;
      nearest = t;
      best = distance;
    }
    return nearest;
  }

  private updateCharge(dt: number): void {
    if (this.input.dropPressed) this.wantCharge = true;
    if (!this.input.dropDown) this.wantCharge = false;
    if (this.lock > 0) {
      this.charging = false;
      this.charge = 0;
      this.chargePing = false;
      return;
    }
    if (!this.charging && this.wantCharge && this.cooldown <= 0 && this.ammo > 0) {
      this.charging = true;
      this.charge = 0;
      this.chargePing = false;
    }
    if (this.charging && this.input.dropDown && this.cooldown <= 0 && this.ammo > 0) {
      this.charge = clamp(this.charge + dt / CFG.chargeHold, 0, 1);
      if (this.charge >= 1 && this.ammo >= 2 && !this.chargePing) {
        this.chargePing = true;
        this.audio.chargeReady();
      }
    }
    if (this.charging && this.input.dropReleased) {
      const jumbo = this.charge >= 1 && this.ammo >= 2;
      this.tryDrop(jumbo);
      this.charging = false;
      this.charge = 0;
      this.chargePing = false;
      this.wantCharge = false;
      return;
    }
    if (!this.input.dropDown) {
      this.charging = false;
      this.charge = 0;
      this.chargePing = false;
    }
  }

  private tryDrop(fat = false): void {
    if (this.cooldown > 0) return;
    if (this.ammo <= 0) {
      this.floatAt(W / 2, 90, 'EMPTY', '#ffd36a');
      this.audio.ui();
      return;
    }
    if (fat && this.ammo < 2) fat = false;
    const s = this.sight();
    this.ammo -= fat ? 2 : 1;
    this.cooldown = fat ? CFG.poopCooldown * 1.15 : CFG.poopCooldown;
    this.poops.push({
      x0: this.px,
      y0: this.pAlt,
      z0: this.playerZ(),
      x1: s.x,
      z1: s.z,
      t: 0,
      dur: s.fall,
      alive: true,
      fat
    });
    this.audio.drop(fat);
    if (fat) {
      const gull = this.gullScreen();
      this.floatAt(gull.x, gull.y + 23 * PX, 'JUMBO!', '#f0c44c');
      this.burst(gull.x, gull.y + 15 * PX, '#f7f0c8', 8);
    }
  }

  private spawnTarget(): void {
    const roll = Math.random();
    let kind: Kind = 'tourist';
    if (roll < 0.2) kind = 'sunbather';
    else if (roll < 0.42) kind = 'tourist';
    else if (roll < 0.58) kind = 'jogger';
    else if (roll < 0.68) kind = 'kid';
    else if (roll < 0.78) kind = 'slinger';
    else kind = 'car';

    if (kind === 'slinger' && this.targets.some((t) => t.kind === 'slinger' && !t.hit && t.z > this.playerZ() - 6)) {
      kind = 'kid';
    }

    const ahead = this.camZ + 82 + Math.random() * 70;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const side = Math.random() < 0.5 ? -1 : 1;

    if (kind === 'car') {
      this.spawnCar(this.camZ + 110 + Math.random() * 85);
      return;
    }

    const sandX = side * (CFG.sandMin + 4 + Math.random() * (CFG.sandMax - CFG.sandMin - 8));
    const crossing = kind !== 'sunbather' && kind !== 'slinger' && Math.random() < 0.34;
    let z0 = crossing ? snapToCrosswalk(ahead) : ahead;
    for (let n = 0; n < 6 && this.occupied(sandX, z0, kind); n++) z0 += 10;
    if (this.occupied(sandX, z0, kind, 0.5)) return;
    this.addPerson(kind, sandX, z0, crossing, side, dir);
    if (kind !== 'slinger' && Math.random() < 0.4) {
      const buddies = Math.random() < 0.42 ? 2 : 1;
      for (let i = 0; i < buddies; i++) {
        const along = (i === 0 ? 1 : -1) * (6.5 + Math.random() * 5);
        const lo = side < 0 ? -CFG.sandMax : CFG.sandMin;
        const hi = side < 0 ? -CFG.sandMin : CFG.sandMax;
        const x = clamp(sandX + Math.sign(sandX || side) * along, lo, hi);
        const z = z0 + (Math.random() * 2 - 1) * 7;
        const buddy: Kind = kind === 'sunbather' ? 'sunbather' : Math.random() < 0.5 ? kind : 'tourist';
        if (!this.occupied(x, z, buddy, 0.35)) this.addPerson(buddy, x, z, crossing, side, dir);
      }
    }
  }

  private addPerson(
    kind: Kind, x: number, z: number, crossing: boolean, side: number, dir: number, walkingSpeed?: number
  ): void {
    const spec = KINDS[kind];
    const walk = walkingSpeed ?? (kind === 'jogger' ? 8 : kind === 'kid' ? 4.5 : kind === 'slinger' ? 1.8 : 3.2);
    this.targets.push({
      kind,
      x,
      z,
      vx: kind === 'sunbather' ? 0 : crossing ? -side * walk : dir * walk,
      vz: 0,
      lane: x,
      score: spec.score,
      radius: spec.radius,
      hit: false,
      scare: 0,
      scareT: 0,
      aimT: 0,
      shotT: kind === 'slinger' ? 0.35 : 0,
      shots: kind === 'slinger' ? 2 : 0
    });
  }

  private spawnCar(ahead: number): void {
    const firstOncoming = Math.random() < 0.5;
    const zFor = (oncoming: boolean, extra = 0) =>
      (oncoming ? this.camZ + 135 + Math.random() * 100 : ahead) + extra;
    this.addCar(zFor(firstOncoming), firstOncoming);
    if (Math.random() < 0.72) this.addCar(zFor(!firstOncoming, 16), !firstOncoming);
    if (Math.random() < 0.28) this.addCar(zFor(firstOncoming, 36), firstOncoming);
  }

  private addCar(z: number, oncoming: boolean, speed?: number): Target | undefined {
    const spec = KINDS.car;
    const lane = oncoming ? LANE_IN : LANE_OUT;
    if (this.occupied(lane, z, 'car', 2)) return;
    const car: Target = {
      kind: 'car',
      x: lane,
      z,
      vx: 0,
      vz: speed ?? (oncoming ? -(9 + Math.random() * 8) : 5 + Math.random() * 6),
      lane,
      score: spec.score,
      radius: spec.radius,
      hit: false,
      scare: 0,
      scareT: 0
    };
    this.targets.push(car);
    return car;
  }

  private addLowRoute(x: number, z: number): void {
    this.pickups.push({ x, z, y: 17, baseY: 17, taken: false });
    this.hazards.push({ x, z: z + 30, hit: false });
  }

  private addBeachPair(x: number, z: number): void {
    const side = Math.sign(x);
    const kidX = x - side * 4;
    const touristX = x + side * 4;
    if (!this.occupied(kidX, z, 'kid')) this.addPerson('kid', kidX, z, false, side, side, 1.3);
    if (!this.occupied(touristX, z + 10, 'tourist')) {
      this.addPerson('tourist', touristX, z + 10, false, side, side, 1.3);
    }
  }

  private spawnSetup(): void {
    const z = this.playerZ() + 48 + this.speed * 0.9;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * 38;
    const routeZ = z + 10;
    const clear = this.hazards.every((h) => h.hit || Math.abs(h.x - x) > 18 || Math.abs(h.z - routeZ) > 30);
    if (clear) this.addLowRoute(x, routeZ);
    if (Math.random() < 0.6) {
      const outbound = this.addCar(z, false, 5);
      const fall = this.sight().fall;
      const intercept = (z - this.playerZ() + this.speed * fall * (1 - CFG.dropLead)) / (this.speed - 5);
      if (outbound) this.addCar(z + (intercept + 0.25) * 13, true, -8);
    }
    this.addBeachPair(x, z + 5);
  }

  private spawnFries(): void {
    const y = 16 + Math.random() * 30;
    this.pickups.push({
      x: this.px + (Math.random() * 2 - 1) * 28,
      y,
      baseY: y,
      z: this.camZ + CFG.playerRel + 18 + Math.random() * 40,
      taken: false
    });
  }

  private spawnUmbrella(): void {
    this.hazards.push({
      x: (Math.random() < 0.5 ? -1 : 1) * (CFG.sandMin + 6 + Math.random() * 18),
      z: this.camZ + 92 + Math.random() * 48,
      hit: false
    });
  }

  private spawnSlinger(): void {
    if (this.targets.some((t) => t.kind === 'slinger' && !t.hit && t.z > this.playerZ() - 6)) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (CFG.sandMin + 5 + Math.random() * 16);
    const z = this.camZ + 84 + Math.random() * 50;
    if (this.occupied(x, z, 'slinger', 0.5)) return;
    this.addPerson('slinger', x, z, false, side, -side);
  }

  private updateWorld(dt: number): void {
    const near = this.camZ + 5;

    this.updatePeople(dt);
    this.updateSlingers(dt);
    this.updateStones(dt);
    this.updateCars(dt);
    this.updateRampages(dt);
    this.resolveOverlaps(true);
    this.resolveOverlaps(false);
    this.targets = this.targets.filter((t) => t.z > near);

    for (const p of this.pickups) {
      if (p.taken) continue;
      p.y = friesAltitude(p.baseY, p.z, this.time);
      let dx = p.x - this.px;
      const dy = p.y - this.pAlt;
      let dz = p.z - this.playerZ();
      const nearGrab = (dx * dx) / 36 + (dy * dy) / 12.25 + (dz * dz) / 49 < 1;
      if (nearGrab) {
        p.x += (this.px - p.x) * Math.min(1, 4 * dt);
        p.z += (this.playerZ() - p.z) * Math.min(1, 3.2 * dt);
        dx = p.x - this.px;
        dz = p.z - this.playerZ();
      }
      const caught = friesDistance(dx, dy, dz) < 1;
      if (caught) {
        p.taken = true;
        this.ammo = clamp(this.ammo + 2, 0, CFG.maxAmmo);
        this.score += 25;
        const pr = this.project(p.x, p.y, p.z);
        const fx = pr ? clamp(pr.x, 20 * PX, W - 20 * PX) : W / 2;
        const fy = pr ? clamp(pr.y, 40 * PX, H - 24 * PX) : H / 2;
        this.floatAt(fx, fy - 10 * PX, '+FRIES', '#ffd36a');
        this.audio.pickup();
        this.burst(fx, fy, '#ffd36a', 14);
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken && p.z > near);

    if (this.invuln <= 0) {
      for (const h of this.hazards) {
        if (h.hit) continue;
        const dx = h.x - this.px;
        const dz = h.z - this.playerZ();
        if (hitsUmbrella(dx, this.pAlt, dz)) {
          this.crash(h);
          break;
        }
      }
    }
    this.hazards = this.hazards.filter((h) => h.z > near);
    this.decals = this.decals.filter((d) => {
      d.life -= dt;
      return d.life > 0 && d.z > near;
    });
  }

  private bodyRad(t: Target): { rx: number; rz: number } {
    return t.kind === 'car' ? { rx: 8.6, rz: 12.5 } : { rx: 5.4, rz: 5.4 };
  }

  private hitsBody(a: Target, b: Target, extra = 0): boolean {
    const ra = this.bodyRad(a);
    const rb = this.bodyRad(b);
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const rx = ra.rx + rb.rx + extra;
    const rz = ra.rz + rb.rz + extra;
    return (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz) < 1;
  }

  private occupied(x: number, z: number, kind: Kind, pad = 2): boolean {
    const probe: Target = {
      kind,
      x,
      z,
      vx: 0,
      vz: 0,
      lane: x,
      score: 0,
      radius: 1,
      hit: false,
      scare: 0,
      scareT: 0
    };
    return this.targets.some((t) => {
      if (t.hit) return false;
      const same = kind === 'car' ? t.kind === 'car' : t.kind !== 'car';
      if (!same) return false;
      if (kind === 'car' && Math.abs(t.x - x) > 12) return false;
      return this.hitsBody(probe, t, pad);
    });
  }

  private personX(x: number, z: number, currentX: number): number {
    if (onCrosswalk(z)) return clamp(x, -CFG.sandMax, CFG.sandMax);
    const side = currentX >= 0 ? 1 : -1;
    const lo = side < 0 ? -CFG.sandMax : CFG.sandMin;
    const hi = side < 0 ? -CFG.sandMin : CFG.sandMax;
    return clamp(x, lo, hi);
  }

  private clampPerson(t: Target): void {
    if (t.kind !== 'sunbather') t.x = this.personX(t.x, t.z, t.x);
  }

  private updatePeople(dt: number): void {
    const people = this.targets.filter((t) => t.kind !== 'car' && !t.hit);
    for (const t of people) {
      if (t.kind === 'sunbather') continue;
      if (t.kind === 'slinger' && (t.aimT ?? 0) > 0) continue;
      const nx = t.x + t.vx * dt;
      const blocked = people.some((o) => {
        if (o === t) return false;
        const probe = { ...t, x: nx };
        return this.hitsBody(probe, o, 0.4);
      });
      if (blocked) {
        t.vx *= -1;
        t.x += t.vx * dt;
      } else {
        t.x = nx;
      }
      this.clampPerson(t);
    }
  }

  private carLane(t: Target): number {
    return t.vz < 0 ? LANE_IN : LANE_OUT;
  }

  private clampCar(t: Target): void {
    const lane = this.carLane(t);
    const lo = lane < 0 ? -CFG.roadLimit : 3;
    const hi = lane < 0 ? -3 : CFG.roadLimit;
    t.x = clamp(t.x, lo, hi);
  }

  private updateCars(dt: number): void {
    const cars = this.targets.filter((t) => t.kind === 'car' && !t.hit);
    for (const t of cars) {
      t.lane = this.carLane(t);
      const same = cars.filter((o) => o !== t && Math.sign(o.vz) === Math.sign(t.vz) && Math.abs(o.x - t.x) < 12);
      const gap = (o: Target) => (t.vz >= 0 ? o.z - t.z : t.z - o.z);
      const leader = same
        .filter((o) => gap(o) > 0 && gap(o) < 30)
        .sort((a, b) => gap(a) - gap(b))[0];
      if (leader) {
        if (t.vz >= 0) t.vz = Math.min(t.vz, leader.vz - 0.45);
        else t.vz = Math.max(t.vz, leader.vz + 0.45);
      }
      t.vx += (clamp((t.lane - t.x) * 7, -14, 14) - t.vx) * Math.min(1, 7 * dt);
      const nx = t.x + t.vx * dt;
      const nz = t.z + t.vz * dt;
      const ram = cars.find((o) => o !== t && this.hitsBody({ ...t, x: nx, z: nz }, o, 0.2));
      if (ram) {
        t.x += t.vx * dt * 0.25;
        if (Math.sign(t.vz) === Math.sign(ram.vz)) {
          if (t.vz >= 0) t.vz = Math.min(t.vz, ram.vz - 0.4);
          else t.vz = Math.max(t.vz, ram.vz + 0.4);
        }
      } else {
        t.x = nx;
        t.z = nz;
      }
      this.clampCar(t);
    }
  }

  private beginRampage(t: Target, mul: number, fromPoop: boolean): void {
    t.hit = true;
    t.rampage = true;
    t.wrecked = false;
    t.mul = mul;
    t.chain = t.chain ?? 0;
    t.scare = 2;
    t.scareT = 8;
    const along = t.lane < 0 ? -1 : 1;
    const kick = fromPoop ? 1 : 0.72;
    let dir = Math.sign(t.x) || (Math.random() < 0.5 ? -1 : 1);
    if (Math.random() < 0.32) dir *= -1;
    if (!fromPoop && t.vx) {
      if (Math.random() < 0.62) dir = Math.sign(t.vx);
    }
    const opposite = this.targets.some((o) =>
      o.kind === 'car' && !o.hit && o.lane !== t.lane && Math.abs(o.z - t.z) < 42
    );
    if (fromPoop && (t.starter || opposite)) dir = -Math.sign(t.lane);
    t.drift = dir * (0.7 + Math.random() * 0.7);
    t.spinV = Math.random() * Math.PI * 2;
    const incoming = along < 0;
    const panicGas = (8 + Math.random() * 6) * kick;
    t.vz = along * (Math.max(Math.abs(t.vz), this.speed * (incoming ? 0.55 : 1.08)) + panicGas);
    t.vx += dir * (9 + Math.random() * 10) * kick;
    t.spin = dir * -0.16;
    t.swerve = 0;
    t.skidTrail = { x: t.x, z: t.z };
    if (fromPoop) {
      this.audio.skid();
      this.audio.honk();
    }
  }

  private smashVictim(car: Target, victim: Target): void {
    if (victim === car || victim.hit || victim.wrecked) return;
    victim.hit = true;
    if (victim.kind === 'car') victim.splatKick = 0.36;
    victim.scare = 2;
    victim.scareT = 1.8;
    victim.vx += Math.sign(car.vx || 1) * (victim.kind === 'car' ? 10 : 7);
    victim.vz += car.vz * 0.15;
    car.chain = (car.chain ?? 0) + 1;
    this.combo += 1;
    this.comboT = 3.2;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.hits += 1;
    const mul = car.mul ?? 1;
    const chainMul = 1 + car.chain * 0.45;
    const gained = Math.round(victim.score * Math.max(1, this.combo) * mul * chainMul);
    this.score += gained;
    this.shake = Math.min(8, 2.2 + car.chain * 0.5) * PX;
    this.stampSplat(victim, victim.x, victim.z, 0.45);
    const fx = this.targetJuice(victim);
    this.floatAt(fx.x, fx.y - 16 * PX, `+${gained}`, '#fff6de');
    this.floatAt(fx.x, fx.y - 30 * PX, `CHAIN x${car.chain}`, '#f0c44c');
    this.banner = car.chain >= 3 ? 'RAMPAGE!' : car.chain >= 2 ? 'PILE-UP!' : 'SMASH!';
    this.bannerT = 0.85;
    this.audio.smash(car.chain);
    this.bloom(victim.x, victim.z, 1.4);
    this.burst(fx.x, fx.y, '#fff6de', 16);
    this.burst(fx.x, fx.y, '#d4453a', 10);
    const nx = victim.x - car.x;
    const nz = victim.z - car.z;
    const dist = Math.hypot(nx, nz) || 1;
    car.vx -= (nx / dist) * 2.4;
    car.vz -= (nz / dist) * 6;
    car.spin = clamp((car.spin ?? 0) + (nx / dist) * 0.12, -0.28, 0.28);
    if (victim.kind === 'car') this.beginRampage(victim, mul, false);
  }

  private smashUmbrella(car: Target, h: Hazard): void {
    h.hit = true;
    car.chain = (car.chain ?? 0) + 1;
    this.combo += 1;
    this.comboT = 3.2;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.hits += 1;
    const mul = car.mul ?? 1;
    const gained = Math.round(110 * Math.max(1, this.combo) * mul * (1 + car.chain * 0.35));
    this.score += gained;
    const top = this.project(h.x, CFG.umbH, h.z);
    const fx = top ?? this.juiceAt(h.x, h.z, CFG.umbH);
    this.floatAt(fx.x, fx.y - 16 * PX, `+${gained}`, '#fff6de');
    this.floatAt(fx.x, fx.y - 30 * PX, `CHAIN x${car.chain}`, '#f0c44c');
    this.banner = 'SMASH!';
    this.bannerT = 0.45;
    this.audio.smash(car.chain);
    this.bloom(h.x, h.z, 1.4);
    this.burst(fx.x, fx.y, '#d4453a', 14);
    this.burst(fx.x, fx.y, '#fff6de', 8);
  }

  private finishWreck(t: Target): void {
    t.rampage = false;
    t.wrecked = true;
    t.vx *= 0.22;
    t.vz *= 0.28;
    t.spinV = 0;
    t.spin = clamp((t.x >= 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 0.1, -0.34, 0.34);
    const chain = t.chain ?? 0;
    const bonus = Math.round((60 + chain * 85) * (t.mul ?? 1));
    this.score += bonus;
    this.comboT = Math.max(this.comboT, 2.2);
    const fx = this.targetJuice(t);
    this.floatAt(fx.x, fx.y - 16 * PX, `WRECK +${bonus}`, '#f0c44c');
    if (chain > 0) this.floatAt(fx.x, fx.y - 30 * PX, `${chain} HIT${chain > 1 ? 'S' : ''}`, '#fff6de');
    this.banner = chain >= 3 ? 'BEACH WRECK!' : 'WRECKED!';
    this.bannerT = 0.7;
    this.audio.crash();
    this.burst(fx.x, fx.y, '#5c6370', 18);
    this.burst(fx.x, fx.y, '#c48a4a', 12);
    this.shake = 4 * PX;
  }

  private carYaw(t: Target): number {
    const spin = t.spin ?? 0;
    if (t.wrecked) return spin;
    if (!t.rampage) return 0;
    return clamp(spin * 1.35 + t.vx * 0.013, -0.56, 0.56);
  }

  private updateRampages(dt: number): void {
    for (const t of this.targets) {
      if (t.kind !== 'car' || !t.rampage || t.wrecked) continue;
      t.swerve = (t.swerve ?? 0) + dt;
      const ax = Math.abs(t.x);
      const onSand = ax > CFG.road + 1;
      const across = Math.sign(t.drift || (t.lane >= 0 ? -1 : 1));
      const pull = Math.abs(t.drift || 1);
      const panic = Math.exp(-t.swerve * 0.4);
      const incoming = t.vz < 0;
      const weave = Math.sin(t.swerve * (7.6 + pull * 2.2) + (t.spinV ?? 0)) * (onSand ? 3 : 7.5) * panic;
      const drift = across * (onSand ? 2.5 : (incoming ? 24 : 18) * pull) * (0.6 + panic * 0.5);
      const wantVx = drift + weave;
      t.vx += (wantVx - t.vx) * Math.min(1, (onSand ? 3.4 : 5.5) * dt);
      const along = Math.sign(t.vz) || (t.lane < 0 ? -1 : 1);
      const rush = incoming ? Math.max(Math.abs(t.vz) * 0.82, this.speed * 0.5 + 10) : this.speed + 8 + panic * 5;
      const cruise = along * rush;
      t.vz += (cruise * (onSand ? 0.32 : 1) - t.vz) * Math.min(1, 2.4 * dt);
      if (onSand) {
        t.vx *= Math.exp(-2.6 * dt);
        t.vz *= Math.exp(-2.2 * dt);
      }
      t.x += t.vx * dt;
      t.z += t.vz * dt;
      t.spin = clamp(weave * 0.03 - across * 0.08 * (0.4 + panic), -0.26, 0.26);
      if (Math.abs(t.x) > CFG.sandMax + 3) {
        t.x = Math.sign(t.x) * (CFG.sandMax + 3);
        t.vx *= -0.18;
      }
      t.x = clamp(t.x, -CFG.xBound - 4, CFG.xBound + 4);
      const trail = t.skidTrail;
      if (trail && Math.hypot(t.x - trail.x, t.z - trail.z) >= 2) {
        this.skids.push({ fromX: trail.x, fromZ: trail.z, x: t.x, z: t.z, life: SKID_LIFE });
        t.skidTrail = { x: t.x, z: t.z };
      }
      if (Math.abs(t.vx) > 5 && Math.random() < dt * 20) {
        const fx = this.juiceAt(t.x, t.z, 0);
        this.burst(fx.x, fx.y, onSand ? '#c48a4a' : '#8d9291', 2);
      }
      for (const o of this.targets) {
        if (o === t || o.hit) continue;
        if (this.hitsBody(t, o, 0.55)) this.smashVictim(t, o);
      }
      for (const hzd of this.hazards) {
        if (hzd.hit) continue;
        const dx = hzd.x - t.x;
        const dz = hzd.z - t.z;
        if (dx * dx + dz * dz < (CFG.umbR + 9) * (CFG.umbR + 9)) this.smashUmbrella(t, hzd);
      }
      if (onSand && t.swerve > 0.55) this.finishWreck(t);
      else if (t.z < this.camZ + 26) this.finishWreck(t);
    }
    for (const t of this.targets) {
      if (t.kind !== 'car' || !t.wrecked) continue;
      t.x += t.vx * dt;
      t.z += t.vz * dt;
      t.vx *= Math.exp(-2.2 * dt);
      t.vz *= Math.exp(-1.8 * dt);
      t.x = clamp(t.x, -CFG.xBound - 4, CFG.xBound + 4);
    }
  }

  private resolveOverlaps(cars: boolean): void {
    const group = this.targets.filter((t) => !t.hit && (cars ? t.kind === 'car' : t.kind !== 'car'));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (!this.hitsBody(a, b, 1.15)) continue;
        const ra = this.bodyRad(a);
        const rb = this.bodyRad(b);
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const nx = dx / dist;
        const rx = ra.rx + rb.rx + 1.15;
        const rz = ra.rz + rb.rz + 1.15;
        const d2 = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
        const scale = 1 / Math.sqrt(Math.max(d2, 0.0001));
        const mx = dx * (scale - 1) * 0.52;
        const mz = dz * (scale - 1) * 0.52;
        a.x += mx;
        a.z += mz;
        b.x -= mx;
        b.z -= mz;
        if (cars) {
          this.clampCar(a);
          this.clampCar(b);
          const opposite = Math.sign(a.vz) !== Math.sign(b.vz);
          if (!opposite) {
            const rear = a.vz >= 0 ? (a.z <= b.z ? a : b) : a.z >= b.z ? a : b;
            const front = rear === a ? b : a;
            if (rear.vz >= 0) rear.vz = Math.min(rear.vz, front.vz - 0.3);
            else rear.vz = Math.max(rear.vz, front.vz + 0.3);
          }
        } else {
          this.clampPerson(a);
          this.clampPerson(b);
          if (Math.abs(dx) >= Math.abs(dz)) {
            a.vx = Math.abs(a.vx) * Math.sign(nx) || nx * 3;
            b.vx = Math.abs(b.vx) * -Math.sign(nx) || -nx * 3;
          }
        }
      }
    }
  }

  private crash(h: Hazard): void {
    h.hit = true;
    this.bonk = h;
    const top = this.project(h.x, CFG.umbH, h.z);
    const fx = top ?? { x: W / 2, y: 150 * PX };
    this.takeHit('UMBRELLA!', fx, 'BONK!');
    this.pvy = 26;
  }

  private takeHit(banner: string, fx: { x: number; y: number }, float: string): void {
    this.closeUp = null;
    this.lives -= 1;
    this.combo = 0;
    this.invuln = 1.45;
    this.shake = 9 * PX;
    this.hitStop = 0.28;
    this.flash = 0.28;
    this.hurtFlash = 0.7;
    this.banner = banner;
    this.bannerT = 1.15;
    this.floatAt(fx.x, fx.y - 22 * PX, float, '#fff6de');
    if (banner === 'SLINGSHOT!') this.audio.pebbleHit();
    else this.audio.crash();
    this.burst(fx.x, fx.y, '#d4453a', 28);
    this.burst(fx.x, fx.y, '#fff6de', 14);
    this.burst(fx.x, fx.y, '#f0c44c', 10);
  }

  private updateSlingers(dt: number): void {
    for (const t of this.targets) {
      if (t.kind !== 'slinger' || t.hit) continue;
      t.shotT = Math.max(0, (t.shotT ?? 0) - dt);
      if (t.scare >= 2) {
        t.aimT = 0;
        continue;
      }
      const dz = t.z - this.playerZ();
      const dx = t.x - this.px;
      const inRange = dz > 14 && dz < 72 && Math.abs(dx) < 40 && (t.shots ?? 0) > 0 && (t.shotT ?? 0) <= 0;
      if (inRange && (t.aimT ?? 0) <= 0) {
        t.aimT = 0.001;
        t.vx = 0;
        const fx = this.targetJuice(t);
        this.floatAt(fx.x, fx.y - 24 * PX, '!', '#d4453a');
      }
      if ((t.aimT ?? 0) > 0) {
        t.aimT = (t.aimT ?? 0) + dt;
        if ((t.aimT ?? 0) >= 0.5) this.fireSling(t);
      }
    }
  }

  private fireSling(t: Target): void {
    t.aimT = 0;
    t.shotT = 1.55;
    t.shots = Math.max(0, (t.shots ?? 1) - 1);
    const flight = 0.58;
    const tx = this.px + this.pvx * 0.07 + (Math.random() - 0.5) * 7;
    const ty = this.pAlt + (Math.random() - 0.5) * 5;
    const tz = this.playerZ() + this.speed * flight * 0.28;
    const sx = t.x;
    const sy = 5.2;
    const sz = t.z;
    const dx = tx - sx;
    const dy = ty - sy;
    const dz = tz - sz;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const spd = 48 + Math.random() * 8;
    this.stones.push({
      x: sx,
      y: sy,
      z: sz,
      vx: (dx / dist) * spd,
      vy: (dy / dist) * spd + 6,
      vz: (dz / dist) * spd,
      life: 1.35,
      alive: true
    });
    this.audio.sling();
    const fx = this.targetJuice(t);
    this.burst(fx.x, fx.y - 8 * PX, '#8d9291', 4);
  }

  private updateStones(dt: number): void {
    const near = this.camZ + 4;
    for (const s of this.stones) {
      if (!s.alive) continue;
      s.life -= dt;
      s.vy -= STONE_GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.life <= 0 || s.y < 0 || s.z < near) {
        if (s.y < 0.4 && s.z > near) {
          const puff = this.juiceAt(s.x, s.z, 0);
          this.burst(puff.x, puff.y, '#c48a4a', 3);
        }
        s.alive = false;
        continue;
      }
      if (this.invuln > 0) continue;
      const dx = s.x - this.px;
      const dy = s.y - this.pAlt;
      const dz = s.z - this.playerZ();
      if (hitsStone(dx, dy, dz)) {
        s.alive = false;
        const pr = this.project(s.x, s.y, s.z);
        const fx = pr ?? this.gullScreen();
        this.takeHit('SLINGSHOT!', fx, 'OW!');
        this.pvy = 18;
      }
    }
    this.stones = this.stones.filter((s) => s.alive);
  }

  private updatePoops(dt: number): void {
    for (const t of this.targets) {
      if (t.hit) continue;
      t.scareT = Math.max(0, t.scareT - dt);
      if (t.scareT <= 0) t.scare = 0;
    }
    for (const p of this.poops) {
      if (!p.alive) continue;
      p.t += dt;
      const pos = this.poopPos(p);
      const u = clamp(p.t / p.dur, 0, 1);
      if (Math.random() < dt * 14) {
        const pr = this.project(pos.x, pos.y, pos.z);
        if (pr) this.burst(pr.x, pr.y, '#f7f0c8', 1);
      }
      if (pos.y > 8) this.warnTargets(p, pos, u);
      if (p.alive && p.t >= p.dur) this.impact(p);
    }
    this.poops = this.poops.filter((p) => p.alive);
  }

  private warnTargets(p: PoopShot, pos: { x: number; y: number; z: number }, u: number): void {
    for (const t of this.targets) {
      if (t.hit) continue;
      const land = Math.hypot(t.x - p.x1, t.z - p.z1);
      const now = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (Math.min(land, now) > t.radius + 8 + (p.fat ? 7 : 0)) continue;
      const level = u > 0.32 && pos.y < 32 ? 2 : 1;
      if (level > t.scare) {
        if (level === 2 && t.kind !== 'car') {
          this.audio.gasp();
          const fx = this.targetJuice(t);
          const word = t.kind === 'kid' || t.kind === 'slinger' ? 'HEY!' : t.kind === 'jogger' ? 'NO!' : 'AHH!';
          this.floatAt(fx.x, fx.y - 22 * PX, word, '#fff6de');
          this.burst(fx.x, fx.y - 10 * PX, '#fff6de', 5);
        }
        t.scare = level;
      }
      t.scareT = 0.7;
    }
  }

  private spriteFor(t: Target): SpriteName {
    if (t.kind === 'car') {
      const front = t.lane < 0;
      if (t.hit) return front ? 'carFrontPanic' : 'carPanic';
      const scared = t.scare >= 1;
      if (front) return scared ? 'carFrontLook' : 'carFront';
      return scared ? 'carLook' : 'car';
    }
    if (t.kind === 'slinger') {
      if (t.scare >= 2 || t.hit) return 'slingerHorror';
      if ((t.aimT ?? 0) > 0) return 'slingerAim';
      if (t.scare >= 1) return 'slingerLook';
      return 'slinger';
    }
    if (t.scare >= 2) {
      if (t.kind === 'sunbather') return 'sunbatherHorror';
      if (t.kind === 'tourist') return 'touristHorror';
      if (t.kind === 'jogger') return 'joggerHorror';
      return 'kidHorror';
    }
    if (t.scare >= 1) {
      if (t.kind === 'sunbather') return 'sunbatherLook';
      if (t.kind === 'tourist') return 'touristLook';
      if (t.kind === 'jogger') return 'joggerLook';
      return 'kidLook';
    }
    return KINDS[t.kind].sprite;
  }

  private targetSprite(t: Target): HTMLCanvasElement {
    const reaction = t.reaction;
    if (t.kind !== 'car' && reaction) {
      return this.atlas.reactions[t.kind][this.reactionPose(reaction)];
    }
    return this.atlas[this.spriteFor(t)];
  }

  private reactionPose({ age }: FaceReaction): ReactionPose {
    return age < 0.08 ? 'flinch' : age > 0.44 && age < 0.8 ? 'wipe' : 'disgust';
  }

  private closeUpEase(): number {
    if (!this.closeUp) return 0;
    const progress = clamp(Math.min(this.closeUp.age / 0.16, (CLOSE_UP_DURATION - this.closeUp.age) / 0.22), 0, 1);
    return progress * progress * (3 - 2 * progress);
  }

  private poopPos(p: PoopShot): { x: number; y: number; z: number } {
    const u = clamp(p.t / p.dur, 0, 1);
    const x = lerp(p.x0, p.x1, u);
    const z = lerp(p.z0, p.z1, u);
    const y = p.y0 * (1 - u * u);
    return { x, y, z };
  }

  private difficultyMul(p?: PoopShot): number {
    const spdT = (this.speed - CFG.speedMin) / (CFG.speedMax - CFG.speedMin);
    let fallT = clamp((this.pAlt - CFG.altMin) / (CFG.altMax - CFG.altMin), 0, 1);
    if (p) {
      const dropZ = Math.abs(p.z1 - p.z0);
      fallT = clamp(dropZ / 58 + p.y0 / 90, 0, 1);
    }
    return 1 + spdT * 1.35 + fallT * 1.2 + spdT * fallT * 0.45;
  }

  private awardHit(best: Target, p: PoopShot, graze: boolean): number {
    const comboMul = graze ? 0.5 : Math.max(1, this.combo);
    const mul = this.difficultyMul(p);
    const jumboMul = p.fat ? 1.7 : 1;
    return Math.round(best.score * comboMul * mul * jumboMul);
  }

  private impact(p: PoopShot): void {
    p.alive = false;
    const x = p.x1;
    const z = p.z1;
    const splash = p.fat ? 7.4 : 0;
    const size = p.fat ? 2.3 : 1.3;

    const struck: { t: Target; d: number; direct: boolean }[] = [];
    for (const t of this.targets) {
      if (t.hit) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      const radius = this.hitRadius(t, p.fat);
      const direct = d <= radius;
      const graze = d <= radius * 1.08 + splash;
      if (direct || graze) struck.push({ t, d, direct });
    }
    struck.sort((a, b) => a.d - b.d);

    if (!struck.length) {
      this.stampSplat(null, x, z, p.fat ? 0.42 : 0.29, size * 0.7);
      const miss = this.juiceAt(x, z, 0);
      this.floatAt(miss.x, miss.y - 12 * PX, p.fat ? 'FAT MISS' : 'MISS', '#c9c6bf');
      this.audio.miss(p.fat);
      this.combo = 0;
      this.shake = 1.1 * PX;
      this.burst(miss.x, miss.y, '#c9c6bf', p.fat ? 14 : 8);
      return;
    }

    const mul = this.difficultyMul(p);
    let directHits = 0;
    let carHit = false;
    let faceHit: Target | null = null;
    this.bloom(x, z, size);
    for (let i = 0; i < struck.length; i++) {
      const hit = struck[i]!;
      const t = hit.t;
      t.hit = true;
      if (t.kind === 'car') {
        t.splatKick = p.fat ? 0.42 : 0.28;
      } else if (hit.direct) {
        const side = Math.sign(x - t.x) || (t.x < 0 ? -1 : 1);
        t.reaction = { age: 0, side, jumbo: p.fat };
        faceHit ??= t;
      }
      t.scare = 2;
      t.scareT = 1.4;
      this.combo += 1;
      this.comboT = Math.max(this.comboT, hit.direct ? 2.4 : 1.6);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.hits += 1;
      const gained = this.awardHit(t, p, !hit.direct);
      this.score += gained;
      this.stampSplat(t, t.x, t.z, t.reaction ? 0 : p.fat ? 0.75 : 0.46, size);
      const fx = this.targetJuice(t);
      const lift = i * 10 * PX;
      const label = hit.direct ? `+${gained}` : `GRAZE +${gained}`;
      this.floatAt(fx.x, fx.y - 16 * PX - lift, label, hit.direct ? '#fff6de' : '#f0c44c');
      if (i === 0) this.floatAt(fx.x, fx.y - 28 * PX, p.fat ? 'JUMBO' : `x${mul.toFixed(1)}`, '#f0c44c');
      this.burst(fx.x, fx.y, '#fff6de', p.fat ? 30 : 16);
      this.burst(fx.x, fx.y, '#f1d174', p.fat ? 14 : 5);
      if (p.fat) this.burst(fx.x, fx.y, '#c9b586', 10);
      if (t.kind === 'car' && hit.direct) {
        carHit = true;
        this.comboT = 3.6;
        this.beginRampage(t, mul * (p.fat ? 1.15 : 1), true);
      }
      if (hit.direct) directHits += 1;
    }

    this.shake = Math.min(8, 2 + this.combo * 0.25 + (p.fat ? 3.1 : 0)) * PX;
    this.hitStop = Math.max(this.hitStop, directHits && p.fat ? 0.09 : 0.035);
    this.flash = p.fat ? 0.23 : 0.13;
    if (p.fat && faceHit && this.hurtFlash <= 0 && this.time >= this.closeUpReadyAt &&
      !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.closeUp = { target: faceHit, age: 0 };
      this.closeUpReadyAt = this.time + CLOSE_UP_COOLDOWN;
      this.hitStop = 0;
    }
    if (p.fat && struck.length > 1) this.banner = `JUMBO SPLASH x${struck.length}!`;
    else if (carHit) this.banner = p.fat ? 'JUMBO CAR SPLAT!' : 'CAR SPLAT!';
    else if (p.fat && directHits) this.banner = 'JUMBO SPLAT!';
    else this.banner = directHits ? comboWord(this.combo) : 'GRAZE!';
    this.bannerT = p.fat ? 0.95 : 0.65;
    if (directHits) this.audio.hit(this.combo, p.fat, struck.length);
    else this.audio.nearMiss(p.fat);
  }

  private bloom(x: number, z: number, size: number): void {
    this.splashRings.push({ x, z, life: 0.36, size });
  }

  private stampSplat(target: Target | null, x: number, z: number, life: number, size = 1): void {
    this.decals.push({ x, z, life: 3.2, size });
    if (life > 0) this.splats.push({ x, z, follow: target, life, max: life, size });
  }

  private updateFx(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * PX * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.splats) s.life -= dt;
    this.splats = this.splats.filter((s) => s.life > 0);
    for (const ring of this.splashRings) ring.life -= dt;
    this.splashRings = this.splashRings.filter((ring) => ring.life > 0);
    for (const skid of this.skids) skid.life -= dt;
    this.skids = this.skids.filter((skid) => skid.life > 0);
    for (const t of this.targets) {
      if (t.splatKick) t.splatKick = Math.max(0, t.splatKick - dt);
      if (t.reaction) t.reaction.age += dt;
    }
    for (const f of this.floaters) {
      f.y -= 22 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const c of this.clouds) {
      c.x -= c.v * dt * (0.4 + this.speed * 0.01);
      if (c.x < -60 * PX) c.x = W + 40 * PX + Math.random() * 80 * PX;
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (30 + Math.random() * 90) * PX;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20 * PX,
        life: 0.25 + Math.random() * 0.35,
        max: 0.5,
        color,
        size: PX + ((Math.random() * 2 * PX) | 0)
      });
    }
  }

  private juiceAt(wx: number, wz: number, wy = 0): { x: number; y: number } {
    const pr = this.project(wx, wy, wz);
    if (!pr) return { x: W / 2, y: H - 24 * PX };
    return { x: pr.x, y: pr.y };
  }

  private kindScale(s: number, t: Target, spr = this.targetSprite(t)): number {
    const worldW = t.kind === 'car' ? 16 : 8.4;
    return Math.max(0.07, (worldW * s) / spr.width);
  }

  private targetJuice(t: Target): { x: number; y: number } {
    const pr = this.project(t.x, 0, t.z);
    if (!pr) return this.juiceAt(t.x, t.z, 0);
    if (!this.display) return pr;
    const spr = this.targetSprite(t);
    const height = t.reaction ? spr.height - 28 : spr.height * 0.55;
    return { x: pr.x, y: pr.y - height * this.kindScale(pr.s, t, spr) };
  }

  private gullScreen(): { x: number; y: number } {
    const pr = this.project(this.px, this.pAlt, this.playerZ());
    if (pr) return { x: pr.x, y: pr.y };
    const altN = (this.pAlt - CFG.altMin) / (CFG.altMax - CFG.altMin);
    return { x: W / 2 + (this.px - this.camX) * 1.8, y: 150 * PX - altN * 50 * PX };
  }

  private floatAt(x: number, y: number, text: string, color: string): void {
    this.floaters.push({ x, y, text, color, life: 0.9 });
  }

  private project(wx: number, wy: number, wz: number): { x: number; y: number; s: number; rel: number } | null {
    const rel = wz - this.camZ;
    if (rel < 2.2 || rel > CFG.drawFar) return null;
    const s = FOV / rel;
    const x = W / 2 + (wx - this.camX) * s;
    const row = (this.camH * FOV) / rel;
    const y = HORIZON + row - wy * s;
    return { x, y, s, rel };
  }

  draw(): void {
    if (!this.display) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shake > 0.2 && !this.closeUp) {
      ctx.translate(((Math.random() - 0.5) * this.shake) | 0, ((Math.random() - 0.5) * this.shake) | 0);
    }

    if (this.scene === 'title') this.drawTitle();
    else if (this.scene === 'help') this.drawHelp();
    else {
      this.drawWorld();
      if (this.scene === 'over') this.drawOver();
    }

    ctx.restore();
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(160,18,22,${this.hurtFlash * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,246,222,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    if (this.titleImg) {
      ctx.drawImage(this.titleImg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(6,14,22,0.38)';
      ctx.fillRect(0, 0, W, H);
    } else {
      this.drawSky();
      this.drawGround();
    }
    ctx.fillStyle = 'rgba(6,14,22,0.42)';
    ctx.fillRect(0, 0, W, 58 * PX);
    ctx.fillRect(0, 188 * PX, W, 82 * PX);
    drawText(ctx, 'MR. SEAGULL', W / 2, 14 * PX, '#1d1c22', 2 * PX, 'center');
    drawText(ctx, 'MR. SEAGULL', W / 2, 12 * PX, '#fff6de', 2 * PX, 'center');
    drawText(ctx, 'POOP WITH PRECISION', W / 2, 36 * PX, '#f0c44c', PX, 'center');
    drawText(ctx, this.input.usingTouch ? 'TAP TO FLY' : 'PRESS SPACE TO FLY', W / 2, 204 * PX, (this.time * 2) % 2 < 1.2 ? '#fff6de' : '#f0c44c', PX, 'center');
    drawText(ctx, this.input.usingTouch ? 'HOLD DROP FOR A JUMBO' : 'H HELP   M MUTE', W / 2, 222 * PX, '#c9c6bf', PX, 'center');
    drawText(ctx, `BEST ${this.best}`, W / 2, 246 * PX, '#fff6de', PX, 'center');
  }

  private drawHelp(): void {
    const ctx = this.ctx;
    this.drawSky();
    ctx.fillStyle = 'rgba(12,22,32,0.82)';
    ctx.fillRect(28 * PX, 16 * PX, 424 * PX, 238 * PX);
    drawText(ctx, 'HOW TO FLY', W / 2, 28 * PX, '#f0c44c', 2 * PX, 'center');
    const lines = [
      'FLY INTO THE SCREEN LIKE AN OLD RACER',
      'WASD ARROWS OR THE LEFT STICK MOVE AND CHANGE HEIGHT',
      'Q E OR FAST SLOW BUTTONS CHANGE SPEED',
      'SPACE OR DROP TAP  HOLD FOR A JUMBO - 2 AMMO',
      'POOP FALLS FROM YOU ONTO THE RING',
      'RELEASE WHEN THE RING LIGHTS UP',
      'EAT FRIES TO RELOAD  AVOID UMBRELLAS',
      'KIDS WITH SLINGSHOTS WILL TAKE A SHOT',
      'SPEED AND LONG DROPS PAY A DIFFICULTY BONUS',
      'COMBOS STACK ON TOP OF THAT',
      'TAP OR H TO RETURN'
    ];
    lines.forEach((line, i) => drawText(ctx, line, W / 2, 56 * PX + i * 16 * PX, '#fff6de', PX, 'center'));
  }

  private drawOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'BEACH CLOSED', W / 2, 78 * PX, '#fff6de', 2 * PX, 'center');
    drawText(ctx, `SCORE ${this.score}`, W / 2, 114 * PX, '#f0c44c', 2 * PX, 'center');
    drawText(ctx, `HITS ${this.hits}  COMBO ${this.bestCombo}  BEST ${this.best}`, W / 2, 148 * PX, '#fff6de', PX, 'center');
    drawText(ctx, this.input.usingTouch ? 'TAP FOR MENU' : 'SPACE TO MENU', W / 2, 184 * PX, '#c9c6bf', PX, 'center');
  }

  private drawWorld(): void {
    this.drawSky();
    this.drawGround();
    this.drawHorizonBits();
    this.drawSkids();

    type DrawItem = { rel: number; fn: () => void };
    const items: DrawItem[] = [];

    for (const d of this.decals) {
      const pr = this.project(d.x, 0, d.z);
      if (!pr) continue;
      items.push({
        rel: pr.rel,
        fn: () => {
          this.ctx.globalAlpha = clamp(d.life / 3.2, 0, 0.8);
          this.blit(this.atlas.splat, pr.x, pr.y, (Math.max(1.3 * PX, pr.s * 0.4) * (d.size ?? 1)) / ART);
          this.ctx.globalAlpha = 1;
        }
      });
    }
    for (const h of this.hazards) {
      const gnd = this.project(h.x, 0, h.z);
      if (!gnd) continue;
      items.push({
        rel: gnd.rel,
        fn: () => this.drawUmbrella(h, gnd)
      });
    }
    for (const t of this.targets) {
      const pr = this.project(t.x, 0, t.z);
      if (!pr) continue;
      const spr = this.targetSprite(t);
      items.push({
        rel: pr.rel,
        fn: () => {
          const scale = this.kindScale(pr.s, t, spr);
          this.blit(this.atlas.shadow, pr.x, pr.y + PX, Math.max(0.7 * PX, pr.s * 0.18) / ART);
          const recoil = t.splatKick ?? 0;
          if (t.reaction) {
            const hop = Math.sin(t.reaction.age * 21) * Math.exp(-t.reaction.age * 8) * 11 * PX;
            this.drawReaction(spr, t.reaction, pr.x, pr.y - hop, scale);
          } else {
            const skidBounce = t.rampage ? Math.abs(Math.sin((t.swerve ?? 0) * 18)) * pr.s * 0.58 : 0;
            const yaw = this.carYaw(t) + Math.sin(recoil * 25) * recoil * 0.35;
            const impactScale = scale * (1 + recoil * 0.22);
            this.blit(spr, pr.x, pr.y - skidBounce, impactScale, 0.5, 1, yaw);
            if (t.hit && t.kind === 'car') this.drawCarSplat(pr.x, pr.y - skidBounce, impactScale, yaw);
          }
          if (t.scare >= 1 && !t.hit) {
            drawText(
              this.ctx,
              t.scare >= 2 ? '!!' : '?',
              pr.x + spr.width * scale * 0.42,
              pr.y - spr.height * scale * 0.72,
              t.scare >= 2 ? '#d4453a' : '#f0c44c',
              PX,
              'center'
            );
          }
          if (t.hit && t.kind !== 'car' && !t.reaction) {
            this.blit(
              this.atlas.splat,
              pr.x,
              pr.y - spr.height * scale * 0.55,
              Math.max(1.35 * PX, pr.s * 0.42) / ART,
              0.5,
              0.55
            );
          }
          if (t.kind === 'slinger' && (t.aimT ?? 0) > 0 && !t.hit) {
            drawText(this.ctx, '!', pr.x, pr.y - spr.height * scale * 0.78, '#d4453a', PX, 'center');
          }
        }
      });
    }
    for (const p of this.pickups) {
      if (p.taken) continue;
      const pr = this.project(p.x, p.y, p.z);
      const ground = this.project(p.x, 0, p.z);
      if (!pr) continue;
      items.push({
        rel: pr.rel,
        fn: () => {
          if (ground && p.z > this.playerZ()) {
            this.blit(this.atlas.shadow, ground.x, ground.y, Math.max(PX, ground.s * 0.14) / ART);
          }
          this.blit(this.atlas.fries, pr.x, pr.y, Math.max(1.6 * PX, pr.s * 0.55) / ART, 0.5, 0.5);
        }
      });
    }
    for (const p of this.poops) {
      const pos = this.poopPos(p);
      const pr = this.project(pos.x, pos.y, pos.z);
      const sh = this.project(pos.x, 0, pos.z);
      if (sh) {
        items.push({
          rel: sh.rel,
          fn: () => {
            this.ctx.globalAlpha = 0.45;
            this.blit(this.atlas.shadow, sh.x, sh.y, (Math.max(0.4 * PX, sh.s * 0.08) * (p.fat ? 1.8 : 1)) / ART);
            this.ctx.globalAlpha = 1;
          }
        });
      }
      if (pr) {
        items.push({
          rel: pr.rel - 0.2,
          fn: () => {
            const fat = p.fat ? 2.15 : 1;
            this.blit(this.atlas.poop, pr.x, pr.y, (Math.max(1.4 * PX, pr.s * 0.32) * fat) / ART);
          }
        });
      }
    }

    for (const s of this.stones) {
      if (!s.alive) continue;
      const pr = this.project(s.x, s.y, s.z);
      const sh = this.project(s.x, 0, s.z);
      if (sh) {
        items.push({
          rel: sh.rel,
          fn: () => {
            this.ctx.globalAlpha = 0.35;
            this.blit(this.atlas.shadow, sh.x, sh.y, Math.max(0.35 * PX, sh.s * 0.06) / ART);
            this.ctx.globalAlpha = 1;
          }
        });
      }
      if (pr) {
        items.push({
          rel: pr.rel,
          fn: () => this.blit(this.atlas.pebble, pr.x, pr.y, Math.max(2.4 * PX, pr.s * 0.8) / ART, 0.5, 0.5)
        });
      }
    }

    const sight = this.sight();
    const sp = this.project(sight.x, 0, sight.z);

    const railStart = Math.floor(this.camZ / 12) * 12 + 12;
    for (let z = railStart; z < this.camZ + CFG.railFar; z += 12) {
      for (const x of [-CFG.road, CFG.road]) {
        const pr = this.project(x, 0, z);
        if (!pr) continue;
        items.push({
          rel: pr.rel,
          fn: () => {
            const h = Math.max(4, pr.s * 5.2);
            const w = Math.max(1, pr.s * 0.85);
            this.ctx.fillStyle = '#5a2e14';
            this.ctx.fillRect((pr.x - w / 2) | 0, (pr.y - h) | 0, w | 0 || 1, h | 0);
            this.ctx.fillStyle = '#d7b07a';
            this.ctx.fillRect((pr.x - w / 2) | 0, (pr.y - h) | 0, w | 0 || 1, Math.max(1, (h * 0.2) | 0));
          }
        });
      }
    }

    items.push({
      rel: CFG.playerRel,
      fn: () => this.drawPlayer()
    });
    items.sort((a, b) => b.rel - a.rel);
    for (const it of items) it.fn();
    if (sp && this.scene === 'play') this.drawSight(sp.x, sp.y, sp.s, !!this.aimTarget(sight));
    this.drawSplats();
    if (this.closeUp) this.drawCloseUp(this.closeUp.target);
    this.drawHud();
    if (this.input.usingTouch && this.scene === 'play') this.drawTouch();
  }

  private drawSkids(): void {
    const ctx = this.ctx;
    for (const mark of this.skids) {
      for (const offset of [-5, 5]) {
        const a = this.project(mark.fromX + offset, 0, mark.fromZ);
        const b = this.project(mark.x + offset, 0, mark.z);
        if (!a || !b) continue;
        ctx.strokeStyle = Math.abs(mark.x) > CFG.road ? '#9b633d' : '#242029';
        ctx.globalAlpha = 0.62 * mark.life / SKID_LIFE;
        ctx.lineWidth = Math.max(1, b.s * 0.42);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCarSplat(x: number, y: number, scale: number, yaw: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(yaw);
    this.blit(this.atlas.splat, 9 * scale, -51 * scale, scale * 0.42, 0.5, 0.55);
    ctx.fillStyle = '#e6dba7';
    ctx.fillRect(-6 * scale, -47 * scale, 3 * scale, 10 * scale);
    ctx.fillRect(8 * scale, -43 * scale, 2 * scale, 7 * scale);
    ctx.restore();
  }

  private drawReaction(
    sprite: HTMLCanvasElement, reaction: FaceReaction, x: number, feetY: number, scale: number, density = 1
  ): void {
    const ctx = this.ctx;
    const { age, side, jumbo } = reaction;
    const recoil = Math.sin(age * 25) * Math.exp(-age * 8);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(feetY));
    ctx.rotate(side * recoil * 0.18);
    ctx.scale(scale * (1 + recoil * 0.1), scale * (1 - recoil * 0.13));
    const width = sprite.width / density;
    const height = sprite.height / density;
    ctx.translate(-width / 2, -height);
    ctx.drawImage(sprite, 0, 0, width, height);

    const cheek = width / 2 + side * 7;
    const smear = age > 0.52 ? 0.68 : 1;
    if (density > 1) {
      this.drawCloseUpSplat(cheek, side, age, smear);
    } else {
      this.blit(this.atlas.splat, cheek, 31, (jumbo ? 0.25 : 0.20) * smear, 0.5, 0.55);
      ctx.fillStyle = '#eadf9e';
      ctx.fillRect(Math.round(cheek + side), 31, 2, Math.min(9, 2 + Math.floor(age * 14)));
      ctx.fillRect(Math.round(cheek - side * 3), 43, 3, 4);
    }
    if (age < 0.38) {
      for (let i = 0; i < (jumbo ? 19 : 10); i++) {
        const angle = i * 2.4;
        const speed = (i % 6 + 3) * (jumbo ? 17 : 13);
        const dx = side * age * 22 + Math.cos(angle) * speed * age;
        const dy = Math.sin(angle) * speed * age + age * age * 115;
        const size = Math.max(1, Math.round((2 + i % 3) * (1 - age * 1.8)));
        ctx.fillStyle = i % 3 === 0 ? '#c5af71' : i % 3 === 1 ? '#fff9d9' : '#eadd9d';
        if (density > 1) {
          ctx.beginPath();
          ctx.ellipse(cheek + dx, 28 + dy, size * 0.55, size * 0.32, angle, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(Math.round(cheek + dx), Math.round(28 + dy), size, size);
        }
      }
    }
    ctx.restore();
  }

  private drawCloseUpSplat(x: number, side: number, age: number, size: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, 31);
    ctx.scale(side * size, size);
    const drip = Math.min(9, 2 + age * 13);
    ctx.fillStyle = '#c5af71';
    ctx.beginPath();
    ctx.ellipse(0, 1, 5.7, 3.7, -0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1.7, drip * 0.5, 1.2, drip * 0.5, -0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7e6ad';
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.bezierCurveTo(-7, -3, -3.5, -3.4, -2, -2);
    ctx.bezierCurveTo(-0.4, -4.3, 1.5, -2.7, 2, -2.2);
    ctx.bezierCurveTo(6.8, -4.2, 7.2, -0.2, 4.5, 0.7);
    ctx.bezierCurveTo(3.5, 2.3, 3.1, 2.1, 3, drip - 0.5);
    ctx.bezierCurveTo(1, drip + 1, 0.8, 4.2, 0.4, 3.5);
    ctx.bezierCurveTo(-2.6, 4.5, -2.6, 1.6, -5, 0);
    ctx.fill();
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.ellipse(-2.5, -1.3, 1.7, 0.6, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4.2, -1.2, 0.7, 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCloseUp(target: Target): void {
    const reaction = target.reaction;
    const pr = this.project(target.x, 0, target.z);
    const ease = this.closeUpEase();
    if (!reaction || !pr || ease <= 0.02 || target.kind === 'car') return;

    const ctx = this.ctx;
    const sprite = this.atlas.closeUpReaction(target.kind, this.reactionPose(reaction));
    const startX = clamp(pr.x, W * 0.18, W * 0.82);
    const centerX = lerp(startX, W / 2, ease);
    const width = lerp(56 * PX, 208 * PX, ease);
    const height = lerp(48 * PX, 153 * PX, ease);
    const x = Math.round(centerX - width / 2);
    const faceHeight = sprite.height / CLOSE_UP_DENSITY - 28;
    const faceY = pr.y - faceHeight * this.kindScale(pr.s, target);
    const y = Math.round(lerp(clamp(faceY - 24 * PX, H * 0.25, H * 0.64), 59 * PX, ease));
    const scale = lerp(1, 4.7 * PX, ease);

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.fillStyle = 'rgba(17,29,42,0.36)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#26374a';
    ctx.fillRect(x - 3 * PX, y - 3 * PX, width + 6 * PX, height + 6 * PX);
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = '#ffe0a1';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#ffefc4';
    ctx.lineWidth = 2 * PX;
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI / 7;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * width * 0.2, y + height * 0.43 + Math.sin(angle) * height * 0.25);
      ctx.lineTo(centerX + Math.cos(angle) * width, y + height * 0.43 + Math.sin(angle) * height);
      ctx.stroke();
    }
    this.drawReaction(sprite, reaction, centerX, y + height * 0.49 + faceHeight * scale, scale, CLOSE_UP_DENSITY);
    ctx.restore();
  }

  private drawSky(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 18 * PX);
    g.addColorStop(0, `rgb(${COLORS.skyTop.join(',')})`);
    g.addColorStop(0.55, `rgb(${COLORS.skyMid.join(',')})`);
    g.addColorStop(1, `rgb(${COLORS.skyLow.join(',')})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgb(${COLORS.sun.join(',')})`;
    ctx.beginPath();
    ctx.arc(368 * PX, 28 * PX, 16 * PX, 0, Math.PI * 2);
    ctx.fill();
    for (const c of this.clouds) this.blit(this.atlas.cloud, c.x, c.y, c.s / ART, 0.5, 0.5);
  }

  private drawHorizonBits(): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgb(${COLORS.ocean.join(',')})`;
    ctx.fillRect(0, HORIZON - 6 * PX, W, 8 * PX);
    ctx.fillStyle = `rgb(${COLORS.foam.join(',')})`;
    ctx.fillRect(0, HORIZON + 1 * PX, W, PX);
    this.blit(this.atlas.pier, 86 * PX, HORIZON - 2 * PX, (1.2 * PX) / ART);
    this.blit(this.atlas.pier, 300 * PX, HORIZON - PX, (0.9 * PX) / ART);
  }

  private drawGround(): void {
    const { ctx, ground, ground32 } = this.display!;
    const fogFar = pack(196, 226, 168);
    const horizonColor = pack(28, 92, 128);
    for (let sy = HORIZON; sy < H; sy++) {
      const row = sy - HORIZON + 1;
      const rel = (this.camH * FOV) / row;
      const wz = this.camZ + rel;
      const half = (rel * (W * 0.5)) / FOV;
      const dx = (half * 2) / W;
      let wx = this.camX - half;
      const fog = clamp(1 - row / (58 * PX), 0, 1);
      const off = sy * W;
      for (let sx = 0; sx < W; sx++) {
        ground32[off + sx] = this.sampleGround(wx, wz, fog, fogFar, horizonColor);
        wx += dx;
      }
    }
    ctx.putImageData(ground, 0, 0, 0, HORIZON, W, H - HORIZON);
  }

  private sampleGround(wx: number, wz: number, fog: number, fogFar: number, horizon: number): number {
    const ix = wx | 0;
    const iz = wz | 0;
    const ax = wx < 0 ? -wx : wx;
    const n = hash(ix, iz);
    let r: number;
    let g: number;
    let b: number;
    if (ax > 78) {
      const wave = ((iz + (ix >> 2)) & 7) < 2;
      r = wave ? 54 : 36;
      g = wave ? 140 : 108;
      b = wave ? 168 : 142;
    } else if (ax > 68) {
      r = 186 + n * 16;
      g = 154 + n * 10;
      b = 104;
    } else if (ax < CFG.road) {
      const plank = (iz / 6) & 1;
      r = plank ? 156 : 132;
      g = plank ? 104 : 86;
      b = plank ? 62 : 50;
      if (Math.abs(wx % 4) < 0.28 || Math.abs(wz % 6) < 0.22) {
        r = 96;
        g = 62;
        b = 36;
      }
      if (ax < 1.05 && (Math.floor(wz / 9) & 1) === 0) {
        r = 236;
        g = 214;
        b = 150;
      }
      if (onCrosswalk(wz)) {
        const stripe = ((ix + 40) / 3 | 0) & 1;
        if (stripe) {
          r = 238;
          g = 234;
          b = 220;
        } else {
          r = 58;
          g = 54;
          b = 50;
        }
      }
    } else {
      r = 226 + n * 18;
      g = 196 + n * 12;
      b = 132 + n * 8;
      if (((ix * 13 + iz * 7) & 31) === 0) {
        r = 196;
        g = 158;
        b = 96;
      }
    }
    const fr = fogFar & 255;
    const fg = (fogFar >> 8) & 255;
    const fb = (fogFar >> 16) & 255;
    r = lerp(r, fr, fog * 0.85);
    g = lerp(g, fg, fog * 0.85);
    b = lerp(b, fb, fog * 0.85);
    if (fog > 0.75) {
      const t = (fog - 0.75) / 0.25;
      r = lerp(r, horizon & 255, t);
      g = lerp(g, (horizon >> 8) & 255, t);
      b = lerp(b, (horizon >> 16) & 255, t);
    }
    return pack(r | 0, g | 0, b | 0);
  }

  private drawUmbrella(
    h: Hazard,
    gnd: { x: number; y: number; s: number }
  ): void {
    const ctx = this.ctx;
    const R = UMBRELLA_RADIUS;
    const rimH = UMBRELLA_CEILING - 5;
    const peakH = UMBRELLA_CEILING;
    const n = 16;
    const rim: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const pr = this.project(h.x + Math.cos(a) * R, rimH, h.z + Math.sin(a) * R);
      if (!pr) return;
      rim.push({ x: pr.x, y: pr.y });
    }
    const peak = this.project(h.x, peakH, h.z);
    const neck = this.project(h.x, rimH + 0.4, h.z);
    if (!peak || !neck) return;

    const knocked = h.hit && this.hitStop <= 0;

    ctx.save();
    if (knocked) {
      ctx.translate(gnd.x, gnd.y);
      ctx.rotate(h.x >= 0 ? 1.12 : -1.12);
      ctx.translate(-gnd.x, -gnd.y);
    }

    ctx.fillStyle = 'rgba(29,28,34,0.28)';
    ctx.beginPath();
    ctx.ellipse(gnd.x, gnd.y, Math.max(4 * PX, gnd.s * R * 0.42), Math.max(2 * PX, gnd.s * R * 0.16), 0, 0, Math.PI * 2);
    ctx.fill();

    const poleW = Math.max(2 * PX, neck.s * 0.38);
    ctx.strokeStyle = '#3b2a22';
    ctx.lineWidth = poleW + PX;
    ctx.beginPath();
    ctx.moveTo(gnd.x | 0, gnd.y | 0);
    ctx.lineTo(neck.x | 0, neck.y | 0);
    ctx.stroke();
    ctx.strokeStyle = '#7a4c2e';
    ctx.lineWidth = poleW;
    ctx.beginPath();
    ctx.moveTo(gnd.x | 0, gnd.y | 0);
    ctx.lineTo(neck.x | 0, neck.y | 0);
    ctx.stroke();
    ctx.strokeStyle = '#f2d38a';
    ctx.lineWidth = Math.max(PX, poleW * 0.35);
    ctx.beginPath();
    ctx.moveTo((gnd.x - PX) | 0, gnd.y | 0);
    ctx.lineTo((neck.x - PX) | 0, neck.y | 0);
    ctx.stroke();
    ctx.fillStyle = '#3b2a22';
    ctx.fillRect((gnd.x - poleW) | 0, (gnd.y - 2 * PX) | 0, (poleW * 2) | 0 || 2 * PX, 3 * PX);

    // Hidden panels reverse winding where the canopy peak covers the far rim.
    const visible = rim.map((a, i) => {
      const b = rim[(i + 1) % n]!;
      return (a.x - peak.x) * (b.y - peak.y) - (a.y - peak.y) * (b.x - peak.x) < 0;
    });
    for (let i = 0; i < n; i++) {
      if (!visible[i]) continue;
      const a = rim[i]!;
      const b = rim[(i + 1) % n]!;
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      const stripe = ((i * 8) / n | 0) & 1;
      ctx.fillStyle = stripe ? '#d4453a' : '#f6f3ec';
      ctx.fill();
    }

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (!visible[i]) continue;
      const a = rim[i]!;
      const b = rim[(i + 1) % n]!;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (!visible[(i + n - 1) % n]) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(peak.x, peak.y);
      }
      if (!visible[(i + 1) % n]) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(peak.x, peak.y);
      }
    }
    ctx.strokeStyle = '#1d1c22';
    ctx.lineWidth = PX;
    ctx.stroke();

    const highlight = n * 0.65 | 0;
    if (visible[highlight] && visible[(highlight + n - 1) % n]) {
      ctx.strokeStyle = 'rgba(255,246,222,0.45)';
      ctx.beginPath();
      ctx.moveTo(rim[highlight]!.x, rim[highlight]!.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.stroke();
    }

    ctx.fillStyle = '#f0c44c';
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, Math.max(1.4 * PX, peak.s * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d1c22';
    ctx.lineWidth = PX;
    ctx.stroke();
    ctx.restore();

    if (knocked) {
      drawText(ctx, 'BONK', peak.x, peak.y - 16 * PX, '#d4453a', PX, 'center');
      if (h === this.bonk && this.hurtFlash > 0.15) {
        ctx.save();
        ctx.globalAlpha = clamp(this.hurtFlash, 0, 1);
        ctx.strokeStyle = '#fff6de';
        ctx.lineWidth = 2 * PX;
        const burst = 16 * PX + (1 - this.hurtFlash) * 18 * PX;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.moveTo(peak.x + Math.cos(a) * 6 * PX, peak.y + Math.sin(a) * 4 * PX);
          ctx.lineTo(peak.x + Math.cos(a) * burst, peak.y + Math.sin(a) * burst * 0.55);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawSight(x: number, y: number, s: number, ready: boolean): void {
    const ctx = this.ctx;
    const charged = this.charging && this.charge >= 1 && this.ammo >= 2;
    const grow = this.charging ? 1 + this.charge * 0.55 : 1;
    const rad = Math.max(8 * PX, s * 1.8) * grow;
    const pulse = 1 + Math.sin(this.time * (charged ? 16 : 10)) * (charged ? 0.16 : 0.1);
    const color = ready ? '#ddff89' : charged ? '#ff9fcc' : '#fff6de';
    const width = rad * pulse * (ready ? 1.13 : 1);
    if (ready || this.charging) {
      const { x: sx, y: sy } = this.gullScreen();
      ctx.strokeStyle = ready ? 'rgba(221,255,137,0.8)' : 'rgba(255,246,222,0.45)';
      ctx.lineWidth = PX;
      ctx.setLineDash([3 * PX, 3 * PX]);
      ctx.beginPath();
      ctx.moveTo(sx, sy + 15 * PX);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = ready ? 'rgba(206,253,104,0.36)' : charged ? 'rgba(244,166,193,0.26)' : 'rgba(20,24,30,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, width, width * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,24,30,0.82)';
    ctx.lineWidth = (ready ? 4 : 3) * PX;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = (ready || charged ? 2 : 1) * PX;
    ctx.stroke();
    if (this.charging && !charged && this.ammo >= 2) {
      ctx.strokeStyle = '#ff9fcc';
      ctx.lineWidth = 2 * PX;
      ctx.beginPath();
      ctx.ellipse(x, y, width + 4 * PX, width * 0.42 + 3 * PX, 0,
        -Math.PI / 2, (this.charge * 2 - 0.5) * Math.PI);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - rad - 3 * PX, y);
    ctx.lineTo(x - 3 * PX, y);
    ctx.moveTo(x + 3 * PX, y);
    ctx.lineTo(x + rad + 3 * PX, y);
    ctx.moveTo(x, y - 3 * PX);
    ctx.lineTo(x, y + 3 * PX);
    ctx.stroke();
  }

  private drawSplats(): void {
    const ctx = this.ctx;
    for (const ring of this.splashRings) {
      const pr = this.project(ring.x, 0, ring.z);
      if (!pr) continue;
      const remaining = ring.life / 0.36;
      const size = (2 + 5 * (1 - remaining)) * pr.s * ring.size;
      ctx.globalAlpha = remaining * 0.8;
      ctx.strokeStyle = '#fff2bb';
      ctx.lineWidth = (1 + 2 * remaining) * PX;
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, size, size * Math.min(0.9, this.camH / pr.rel), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const s of this.splats) {
      const x = s.follow?.x ?? s.x;
      const z = s.follow?.z ?? s.z;
      const pr = this.project(x, 0, z);
      if (!pr) continue;
      const u = 1 - s.life / s.max;
      let y = pr.y;
      if (s.follow) {
        const spr = this.atlas[this.spriteFor(s.follow)];
        y = pr.y - spr.height * this.kindScale(pr.s, s.follow) * 0.55;
      }
      const spread = 0.65 + Math.min(1, u * 5) * 0.65 + 0.4 * u;
      const scale = (Math.max(1.4 * PX, pr.s * 0.52) * spread * s.size) / ART;
      this.ctx.globalAlpha = clamp(1 - u * u, 0, 0.95);
      this.blit(this.atlas.splat, pr.x, y, scale, 0.5, 0.55);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(): void {
    const { x: sx, y: sy } = this.gullScreen();
    const sh = this.project(this.px, 0, this.playerZ());
    if (sh) {
      this.ctx.globalAlpha = 0.35;
      this.blit(this.atlas.shadow, sh.x, sh.y, Math.max(1.1 * PX, sh.s * 0.12) / ART);
      this.ctx.globalAlpha = 1;
    }
    const blink = this.invuln > 0 && this.hitStop <= 0 && ((this.time * 12) | 0) % 2 === 0;
    if (blink) return;
    const frame = (this.flapT | 0) % 3;
    let name: SpriteName = frame === 0 ? 'gull0' : frame === 1 ? 'gull1' : 'gull2';
    if (this.pvx < -10) name = frame === 0 ? 'gullL0' : frame === 1 ? 'gullL1' : 'gullL2';
    if (this.pvx > 10) name = frame === 0 ? 'gullR0' : frame === 1 ? 'gullR1' : 'gullR2';
    this.blit(this.atlas[name], sx, sy, (1.72 * PX) / ART, 0.5, 54 / 92);
    if (this.charging && this.charge > 0.04) {
      const ready = this.charge >= 1 && this.ammo >= 2;
      const sc = ((1.05 + this.charge * 1.7) * PX) / ART;
      this.ctx.globalAlpha = 0.88 + (ready ? Math.sin(this.time * 18) * 0.12 : 0);
      this.blit(this.atlas.poop, sx, sy + 15 * PX, sc, 0.5, 0.15);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawHud(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(12,18,24,0.42)';
    ctx.fillRect(0, 0, W, 22 * PX);
    drawText(ctx, `${this.score}`, 8 * PX, 6 * PX, '#fff6de', PX);
    drawText(ctx, this.combo > 1 ? `x${this.combo}` : 'x1', 92 * PX, 6 * PX, this.combo > 3 ? '#f0c44c' : '#fff6de', PX);
    drawText(ctx, `x${this.difficultyMul().toFixed(1)}`, 140 * PX, 6 * PX, '#ffd36a', PX);
    const mag = Math.abs(this.wind) | 0;
    const wind = mag < 2 ? 'WIND --' : this.wind > 0 ? `WIND >${mag}` : `WIND <${mag}`;
    drawText(ctx, wind, W / 2 - 40 * PX, 6 * PX, '#fff6de', PX, 'center');
    drawText(ctx, `SPD ${this.speed | 0}`, W / 2 + 70 * PX, 6 * PX, this.throttle > 0.72 ? '#d4453a' : '#f0c44c', PX, 'center');
    drawText(ctx, `${(this.distance | 0)}M`, W - 8 * PX, 6 * PX, '#fff6de', PX, 'right');

    for (let i = 0; i < CFG.lives; i++) {
      this.ctx.globalAlpha = i < this.lives ? 1 : 0.25;
      this.blit(this.atlas.heart, 10 * PX + i * 14 * PX, 34 * PX, PX / ART, 0, 0);
    }
    this.ctx.globalAlpha = 1;
    for (let i = 0; i < CFG.maxAmmo; i++) {
      this.ctx.globalAlpha = i < this.ammo ? 1 : 0.22;
      this.blit(this.atlas.ammo, W - 12 * PX - i * 12 * PX, 34 * PX, PX / ART, 0.5, 0);
    }
    this.ctx.globalAlpha = 1;

    if (this.bannerT > 0 && this.scene === 'play') {
      const hurt = this.banner === 'UMBRELLA!' || this.banner === 'SLINGSHOT!';
      const color = hurt ? '#ff7771' : this.banner.startsWith('JUMBO') ? '#ffd0e4' : '#ffe08b';
      drawText(ctx, this.banner, W / 2, 49 * PX, '#202737', 2 * PX, 'center');
      drawText(ctx, this.banner, W / 2, 48 * PX, color, 2 * PX, 'center');
    }
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life * 1.6, 0, 1);
      drawText(ctx, f.text, f.x, f.y, f.color, PX, 'center');
      ctx.globalAlpha = 1;
    }
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
    }
  }

  private drawTouch(): void {
    const ctx = this.ctx;
    const ui = touchLayout(W, H);
    const stickX = this.input.stickOriginX;
    const stickY = this.input.stickOriginY;
    ctx.lineWidth = PX;
    ctx.strokeStyle = this.input.stickActive ? 'rgba(255,246,222,0.55)' : 'rgba(255,246,222,0.32)';
    ctx.beginPath();
    ctx.arc(stickX, stickY, ui.stick.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,222,0.08)';
    ctx.beginPath();
    ctx.arc(stickX, stickY, ui.stick.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,222,0.45)';
    ctx.beginPath();
    ctx.arc(this.input.stickKnobX, this.input.stickKnobY, 9 * PX, 0, Math.PI * 2);
    ctx.fill();

    const charged = this.charging && this.charge >= 1 && this.ammo >= 2;
    ctx.fillStyle = this.input.dropDown
      ? charged
        ? 'rgba(244,166,193,0.55)'
        : 'rgba(240,196,76,0.5)'
      : 'rgba(255,246,222,0.16)';
    ctx.beginPath();
    ctx.arc(ui.drop.x, ui.drop.y, ui.drop.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = charged ? '#f4a6c1' : 'rgba(255,246,222,0.4)';
    ctx.stroke();
    drawText(ctx, 'DROP', ui.drop.x, ui.drop.y - 6, '#fff6de', PX, 'center');

    ctx.fillStyle = this.input.fastHeld ? 'rgba(240,196,76,0.45)' : 'rgba(255,246,222,0.1)';
    ctx.beginPath();
    ctx.arc(ui.fast.x, ui.fast.y, ui.fast.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,222,0.35)';
    ctx.stroke();
    drawText(ctx, 'FAST', ui.fast.x, ui.fast.y - 4, '#f0c44c', PX, 'center');

    ctx.fillStyle = this.input.slowHeld ? 'rgba(201,198,191,0.4)' : 'rgba(255,246,222,0.1)';
    ctx.beginPath();
    ctx.arc(ui.slow.x, ui.slow.y, ui.slow.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawText(ctx, 'SLOW', ui.slow.x, ui.slow.y - 4, '#c9c6bf', PX, 'center');
  }

  private blit(
    sprite: HTMLCanvasElement,
    x: number,
    y: number,
    scale: number,
    ax = 0.5,
    ay = 1,
    rot = 0
  ): void {
    const w = sprite.width * scale;
    const h = sprite.height * scale;
    if (!rot) {
      this.ctx.drawImage(sprite, Math.round(x - w * ax), Math.round(y - h * ay), Math.round(w) || 1, Math.round(h) || 1);
      return;
    }
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rot);
    this.ctx.drawImage(sprite, Math.round(-w * ax), Math.round(-h * ay), Math.round(w) || 1, Math.round(h) || 1);
    this.ctx.restore();
  }
}
