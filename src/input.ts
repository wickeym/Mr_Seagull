export type TouchRole = 'stick' | 'drop' | 'fast' | 'slow';

export interface TouchPad {
  x: number;
  y: number;
  r: number;
}

export function touchLayout(w: number, h: number): {
  stick: TouchPad;
  drop: TouchPad;
  fast: TouchPad;
  slow: TouchPad;
} {
  const k = Math.min(w, h);
  return {
    stick: { x: w * 0.17, y: h * 0.74, r: k * 0.175 },
    drop: { x: w * 0.87, y: h * 0.76, r: k * 0.155 },
    fast: { x: w * 0.87, y: h * 0.40, r: k * 0.09 },
    slow: { x: w * 0.70, y: h * 0.40, r: k * 0.09 }
  };
}

function coarsePointer(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.matchMedia('(pointer: coarse)').matches;
}

export class Input {
  readonly keys = new Set<string>();
  dropDown = false;
  dropPressed = false;
  dropReleased = false;
  startPressed = false;
  mutePressed = false;
  helpPressed = false;
  clickPressed = false;
  pointerX = 0;
  pointerY = 0;
  pointerDown = false;
  usingTouch = coarsePointer();
  padX = 0;
  padY = 0;
  stickActive = false;
  stickOriginX = 0;
  stickOriginY = 0;
  stickKnobX = 0;
  stickKnobY = 0;
  fastHeld = false;
  slowHeld = false;
  dropHeld = false;
  private readonly pressed = new Set<string>();
  private prevDrop = false;
  private queuedClick = false;
  private readonly pointers = new Map<number, TouchRole>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const stick = touchLayout(canvas.width, canvas.height).stick;
    this.stickOriginX = stick.x;
    this.stickOriginY = stick.y;
    this.stickKnobX = stick.x;
    this.stickKnobY = stick.y;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.tabIndex = 0;

    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.target === this.canvas || this.canvas.contains(e.target as Node)) e.preventDefault();
      },
      { passive: false }
    );
  }

  private addKey(e: KeyboardEvent): void {
    this.keys.add(e.key.toLowerCase());
    this.keys.add(e.code.toLowerCase());
    if (!e.repeat) {
      this.pressed.add(e.key.toLowerCase());
      this.pressed.add(e.code.toLowerCase());
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Minus', 'Equal', 'BracketLeft', 'BracketRight'].includes(
        e.code
      ) ||
      e.key === ' '
    ) {
      e.preventDefault();
    }
    this.addKey(e);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
    this.keys.delete(e.code.toLowerCase());
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') this.usingTouch = true;
    this.pointerDown = true;
    this.queuedClick = true;
    this.syncPointer(e);
    this.canvas.focus();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.pointerType !== 'mouse' || this.usingTouch) {
      e.preventDefault();
      this.bindPointer(e);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId) && !this.pointerDown) return;
    this.syncPointer(e);
    const role = this.pointers.get(e.pointerId);
    if (role === 'stick') this.updateStick(e);
  };

  private onPointerUp = (e: PointerEvent): void => {
    const role = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (role === 'stick') this.clearStick();
    if (role === 'drop') this.dropHeld = false;
    if (role === 'fast') this.fastHeld = false;
    if (role === 'slow') this.slowHeld = false;
    this.pointerDown = this.pointers.size > 0;
    if (!this.pointerDown && !this.stickActive) {
      this.padX = 0;
      this.padY = 0;
    }
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  private bindPointer(e: PointerEvent): void {
    const layout = touchLayout(this.canvas.width, this.canvas.height);
    const p = this.canvasPos(e);
    if (this.hitPad(p, layout.drop)) {
      this.pointers.set(e.pointerId, 'drop');
      this.dropHeld = true;
      return;
    }
    if (this.hitPad(p, layout.fast)) {
      this.pointers.set(e.pointerId, 'fast');
      this.fastHeld = true;
      return;
    }
    if (this.hitPad(p, layout.slow)) {
      this.pointers.set(e.pointerId, 'slow');
      this.slowHeld = true;
      return;
    }
    if (p.x < this.canvas.width * 0.52) {
      this.pointers.set(e.pointerId, 'stick');
      this.stickOriginX = p.x;
      this.stickOriginY = p.y;
      this.stickActive = true;
      this.updateStick(e);
    }
  }

  private canvasPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * this.canvas.height
    };
  }

  private hitPad(p: { x: number; y: number }, pad: TouchPad): boolean {
    return Math.hypot(p.x - pad.x, p.y - pad.y) <= pad.r;
  }

  private updateStick(e: PointerEvent): void {
    const p = this.canvasPos(e);
    const layout = touchLayout(this.canvas.width, this.canvas.height);
    let dx = p.x - this.stickOriginX;
    let dy = p.y - this.stickOriginY;
    const max = layout.stick.r;
    let span = Math.hypot(dx, dy);
    if (span > max * 1.35 && span > 0.001) {
      const pull = span - max;
      this.stickOriginX += (dx / span) * pull;
      this.stickOriginY += (dy / span) * pull;
      dx = p.x - this.stickOriginX;
      dy = p.y - this.stickOriginY;
      span = Math.hypot(dx, dy);
    }
    const clamped = Math.min(1, span / max);
    const dead = 0.14;
    const live = clamped < dead ? 0 : (clamped - dead) / (1 - dead);
    const ux = span > 0.001 ? dx / span : 0;
    const uy = span > 0.001 ? dy / span : 0;
    this.padX = ux * live;
    this.padY = uy * live;
    const vis = Math.min(span, max);
    this.stickKnobX = this.stickOriginX + ux * vis;
    this.stickKnobY = this.stickOriginY + uy * vis;
  }

  private clearStick(): void {
    this.stickActive = false;
    this.padX = 0;
    this.padY = 0;
    const stick = touchLayout(this.canvas.width, this.canvas.height).stick;
    this.stickOriginX = stick.x;
    this.stickOriginY = stick.y;
    this.stickKnobX = stick.x;
    this.stickKnobY = stick.y;
  }

  private syncPointer(e: PointerEvent): void {
    const p = this.canvasPos(e);
    this.pointerX = p.x;
    this.pointerY = p.y;
  }

  private down(...names: string[]): boolean {
    return names.some((name) => this.keys.has(name) || this.pressed.has(name));
  }

  beginFrame(): void {
    const keyDrop = this.down(' ', 'space', 'z', 'j', 'keyz', 'keyj');
    const drop = keyDrop || this.dropHeld;
    this.dropPressed = drop && !this.prevDrop;
    this.dropReleased = !drop && this.prevDrop;
    this.dropDown = drop;
    this.prevDrop = drop;

    this.startPressed = this.down('enter', ' ', 'space') || this.dropPressed;
    this.mutePressed = this.pressed.has('m') || this.pressed.has('keym');
    this.helpPressed = this.pressed.has('h') || this.pressed.has('keyh');
    this.clickPressed = this.queuedClick;
    this.queuedClick = false;
    this.pressed.clear();
  }

  get xAxis(): number {
    let v = this.padX;
    if (this.down('arrowleft', 'a', 'keya')) v -= 1;
    if (this.down('arrowright', 'd', 'keyd')) v += 1;
    return Math.max(-1, Math.min(1, v));
  }

  get yAxis(): number {
    let v = this.padY;
    if (this.down('arrowup', 'w', 'keyw')) v -= 1;
    if (this.down('arrowdown', 's', 'keys')) v += 1;
    return Math.max(-1, Math.min(1, v));
  }

  get throttleDelta(): number {
    let v = 0;
    if (this.down('q', 'keyq', '-', 'minus', '[', 'bracketleft', ',', 'comma')) v -= 1;
    if (this.down('e', 'keye', '=', 'equal', ']', 'bracketright', '.', 'period', '+')) v += 1;
    if (this.fastHeld) v += 1;
    if (this.slowHeld) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }
}
