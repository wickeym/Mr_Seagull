const FONT: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  A: ['.kkk.', 'k...k', 'k...k', 'kkkkk', 'k...k', 'k...k', 'k...k'],
  B: ['kkkk.', 'k...k', 'k...k', 'kkkk.', 'k...k', 'k...k', 'kkkk.'],
  C: ['.kkk.', 'k...k', 'k....', 'k....', 'k....', 'k...k', '.kkk.'],
  D: ['kkkk.', 'k...k', 'k...k', 'k...k', 'k...k', 'k...k', 'kkkk.'],
  E: ['kkkkk', 'k....', 'k....', 'kkkk.', 'k....', 'k....', 'kkkkk'],
  F: ['kkkkk', 'k....', 'k....', 'kkkk.', 'k....', 'k....', 'k....'],
  G: ['.kkk.', 'k...k', 'k....', 'k.kkk', 'k...k', 'k...k', '.kkk.'],
  H: ['k...k', 'k...k', 'k...k', 'kkkkk', 'k...k', 'k...k', 'k...k'],
  I: ['kkkkk', '..k..', '..k..', '..k..', '..k..', '..k..', 'kkkkk'],
  J: ['kkkkk', '...k.', '...k.', '...k.', '...k.', 'k...k', '.kkk.'],
  K: ['k...k', 'k..k.', 'k.k..', 'kk...', 'k.k..', 'k..k.', 'k...k'],
  L: ['k....', 'k....', 'k....', 'k....', 'k....', 'k....', 'kkkkk'],
  M: ['k...k', 'kk.kk', 'k.k.k', 'k.k.k', 'k...k', 'k...k', 'k...k'],
  N: ['k...k', 'kk..k', 'k.k.k', 'k.k.k', 'k..kk', 'k...k', 'k...k'],
  O: ['.kkk.', 'k...k', 'k...k', 'k...k', 'k...k', 'k...k', '.kkk.'],
  P: ['kkkk.', 'k...k', 'k...k', 'kkkk.', 'k....', 'k....', 'k....'],
  Q: ['.kkk.', 'k...k', 'k...k', 'k...k', 'k.k.k', 'k..k.', '.kk.k'],
  R: ['kkkk.', 'k...k', 'k...k', 'kkkk.', 'k.k..', 'k..k.', 'k...k'],
  S: ['.kkkk', 'k....', 'k....', '.kkk.', '....k', '....k', 'kkkk.'],
  T: ['kkkkk', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..'],
  U: ['k...k', 'k...k', 'k...k', 'k...k', 'k...k', 'k...k', '.kkk.'],
  V: ['k...k', 'k...k', 'k...k', 'k...k', 'k...k', '.k.k.', '..k..'],
  W: ['k...k', 'k...k', 'k...k', 'k.k.k', 'k.k.k', 'kk.kk', 'k...k'],
  X: ['k...k', 'k...k', '.k.k.', '..k..', '.k.k.', 'k...k', 'k...k'],
  Y: ['k...k', 'k...k', '.k.k.', '..k..', '..k..', '..k..', '..k..'],
  Z: ['kkkkk', '....k', '...k.', '..k..', '.k...', 'k....', 'kkkkk'],
  '0': ['.kkk.', 'k...k', 'k..kk', 'k.k.k', 'kk..k', 'k...k', '.kkk.'],
  '1': ['..k..', '.kk..', '..k..', '..k..', '..k..', '..k..', 'kkkkk'],
  '2': ['.kkk.', 'k...k', '....k', '..kk.', '.k...', 'k....', 'kkkkk'],
  '3': ['kkkk.', '....k', '....k', '.kkk.', '....k', '....k', 'kkkk.'],
  '4': ['...k.', '..kk.', '.k.k.', 'k..k.', 'kkkkk', '...k.', '...k.'],
  '5': ['kkkkk', 'k....', 'k....', 'kkkk.', '....k', '....k', 'kkkk.'],
  '6': ['.kkk.', 'k....', 'k....', 'kkkk.', 'k...k', 'k...k', '.kkk.'],
  '7': ['kkkkk', '....k', '...k.', '..k..', '.k...', '.k...', '.k...'],
  '8': ['.kkk.', 'k...k', 'k...k', '.kkk.', 'k...k', 'k...k', '.kkk.'],
  '9': ['.kkk.', 'k...k', 'k...k', '.kkkk', '....k', '....k', '.kkk.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..k..'],
  '!': ['..k..', '..k..', '..k..', '..k..', '..k..', '.....', '..k..'],
  '?': ['.kkk.', 'k...k', '....k', '..kk.', '..k..', '.....', '..k..'],
  ':': ['.....', '..k..', '.....', '.....', '.....', '..k..', '.....'],
  '-': ['.....', '.....', '.....', 'kkkkk', '.....', '.....', '.....'],
  '+': ['.....', '..k..', '..k..', 'kkkkk', '..k..', '..k..', '.....'],
  x: ['.....', 'k...k', '.k.k.', '..k..', '.k.k.', 'k...k', '.....'],
  '/': ['....k', '...k.', '..k..', '..k..', '.k...', 'k....', 'k....'],
  "'": ['..k..', '..k..', '.k...', '.....', '.....', '.....', '.....'],
  '*': ['k.k.k', '.k.k.', 'kkkkk', '.k.k.', 'k.k.k', '.....', '.....'],
  '<': ['...k.', '..k..', '.k...', 'k....', '.k...', '..k..', '...k.'],
  '>': ['.k...', '..k..', '...k.', '....k', '...k.', '..k..', '.k...']
};

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: 'left' | 'center' | 'right' = 'left'
): void {
  const str = text.toUpperCase();
  const w = str.length * 6 * scale;
  let px = x;
  if (align === 'center') px = Math.round(x - w / 2);
  if (align === 'right') px = Math.round(x - w);
  ctx.fillStyle = color;
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT['?']!;
    for (let gy = 0; gy < 7; gy++) {
      const row = glyph[gy] ?? '';
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === 'k') {
          ctx.fillRect(px + gx * scale, y + gy * scale, scale, scale);
        }
      }
    }
    px += 6 * scale;
  }
}

export function textWidth(text: string, scale = 1): number {
  return text.length * 6 * scale;
}
