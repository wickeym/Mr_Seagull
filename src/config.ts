export const PX = 2;
export const W = 480 * PX;
export const H = 270 * PX;
export const HORIZON = 72 * PX;
export const FOV = 152 * PX;

export const CFG = {
  altMin: 12,
  altMax: 54,
  maxStrafe: 50,
  maxClimb: 42,
  xBound: 62,
  speedMin: 9,
  speedStart: 13,
  speedMax: 34,
  gravity: 78,
  playerRel: 40,
  poopCooldown: 0.45,
  chargeHold: 0.38,
  maxAmmo: 8,
  lives: 3,
  spawnStart: 1.7,
  spawnMin: 0.75,
  windMax: 14,
  road: 26,
  roadLimit: 19,
  sandMin: 30,
  sandMax: 58,
  crossEvery: 90,
  crossDepth: 14,
  umbH: 19,
  umbR: 9.2,
  drawFar: 320,
  railFar: 270
};

export const COLORS = {
  skyTop: [18, 62, 104] as const,
  skyMid: [92, 178, 220] as const,
  skyLow: [196, 226, 168] as const,
  sun: [255, 220, 110] as const,
  ocean: [28, 92, 128] as const,
  foam: [210, 232, 236] as const
};
