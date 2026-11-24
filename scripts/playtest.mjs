import { createInterface } from 'node:readline';
import { createServer } from 'vite';

const HELP = [
  'Enter frames and held keys, e.g. 15 d or 1 j, 45.',
  'One frame is 1/60 second. WASD moves, Q/E changes speed, J drops on release.',
  'Hold J for 23 frames or more with 2 ammo for a jumbo. Omit keys to release them.',
  'Separate steps with commas. Blank line redraws. restart [seed], help, quit.'
].join('\n');
const SYMBOLS = { car: 'C', tourist: 'T', sunbather: 'B', jogger: 'R', kid: 'K', slinger: 'S' };
const number = (value) => value.toFixed(1);
const signed = (value) => (value >= 0 ? '+' : '') + number(value);

function render(state, events) {
  const { x, alt, aim } = state;
  const grid = [];
  for (let dz = 90; dz >= -10; dz -= 5) {
    grid.push(Array.from({ length: 33 }, (_, col) => {
      const wx = (col - 16) * 4;
      return Math.abs(wx) === 24 ? '|' : wx === 0 ? ':' : Math.abs(wx) < 24 ? ' ' : '.';
    }));
  }
  const contacts = [
    ...state.targets.map((t) => ({
      ...t, symbol: t.rampage ? '!' : SYMBOLS[t.kind],
      label: t.rampage ? 'swerving car' : t.aiming ? 'slinger aiming' : t.kind
    })),
    ...state.umbrellas.map((t) => ({ ...t, symbol: 'U', label: 'umbrella' })),
    ...state.fries.map((t) => ({ ...t, symbol: 'F', label: 'fries' })),
    ...state.stones.map((t) => ({ ...t, symbol: '*', label: 'stone' })),
    ...state.drops.map((t) => ({ ...t, symbol: 'o', label: t.fat ? 'jumbo drop' : 'drop' }))
  ].filter((t) => t.dz >= -10 && t.dz <= 90).sort((a, b) => a.dz - b.dz);

  function mark(wx, dz, symbol) {
    const row = grid[Math.round((90 - dz) / 5)];
    const col = Math.round(wx / 4) + 16;
    if (row && col >= 0 && col < row.length) row[col] = symbol;
  }

  for (const t of contacts) mark(t.x, t.dz, t.symbol);
  mark(aim.x, aim.dz, '+');
  mark(x, 0, '@');
  console.log([
    `${state.scene.toUpperCase()}  Score ${state.score}  Lives ${state.lives}  Ammo ${state.ammo}  Combo ${state.combo} (best ${state.bestCombo})  Hits ${state.hits}`,
    `Distance ${number(state.distance)}  Speed ${number(state.speed)}  X ${signed(x)}  Alt ${number(alt)}  Wind ${signed(state.wind)}`,
    `Aim + at x ${signed(aim.x)}, ${number(aim.dz)} ahead  Fall ${aim.fall.toFixed(2)}s  Charge ${Math.round(state.charge * 100)}%  Cooldown ${state.cooldown.toFixed(2)}s`,
    ...(aim.target ? [`RELEASE WINDOW: ${aim.target}`] : []),
    ...(state.closeUp ? [`SLOW-MOTION CLOSE-UP: ${state.closeUp}`] : []),
    ...Object.entries(state.flight).filter(([, status]) => status).map(([object, status]) => `${object}: ${status}`),
    ...grid.map((row, i) => `${String(90 - i * 5).padStart(3)} ${row.join('')}`),
    '@ gull  + aim  | road edges  . beach  C car  ! swerving car',
    'B sunbather  T tourist  R jogger  K kid  S slinger  U umbrella  F fries  * stone  o drop',
    ...contacts.filter((t) => t.dz <= 60).map((t) => {
      const altitude = t.y === undefined ? '' : `  alt ${number(t.y)}`;
      const velocity = t.vz === undefined ? '' : `  vx/vz ${signed(t.vx)}/${signed(t.vz)}`;
      return `${t.symbol} ${t.label.padEnd(15)} x ${signed(t.x).padStart(5)}  ahead ${signed(t.dz).padStart(5)}${altitude}${velocity}`;
    }),
    ...events
  ].join('\n'));
}

function parseStep(step) {
  const match = /^(\d+)(?:\s+([wasdqej]+))?$/i.exec(step.trim());
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 3600) {
    throw new Error('Use 1–3600 frames per step and optional keys from WASDQEJ.');
  }
  return { frames: Number(match[1]), keys: match[2]?.toLowerCase() ?? '' };
}

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false, watch: null }
});
const originalRandom = Math.random;
try {
  const { Game } = await server.ssrLoadModule('/src/game.ts');
  const { Input } = await server.ssrLoadModule('/src/input.ts');
  const input = new Input(null);
  let game;
  const stdin = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let seed = Date.now() >>> 0;

  function restart() {
    // Seed this standalone process so a run is reproducible with the same commands.
    let state = seed;
    Math.random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    input.keys.clear();
    input.beginFrame();
    game = new Game(null, input);
    game.startRun();
    console.log(`Seed ${seed}`);
  }

  console.log(HELP);
  restart();
  render(game.playtest, []);
  for await (const line of stdin) {
    const command = line.trim().toLowerCase();
    if (command === 'quit') break;
    if (command === 'help') {
      console.log(HELP);
      continue;
    }
    const reset = /^restart(?:\s+(\d{1,10}))?$/.exec(command);
    if (reset) {
      if (reset[1] !== undefined) seed = Number(reset[1]) >>> 0;
      restart();
      render(game.playtest, []);
      continue;
    }
    let steps;
    try {
      steps = command ? command.split(',').map(parseStep) : [];
    } catch (error) {
      console.log(error.message);
      continue;
    }
    const events = [];
    let previous = game.playtestFeedback;
    for (const { frames, keys } of steps) {
      input.keys.clear();
      for (const key of keys) input.keys.add(key);
      for (let i = 0; i < frames && game.scene === 'play'; i++) {
        game.update(1 / 60);
        const current = game.playtestFeedback;
        const labels = current.filter((label) => !previous.includes(label));
        if (labels.length) events.push(`At ${number(game.playtest.distance)}m: ${labels.join(' · ')}`);
        previous = current;
      }
    }
    render(game.playtest, events);
  }
  stdin.close();
} finally {
  Math.random = originalRandom;
  await server.close();
}
