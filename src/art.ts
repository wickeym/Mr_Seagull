export const ART = 4;

const C = {
  k: '#1d1c22',
  w: '#f6f3ec',
  j: '#ffffff',
  g: '#c9c6bf',
  d: '#8d9291',
  z: '#5c6370',
  y: '#f0c44c',
  o: '#e07a3d',
  t: '#b85a2b',
  s: '#f0b896',
  n: '#e39888',
  b: '#4f90d8',
  u: '#2f5f98',
  r: '#d4453a',
  p: '#5fa85d',
  m: '#7a4c2e',
  a: '#f2d38a',
  c: '#f7f0c8',
  h: '#d8d3a6',
  i: '#3b2a22',
  l: '#f4f7fa',
  e: '#111111',
  f: '#ffd36a',
  x: '#6a3b1d',
  v: '#9b59b6',
  q: '#f4a6c1',
  skinHi: '#ffe1cc',
  wing: '#9aa3ad',
  tip: '#3a414c',
  beak: '#f0c44c',
  beakD: '#c9842a',
  wood: '#c48a4a',
  woodD: '#7a4c2e'
};

type Mood = 'idle' | 'look' | 'horror';

function sheet(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

function pset(g: CanvasRenderingContext2D, x: number, y: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function oval(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  col: string
): void {
  const rxi = Math.max(1, rx);
  const ryi = Math.max(1, ry);
  const y0 = Math.ceil(-ryi);
  const y1 = Math.floor(ryi);
  g.fillStyle = col;
  for (let y = y0; y <= y1; y++) {
    const t = 1 - (y * y) / (ryi * ryi);
    if (t < 0) continue;
    const span = Math.sqrt(t) * rxi;
    g.fillRect(Math.round(cx - span), Math.round(cy + y), Math.max(1, Math.round(span * 2)), 1);
  }
}

function ovalRot(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  col: string
): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const bound = Math.ceil(Math.max(rx, ry) + 1);
  g.fillStyle = col;
  for (let y = -bound; y <= bound; y++) {
    for (let x = -bound; x <= bound; x++) {
      const lx = x * cos + y * sin;
      const ly = -x * sin + y * cos;
      if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) {
        g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }
}

function blob(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  rot = 0
): void {
  if (rot === 0) oval(g, cx, cy, rx, ry, fill);
  else ovalRot(g, cx, cy, rx, ry, rot, fill);
}

function stick(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  col: string
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) || 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    oval(g, x0 + dx * t, y0 + dy * t, r, r, col);
  }
}

function ink(c: HTMLCanvasElement): HTMLCanvasElement {
  const g = c.getContext('2d')!;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width;
  const h = c.height;
  const a = (i: number): boolean => (d[i * 4 + 3] ?? 0) > 20;
  const ring: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (a(i)) continue;
      if (
        (x > 0 && a(i - 1)) ||
        (x < w - 1 && a(i + 1)) ||
        (y > 0 && a(i - w)) ||
        (y < h - 1 && a(i + w))
      ) {
        ring.push(i);
      }
    }
  }
  for (const i of ring) {
    const o = i * 4;
    d[o] = 29;
    d[o + 1] = 28;
    d[o + 2] = 34;
    d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

function drawEye(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  mood: Mood
): void {
  oval(g, x, y, rx, ry, C.j);
  const py = mood === 'look' ? -Math.max(1, ry * 0.4) : 0;
  const pr = mood === 'horror' ? Math.max(1.8, rx * 0.32) : Math.max(1.6, rx * 0.45);
  oval(g, x, y + py, pr, pr, C.e);
  pset(g, x - 1, y + py - 1, C.j);
  const browY = y - ry - (mood === 'look' ? 3 : 2);
  rect(g, x - rx, browY, rx * 2 + 1, mood === 'horror' ? 2 : 1, C.k);
}

function drawMouth(g: CanvasRenderingContext2D, x: number, y: number, mood: Mood): void {
  if (mood === 'horror') {
    oval(g, x, y, 6, 7, '#4a1816');
    rect(g, x - 5, y - 5, 10, 3, C.j);
    for (let i = -4; i <= 4; i += 2) rect(g, x + i, y - 5, 1, 3, C.g);
    oval(g, x, y + 2, 2, 2, C.n);
  } else if (mood === 'look') {
    oval(g, x, y, 3.5, 2.5, '#4a1816');
    rect(g, x - 3, y - 2, 6, 2, C.j);
  } else {
    rect(g, x - 4, y, 8, 2, C.n);
    rect(g, x - 3, y + 1, 6, 1, '#c46a62');
  }
}

function drawFace(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  mood: Mood,
  skin: string,
  hair: (g: CanvasRenderingContext2D, cx: number, cy: number) => void
): void {
  oval(g, cx, cy, 11, 13, skin);
  oval(g, cx - 11, cy + 1, 3, 4, skin);
  oval(g, cx + 11, cy + 1, 3, 4, skin);
  hair(g, cx, cy);
  oval(g, cx - 5, cy + 3, 3, 2, C.n);
  oval(g, cx + 5, cy + 3, 3, 2, C.n);
  const eyeY = mood === 'look' ? cy - 3 : cy - 1;
  const eyeR = mood === 'horror' ? 5 : 3.6;
  const eyeH = mood === 'horror' ? 6 : 4.2;
  drawEye(g, cx - 5, eyeY, eyeR, eyeH, mood);
  drawEye(g, cx + 5, eyeY, eyeR, eyeH, mood);
  rect(g, cx - 1, cy + 3, 2, 3, C.n);
  pset(g, cx, cy + 2, C.skinHi);
  drawMouth(g, cx, mood === 'horror' ? cy + 9 : cy + 8, mood);
}

function drawHand(g: CanvasRenderingContext2D, x: number, y: number, skin: string, up: boolean): void {
  blob(g, x, y, 5, 5, skin);
  const base = up ? -Math.PI / 2 : Math.PI * 0.15;
  for (let i = 0; i < 4; i++) {
    const a = base + (i - 1.5) * 0.32;
    stick(g, x, y, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 1.2, skin);
  }
}

function drawPerson(
  mood: Mood,
  hair: (g: CanvasRenderingContext2D, cx: number, cy: number) => void,
  clothes: (g: CanvasRenderingContext2D, cx: number, top: number, mood: Mood) => void,
  extras?: (g: CanvasRenderingContext2D, cx: number, headY: number, mood: Mood) => void
): HTMLCanvasElement {
  const w = mood === 'horror' ? 88 : 64;
  const h = mood === 'horror' ? 80 : 64;
  const { c, g } = sheet(w, h);
  const cx = w / 2;
  const headY = mood === 'horror' ? 28 : 20;
  const bodyY = headY + 22;
  const skin = C.s;

  stick(g, cx - 7, h - 14, cx - 8, h - 3, 2.2, C.m);
  stick(g, cx + 7, h - 14, cx + 8, h - 3, 2.2, C.m);
  blob(g, cx - 8, h - 3, 5, 2.4, C.k);
  blob(g, cx + 8, h - 3, 5, 2.4, C.k);

  clothes(g, cx, bodyY, mood);

  if (mood === 'horror') {
    stick(g, cx - 10, bodyY - 4, cx - 28, headY - 10, 2.4, skin);
    stick(g, cx + 10, bodyY - 4, cx + 28, headY - 10, 2.4, skin);
    drawHand(g, cx - 30, headY - 12, skin, true);
    drawHand(g, cx + 30, headY - 12, skin, true);
  } else if (mood === 'look') {
    stick(g, cx - 10, bodyY - 2, cx - 22, headY + 4, 2.4, skin);
    stick(g, cx + 10, bodyY - 2, cx + 22, headY + 4, 2.4, skin);
    drawHand(g, cx - 24, headY + 4, skin, false);
    drawHand(g, cx + 24, headY + 4, skin, false);
  } else {
    stick(g, cx - 10, bodyY, cx - 14, h - 22, 2.4, skin);
    stick(g, cx + 10, bodyY, cx + 14, h - 22, 2.4, skin);
    blob(g, cx - 14, h - 22, 3.5, 3.5, skin);
    blob(g, cx + 14, h - 22, 3.5, 3.5, skin);
  }

  drawFace(g, cx, headY, mood, skin, hair);
  extras?.(g, cx, headY, mood);
  return ink(c);
}

function sunHair(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  oval(g, cx, cy - 11, 12, 5, C.x);
  oval(g, cx - 9, cy - 8, 4, 4, C.x);
  oval(g, cx + 9, cy - 8, 4, 4, C.x);
}

function touristHair(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  oval(g, cx, cy - 11, 11, 4, C.i);
}

function jogHair(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  oval(g, cx, cy - 11, 12, 5, C.k);
  oval(g, cx - 9, cy - 8, 3, 4, C.k);
  oval(g, cx + 9, cy - 8, 3, 4, C.k);
}

function kidHair(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  oval(g, cx, cy - 11, 13, 6, C.q);
  oval(g, cx - 12, cy - 8, 4, 5, C.q);
  oval(g, cx + 12, cy - 8, 4, 5, C.q);
  oval(g, cx - 15, cy - 11, 3.5, 3.5, '#ff7eb3');
  oval(g, cx + 15, cy - 11, 3.5, 3.5, '#ff7eb3');
}

function sunClothes(g: CanvasRenderingContext2D, cx: number, top: number): void {
  blob(g, cx, top, 14, 10, C.b);
  oval(g, cx, top + 2, 10, 6, '#6aa8e8');
  rect(g, cx - 12, top + 8, 24, 4, C.a);
  rect(g, cx - 12, top + 9, 24, 1, C.k);
}

function touristClothes(g: CanvasRenderingContext2D, cx: number, top: number): void {
  blob(g, cx, top + 2, 14, 12, C.b);
  rect(g, cx - 8, top - 2, 16, 3, C.w);
  for (let i = -6; i <= 6; i += 4) rect(g, cx + i, top, 2, 14, C.w);
  blob(g, cx, top + 14, 11, 5, C.u);
}

function jogClothes(g: CanvasRenderingContext2D, cx: number, top: number): void {
  blob(g, cx, top, 13, 11, C.r);
  oval(g, cx, top + 2, 8, 6, '#ef6a5c');
  blob(g, cx, top + 14, 11, 5, C.k);
  rect(g, cx - 3, top + 12, 6, 3, C.w);
}

function kidClothes(g: CanvasRenderingContext2D, cx: number, top: number): void {
  blob(g, cx, top + 1, 13, 12, C.q);
  oval(g, cx, top + 3, 8, 6, '#ffd36a');
  blob(g, cx, top + 14, 10, 5, C.b);
  blob(g, cx - 8, top + 28, 5, 3, C.y);
  blob(g, cx + 8, top + 28, 5, 3, C.y);
}

function slingerHair(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  oval(g, cx, cy - 11, 12, 6, C.x);
  oval(g, cx - 10, cy - 8, 4, 5, C.x);
  oval(g, cx + 11, cy - 7, 4, 5, C.m);
  oval(g, cx + 2, cy - 14, 6, 3, C.m);
}

function slingerClothes(g: CanvasRenderingContext2D, cx: number, top: number): void {
  blob(g, cx, top + 1, 13, 12, C.p);
  oval(g, cx, top + 3, 8, 6, '#7ec86a');
  blob(g, cx, top + 14, 10, 5, C.i);
  rect(g, cx - 4, top + 8, 8, 2, C.y);
  blob(g, cx - 8, top + 28, 5, 3, C.k);
  blob(g, cx + 8, top + 28, 5, 3, C.k);
}

function drawSling(g: CanvasRenderingContext2D, cx: number, headY: number, mood: Mood): void {
  const wood = C.wood;
  const woodD = C.woodD;
  if (mood === 'horror') {
    stick(g, cx + 18, headY + 26, cx + 28, headY + 18, 1.4, wood);
    stick(g, cx + 18, headY + 26, cx + 26, headY + 32, 1.4, wood);
    return;
  }
  if (mood === 'look') {
    const hx = cx + 18;
    const hy = headY + 2;
    stick(g, hx, hy + 10, hx - 2, hy - 10, 2.2, woodD);
    stick(g, hx - 2, hy - 10, hx - 10, hy - 16, 2, wood);
    stick(g, hx - 2, hy - 10, hx + 9, hy - 14, 2, wood);
    stick(g, hx - 10, hy - 16, hx - 4, hy - 6, 1.1, C.k);
    stick(g, hx + 9, hy - 14, hx - 4, hy - 6, 1.1, C.k);
    oval(g, hx - 4, hy - 6, 3.6, 3, C.z);
    oval(g, hx - 5, hy - 7, 1.4, 1.1, C.g);
    blob(g, hx - 8, hy + 2, 4, 4, C.s);
    return;
  }
  stick(g, cx + 16, headY + 22, cx + 18, headY + 8, 1.6, woodD);
  stick(g, cx + 18, headY + 8, cx + 12, headY + 2, 1.4, wood);
  stick(g, cx + 18, headY + 8, cx + 24, headY + 3, 1.4, wood);
  stick(g, cx + 12, headY + 2, cx + 18, headY + 12, 0.7, C.k);
  stick(g, cx + 24, headY + 3, cx + 18, headY + 12, 0.7, C.k);
}

function drawPebble(): HTMLCanvasElement {
  const { c, g } = sheet(16, 14);
  oval(g, 8, 7, 6, 5, C.z);
  oval(g, 8, 7, 5, 4, C.d);
  oval(g, 6, 6, 2, 1.6, C.g);
  pset(g, 10, 8, C.k);
  return ink(c);
}

function touristHat(g: CanvasRenderingContext2D, cx: number, headY: number): void {
  oval(g, cx, headY - 15, 15, 3, C.w);
  oval(g, cx, headY - 19, 8, 5, C.w);
  rect(g, cx - 8, headY - 16, 16, 2, C.y);
}

function touristCam(g: CanvasRenderingContext2D, cx: number, headY: number): void {
  stick(g, cx - 8, headY + 16, cx + 8, headY + 16, 1, C.k);
  blob(g, cx, headY + 22, 7, 5, C.z);
  oval(g, cx + 2, headY + 22, 3, 3, C.k);
  oval(g, cx + 2, headY + 22, 2, 2, C.u);
}

function jogBand(g: CanvasRenderingContext2D, cx: number, headY: number): void {
  rect(g, cx - 11, headY - 10, 22, 4, C.w);
  rect(g, cx - 11, headY - 9, 22, 2, C.r);
}

type GullPose = 'up' | 'mid' | 'down' | 'leftUp' | 'leftMid' | 'leftDown';

function drawGull(pose: GullPose): HTMLCanvasElement {
  const { c, g } = sheet(168, 92);
  const cx = 84;
  const cy = 44;
  const bank = pose.startsWith('left') ? -0.42 : 0;
  const flap =
    pose === 'up' || pose === 'leftUp' ? -0.7 : pose === 'down' || pose === 'leftDown' ? 0.5 : -0.12;

  const wing = (side: number, lift: number) => {
    const baseX = cx + side * 7;
    const baseY = cy - 2;
    const tipX = cx + side * 74;
    const tipY = cy - 6 + lift * 26 + bank * side * 16;
    const rot = Math.atan2(tipY - baseY, tipX - baseX);
    const mx = (baseX + tipX) / 2;
    const my = (baseY + tipY) / 2;
    ovalRot(g, mx, my, 36, 9, rot, C.w);
    ovalRot(g, mx + side * 6, my + 3, 28, 5.5, rot, C.g);
    ovalRot(g, tipX - side * 8, tipY + 1, 14, 5, rot, C.wing);
    ovalRot(g, tipX, tipY, 9, 4, rot, C.tip);
    ovalRot(g, baseX + side * 10, baseY - 1, 12, 4, rot, C.j);
    for (let i = 0; i < 7; i++) {
      const t = 0.3 + i * 0.09;
      const x = baseX + (tipX - baseX) * t;
      const y = baseY + (tipY - baseY) * t;
      stick(g, x, y - 3, x + Math.sin(rot) * 6, y + Math.cos(rot) * 6, 0.5, '#b8bec4');
    }
  };

  wing(-1, flap);
  wing(1, pose.startsWith('left') ? flap + 0.32 : flap);

  ovalRot(g, cx + bank * 6, cy + 10, 11, 18, bank * 0.4, C.w);
  oval(g, cx + bank * 6, cy + 16, 8, 12, C.g);
  oval(g, cx + bank * 5, cy + 4, 9, 8, C.j);
  oval(g, cx + bank * 6, cy + 28, 6, 8, C.w);
  oval(g, cx + bank * 6, cy + 34, 4, 6, C.g);

  const hx = cx + bank * 10;
  const hy = cy - 16;
  oval(g, hx, hy, 8, 7, C.w);
  oval(g, hx, hy - 2, 5, 4, C.j);
  stick(g, hx, hy - 6, hx + bank * 3, hy - 18, 1.8, C.beak);
  oval(g, hx + bank * 3, hy - 18, 2, 1.6, C.beakD);
  if (Math.abs(bank) > 0.1) {
    oval(g, hx + bank * 6, hy, 2, 2, C.e);
    pset(g, hx + bank * 5, hy - 1, C.j);
  }

  stick(g, cx - 3, cy + 22, cx - 6, cy + 40, 1.5, C.o);
  stick(g, cx + 4, cy + 22, cx + 7, cy + 40, 1.5, C.o);
  oval(g, cx - 7, cy + 41, 3.5, 1.5, C.o);
  oval(g, cx + 8, cy + 41, 3.5, 1.5, C.o);
  return ink(c);
}

function drawCar(mood: Mood): HTMLCanvasElement {
  const { c, g } = sheet(88, 74);
  const cx = 44;

  oval(g, 20, 62, 11, 8, C.k);
  oval(g, 68, 62, 11, 8, C.k);
  oval(g, 20, 62, 5, 4, C.z);
  oval(g, 68, 62, 5, 4, C.z);
  oval(g, 20, 61, 2, 2, C.g);
  oval(g, 68, 61, 2, 2, C.g);

  oval(g, cx, 50, 36, 14, C.r);
  rect(g, 12, 42, 64, 16, C.r);
  oval(g, cx, 44, 30, 10, '#e0564a');
  rect(g, 16, 56, 56, 5, C.z);
  rect(g, 18, 48, 9, 5, C.o);
  rect(g, 61, 48, 9, 5, C.o);
  pset(g, 22, 50, C.y);
  pset(g, 65, 50, C.y);

  oval(g, cx, 34, 22, 12, '#c4453c');
  oval(g, cx, 24, 16, 11, C.l);
  oval(g, cx, 22, 13, 9, C.u);
  oval(g, cx, 20, 10, 6, '#7ec8ea');

  stick(g, 30, 30, 30, 12, 1.3, C.z);
  stick(g, 58, 30, 58, 12, 1.3, C.z);
  stick(g, 30, 12, 58, 12, 1.3, C.z);

  oval(g, cx, 18, 7, 7, C.s);
  oval(g, cx, 14, 8, 4, C.k);
  if (mood !== 'idle') {
    drawEye(g, cx - 3, 18, 2.4, 2.8, 'look');
    drawEye(g, cx + 3, 18, 2.4, 2.8, 'look');
    oval(g, cx, 24, 3, 2, '#4a1816');
  }

  oval(g, cx, 38, 8, 3, C.k);
  return ink(c);
}

function drawCarFront(mood: Mood): HTMLCanvasElement {
  const { c, g } = sheet(88, 74);
  const cx = 44;
  const body = C.b;
  const bodyD = C.u;

  oval(g, 20, 62, 11, 8, C.k);
  oval(g, 68, 62, 11, 8, C.k);
  oval(g, 20, 62, 5, 4, C.z);
  oval(g, 68, 62, 5, 4, C.z);
  oval(g, 20, 61, 2, 2, C.g);
  oval(g, 68, 61, 2, 2, C.g);

  oval(g, cx, 52, 36, 13, body);
  rect(g, 12, 44, 64, 16, body);
  oval(g, cx, 46, 32, 11, '#6aa8e8');
  rect(g, 16, 56, 56, 5, C.g);
  rect(g, 30, 58, 28, 4, C.k);
  for (let i = 0; i < 5; i++) rect(g, 32 + i * 5, 58, 3, 4, C.z);

  oval(g, 18, 52, 8, 5, C.f);
  oval(g, 70, 52, 8, 5, C.f);
  oval(g, 18, 52, 4, 2.4, C.j);
  oval(g, 70, 52, 4, 2.4, C.j);
  oval(g, 26, 54, 3, 2, C.o);
  oval(g, 62, 54, 3, 2, C.o);

  oval(g, cx, 34, 22, 12, bodyD);
  oval(g, cx, 24, 16, 11, C.l);
  oval(g, cx, 22, 13, 9, C.u);
  oval(g, cx, 20, 10, 6, '#7ec8ea');

  oval(g, 10, 46, 5, 3, C.z);
  oval(g, 78, 46, 5, 3, C.z);

  oval(g, cx, 18, 7, 7, C.s);
  oval(g, cx, 14, 8, 4, C.k);
  if (mood !== 'idle') {
    drawEye(g, cx - 3, 18, 2.4, 2.8, 'look');
    drawEye(g, cx + 3, 18, 2.4, 2.8, 'look');
    oval(g, cx, 24, 3, 2, '#4a1816');
  } else {
    oval(g, cx - 2, 18, 1.6, 1.8, C.e);
    oval(g, cx + 2, 18, 1.6, 1.8, C.e);
  }

  oval(g, cx, 40, 9, 3, C.k);
  return ink(c);
}

function drawFries(): HTMLCanvasElement {
  const { c, g } = sheet(48, 44);
  blob(g, 24, 30, 16, 12, C.r);
  rect(g, 10, 22, 28, 4, '#b83b32');
  for (let i = 0; i < 7; i++) {
    const x = 12 + i * 4;
    const h = 16 + ((i * 3) % 5);
    stick(g, x, 22, x + (i % 2 === 0 ? 1 : -1), 22 - h, 1.6, C.f);
    pset(g, x, 22 - h + 2, C.y);
  }
  rect(g, 18, 28, 12, 3, C.w);
  return ink(c);
}

function drawPoop(): HTMLCanvasElement {
  const { c, g } = sheet(32, 28);
  blob(g, 16, 18, 11, 8, C.c);
  blob(g, 14, 12, 8, 6, C.c);
  blob(g, 17, 7, 5, 5, C.h);
  oval(g, 12, 14, 4, 3, C.j);
  oval(g, 20, 20, 3, 2, C.h);
  stick(g, 22, 10, 26, 4, 1.2, C.c);
  return ink(c);
}

function drawSplat(): HTMLCanvasElement {
  const { c, g } = sheet(64, 36);
  blob(g, 32, 20, 18, 10, C.c);
  oval(g, 32, 18, 12, 6, C.h);
  for (const [x, y, r] of [
    [10, 12, 4],
    [52, 14, 5],
    [18, 28, 3],
    [46, 26, 4],
    [8, 22, 2],
    [58, 24, 3]
  ] as const) {
    blob(g, x, y, r, r * 0.7, C.c);
  }
  return ink(c);
}

function drawShadow(): HTMLCanvasElement {
  const { c, g } = sheet(56, 18);
  g.globalAlpha = 0.9;
  oval(g, 28, 9, 24, 7, C.k);
  g.globalAlpha = 1;
  return c;
}

function drawHeart(): HTMLCanvasElement {
  const { c, g } = sheet(32, 28);
  for (let y = 2; y < 27; y++) {
    for (let x = 4; x < 28; x++) {
      const nx = (x - 16) / 10;
      const ny = (11 - y) / 10;
      if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny <= 0) {
        pset(g, x, y, C.r);
      }
    }
  }
  oval(g, 11, 10, 2.4, 1.6, C.j);
  return ink(c);
}

function drawAmmo(): HTMLCanvasElement {
  const { c, g } = sheet(28, 24);
  blob(g, 14, 14, 9, 8, C.c);
  blob(g, 14, 8, 6, 5, C.h);
  oval(g, 11, 12, 3, 2, C.j);
  return ink(c);
}

function drawCloud(): HTMLCanvasElement {
  const { c, g } = sheet(96, 36);
  blob(g, 30, 22, 18, 12, C.l);
  blob(g, 50, 16, 22, 14, C.l);
  blob(g, 72, 22, 16, 11, C.l);
  blob(g, 48, 24, 28, 10, C.l);
  oval(g, 44, 14, 10, 4, C.j);
  return ink(c);
}

function drawPier(): HTMLCanvasElement {
  const { c, g } = sheet(72, 24);
  for (let i = 0; i < 6; i++) {
    rect(g, 6 + i * 12, 2, 3, 20, C.woodD);
    rect(g, 7 + i * 12, 2, 1, 20, C.a);
  }
  rect(g, 2, 8, 68, 6, C.wood);
  rect(g, 2, 9, 68, 1, C.a);
  rect(g, 2, 12, 68, 1, C.woodD);
  return ink(c);
}

function drawUmbrellaIcon(): HTMLCanvasElement {
  const { c, g } = sheet(48, 48);
  stick(g, 24, 46, 24, 18, 1.6, C.m);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    const col = i % 2 === 0 ? C.r : C.w;
    for (let t = 0; t < 18; t++) {
      const a = a0 + (a1 - a0) * (t / 18);
      stick(g, 24, 16, 24 + Math.cos(a) * 20, 18 + Math.sin(a) * 8, 1.2, col);
    }
  }
  blob(g, 24, 16, 3, 3, C.y);
  return ink(c);
}

export type SpriteName =
  | 'gull0'
  | 'gull1'
  | 'gull2'
  | 'gullL0'
  | 'gullL1'
  | 'gullL2'
  | 'gullR0'
  | 'gullR1'
  | 'gullR2'
  | 'poop'
  | 'splat'
  | 'shadow'
  | 'sunbather'
  | 'sunbatherLook'
  | 'sunbatherHorror'
  | 'tourist'
  | 'touristLook'
  | 'touristHorror'
  | 'jogger'
  | 'joggerLook'
  | 'joggerHorror'
  | 'kid'
  | 'kidLook'
  | 'kidHorror'
  | 'slinger'
  | 'slingerAim'
  | 'slingerLook'
  | 'slingerHorror'
  | 'pebble'
  | 'car'
  | 'carLook'
  | 'carFront'
  | 'carFrontLook'
  | 'umbrella'
  | 'fries'
  | 'heart'
  | 'ammo'
  | 'cloud'
  | 'pier';

export type Atlas = Record<SpriteName, HTMLCanvasElement>;

export function createAtlas(): Atlas {
  const gull0 = drawGull('up');
  const gull1 = drawGull('mid');
  const gull2 = drawGull('down');
  const gullL0 = drawGull('leftUp');
  const gullL1 = drawGull('leftMid');
  const gullL2 = drawGull('leftDown');

  return {
    gull0,
    gull1,
    gull2,
    gullL0,
    gullL1,
    gullL2,
    gullR0: flipX(gullL0),
    gullR1: flipX(gullL1),
    gullR2: flipX(gullL2),
    poop: drawPoop(),
    splat: drawSplat(),
    shadow: drawShadow(),
    sunbather: drawPerson('idle', sunHair, sunClothes),
    sunbatherLook: drawPerson('look', sunHair, sunClothes),
    sunbatherHorror: drawPerson('horror', sunHair, sunClothes),
    tourist: drawPerson('idle', touristHair, touristClothes, (g, cx, hy) => {
      touristHat(g, cx, hy);
      touristCam(g, cx, hy);
    }),
    touristLook: drawPerson('look', touristHair, touristClothes, (g, cx, hy) => {
      touristHat(g, cx, hy);
      touristCam(g, cx, hy);
    }),
    touristHorror: drawPerson('horror', touristHair, touristClothes, (g, cx, hy) => {
      touristHat(g, cx, hy);
      touristCam(g, cx, hy);
    }),
    jogger: drawPerson('idle', jogHair, jogClothes, jogBand),
    joggerLook: drawPerson('look', jogHair, jogClothes, jogBand),
    joggerHorror: drawPerson('horror', jogHair, jogClothes, jogBand),
    kid: drawPerson('idle', kidHair, kidClothes),
    kidLook: drawPerson('look', kidHair, kidClothes),
    kidHorror: drawPerson('horror', kidHair, kidClothes),
    slinger: drawPerson('idle', slingerHair, slingerClothes, drawSling),
    slingerAim: drawPerson('look', slingerHair, slingerClothes, drawSling),
    slingerLook: drawPerson('look', slingerHair, slingerClothes, drawSling),
    slingerHorror: drawPerson('horror', slingerHair, slingerClothes, drawSling),
    pebble: drawPebble(),
    car: drawCar('idle'),
    carLook: drawCar('look'),
    carFront: drawCarFront('idle'),
    carFrontLook: drawCarFront('look'),
    umbrella: drawUmbrellaIcon(),
    fries: drawFries(),
    heart: drawHeart(),
    ammo: drawAmmo(),
    cloud: drawCloud(),
    pier: drawPier()
  };
}
