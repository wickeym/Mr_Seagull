export function randomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

export function pickOne<T>(items: readonly T[]): T {
  const index = randomInt(0, items.length - 1);
  return items[index];
}
