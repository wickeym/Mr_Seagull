import { CFG } from './config';

export interface FlightPoint {
  x: number;
  y: number;
  z: number;
}

interface PathPoint extends FlightPoint {
  t: number;
}

interface FlightState extends FlightPoint {
  vx: number;
  vy: number;
  throttle: number;
}

interface FlightControls {
  x: number;
  y: number;
  throttle: number;
}

interface PickupPoint extends FlightPoint {
  baseY: number;
}

export interface StonePath extends FlightPoint {
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export const STONE_GRAVITY = 18;
const STEP = 1 / 60;
const LOOK_AHEAD = 1.65;
export const UMBRELLA_CEILING = CFG.umbH + 8;
const UMBRELLA_RADIUS_SQ = CFG.umbR * CFG.umbR + 8;
export const UMBRELLA_RADIUS = Math.sqrt(UMBRELLA_RADIUS_SQ);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function advanceThrottle(throttle: number, input: number, dt: number): number {
  return clamp(throttle + input * dt * 0.85, 0, 1);
}

export function flightSpeed(throttle: number): number {
  return CFG.speedMin + (CFG.speedMax - CFG.speedMin) * throttle;
}

export function steerVelocity(velocity: number, desired: number, dt: number): number {
  return velocity + (desired - velocity) * (1 - Math.exp(-14 * dt));
}

export function friesAltitude(baseY: number, z: number, time: number): number {
  return baseY + Math.sin(time * 6 + z * 0.04) * 5;
}

function ellipsoid(dx: number, dy: number, dz: number, rx2: number, ry2: number, rz2: number): number {
  return dx * dx / rx2 + dy * dy / ry2 + dz * dz / rz2;
}

export function friesDistance(dx: number, dy: number, dz: number): number {
  return ellipsoid(dx, dy, dz, 64, 36, 81);
}

export function hitsStone(dx: number, dy: number, dz: number): boolean {
  return ellipsoid(dx, dy, dz, 42, 28, 52) < 1;
}

export function hitsUmbrella(dx: number, altitude: number, dz: number): boolean {
  return dx * dx + dz * dz < UMBRELLA_RADIUS_SQ && altitude < UMBRELLA_CEILING && altitude > CFG.umbH - 12;
}

function stonePosition(stone: StonePath, t: number): FlightPoint {
  return {
    x: stone.x + stone.vx * t,
    y: stone.y + stone.vy * t - STONE_GRAVITY * 0.5 * t * (t + STEP),
    z: stone.z + stone.vz * t
  };
}

function forecastPath(state: FlightState, controls: FlightControls): PathPoint[] {
  let { x, y, z, vx, vy, throttle } = state;
  const path: PathPoint[] = [{ x, y, z, t: 0 }];
  for (let frame = 1; frame <= LOOK_AHEAD / STEP; frame++) {
    throttle = advanceThrottle(throttle, controls.throttle, STEP);
    vx = steerVelocity(vx, controls.x * CFG.maxStrafe, STEP);
    vy = steerVelocity(vy, -controls.y * CFG.maxClimb, STEP);
    x = clamp(x + vx * STEP, -CFG.xBound, CFG.xBound);
    y = clamp(y + vy * STEP, CFG.altMin, CFG.altMax);
    z += flightSpeed(throttle) * STEP;
    path.push({ x, y, z, t: frame * STEP });
  }
  return path;
}

interface Clearance {
  player: FlightPoint;
  t: number;
}

export interface FlightCues {
  umbrella?: Clearance & { object: FlightPoint; danger: boolean };
  fries?: Clearance & { source: PickupPoint; aligned: boolean };
  stone?: { source: StonePath; object: FlightPoint; t: number };
}

export function forecastFlight(
  state: FlightState, controls: FlightControls, time: number, invulnerable: number,
  umbrellas: readonly { x: number; z: number; hit: boolean }[], pickups: readonly PickupPoint[],
  stones: readonly StonePath[]
): FlightCues {
  const cues: FlightCues = {};
  if (!umbrellas.length && !pickups.length && !stones.length) return cues;
  const path = forecastPath(state, controls);
  for (const h of umbrellas) {
    if (h.hit || h.z < state.z - CFG.umbR - 1) continue;
    const object = { x: h.x, y: UMBRELLA_CEILING, z: h.z };
    const hit = path.find((p) => p.t >= invulnerable && hitsUmbrella(h.x - p.x, p.y, h.z - p.z));
    const crossing = path.find((p) => p.z >= h.z);
    const clear = crossing && crossing.z - h.z < 1 &&
      Math.abs(crossing.x - h.x) < CFG.umbR + 4 && crossing.y >= UMBRELLA_CEILING ? crossing : undefined;
    const point = hit ?? clear;
    if (!point) continue;
    const previous = cues.umbrella;
    if (!previous || (hit && !previous.danger) || (!!hit === previous.danger && point.t < previous.t)) {
      cues.umbrella = { object, player: point, t: point.t, danger: !!hit };
    }
  }

  let bestFries = Infinity;
  for (const fries of pickups) {
    if (fries.z < state.z - 9) continue;
    for (const p of path) {
      const dx = fries.x - p.x;
      const dz = fries.z - p.z;
      if (Math.abs(dz) > 9 || Math.abs(dx) > 25) continue;
      const y = friesAltitude(fries.baseY, fries.z, time + p.t);
      const dy = y - p.y;
      const separation = friesDistance(dx, dy, dz);
      const rank = (separation < 1 ? 0 : separation) + p.t * 0.1;
      if (rank >= bestFries) continue;
      bestFries = rank;
      cues.fries = { source: fries, player: p, t: p.t, aligned: separation < 1 };
    }
  }

  for (const source of stones) {
    for (const p of path) {
      if (p.t >= source.life || (cues.stone && p.t >= cues.stone.t)) break;
      const stone = stonePosition(source, p.t);
      if (stone.y < 0 || stone.z < p.z - CFG.playerRel + 4) break;
      if (p.t < invulnerable || !hitsStone(stone.x - p.x, stone.y - p.y, stone.z - p.z)) continue;
      cues.stone = { source, object: stone, t: p.t };
      break;
    }
  }
  return cues;
}
