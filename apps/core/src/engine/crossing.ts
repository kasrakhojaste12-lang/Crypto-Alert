// Pure crossing logic — the anti-spam heart of the matcher. No I/O here so it
// stays trivially testable (see crossing.test.ts).

export type Direction = 'above' | 'below'

export interface AlertLike {
  type: 'price' | 'percent'
  direction: Direction
  target: number
  percentBasis?: 'h24' | 'since_created' | null
  basePrice?: number | null
}

// The value we compare against the target for this alert, given a tick.
export function metricValue(a: AlertLike, price: number, changePct24h: number): number {
  if (a.type === 'price') return price
  if (a.percentBasis === 'h24') return changePct24h
  // since_created
  const base = a.basePrice ?? price
  return ((price - base) / base) * 100
}

// Fire ONLY on a crossing: previous value on one side, current value on/over
// the other. Never fires repeatedly while the value stays past the target.
export function crosses(prev: number, curr: number, target: number, dir: Direction): boolean {
  if (dir === 'above') return prev < target && curr >= target
  return prev > target && curr <= target
}

// A recurring alert re-arms once the value moves back to the opposite side.
export function rearmed(curr: number, target: number, dir: Direction): boolean {
  if (dir === 'above') return curr < target
  return curr > target
}

// Whether an alert should stop permanently after this fire. one_time always
// stops; recurring stops once it has fired maxFires times (null = unlimited).
// `fireCount` is the post-increment count (i.e. how many times it has now fired).
export function reachedFireCap(
  repeat: 'one_time' | 'recurring',
  fireCount: number,
  maxFires: number | null | undefined,
): boolean {
  if (repeat === 'one_time') return true
  return maxFires != null && fireCount >= maxFires
}
