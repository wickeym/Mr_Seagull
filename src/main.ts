import { H, W } from './config';
import { Game } from './game';
import { Input } from './input';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d', { alpha: false })!;
ctx.imageSmoothingEnabled = false;

const input = new Input(canvas);
const game = new Game(ctx, input);

(window as unknown as { __game: Game }).__game = game;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}

canvas.width = W;
canvas.height = H;
canvas.tabIndex = 0;
canvas.focus();
requestAnimationFrame(frame);

let immersive = false;
async function goImmersive(): Promise<void> {
  if (immersive) return;
  immersive = true;
  const root = document.documentElement as HTMLElement & {
    requestFullscreen?: (opts?: { navigationUI?: string }) => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (!document.fullscreenElement) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else await root.webkitRequestFullscreen?.();
    }
  } catch {
    /* iOS Safari has no Fullscreen API; CSS 100dvh covers it */
  }
  try {
    const orient = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    await orient.lock?.('landscape');
  } catch {
    /* lock is optional, rotate overlay still handles portrait */
  }
}

const boot = () => {
  void goImmersive();
  canvas.focus();
};
window.addEventListener('pointerdown', boot, { once: true });
window.addEventListener('touchstart', boot, { once: true, passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) last = performance.now();
});

window.addEventListener('orientationchange', () => {
  last = performance.now();
});
