// Runnable self-check for the money/logic path. `npm test` (tsx) runs this.
import assert from 'node:assert'
import { crosses, rearmed, reachedFireCap, metricValue } from './crossing'

// ── price "above" ──────────────────────────────────────────────────
assert.equal(crosses(99, 101, 100, 'above'), true, 'rises through target -> fire')
assert.equal(crosses(99, 100, 100, 'above'), true, 'exact touch counts as cross')
assert.equal(crosses(101, 102, 100, 'above'), false, 'already above -> no re-fire (anti-spam)')
assert.equal(crosses(101, 99, 100, 'above'), false, 'falling -> no fire for above')

// ── price "below" ──────────────────────────────────────────────────
assert.equal(crosses(101, 99, 100, 'below'), true, 'drops through target -> fire')
assert.equal(crosses(99, 98, 100, 'below'), false, 'already below -> no re-fire')

// ── recurring re-arm ───────────────────────────────────────────────
assert.equal(rearmed(99, 100, 'above'), true, 'above alert re-arms when back below')
assert.equal(rearmed(101, 100, 'above'), false, 'still above -> not re-armed')
assert.equal(rearmed(101, 100, 'below'), true, 'below alert re-arms when back above')

// ── recurring fire cap ─────────────────────────────────────────────
assert.equal(reachedFireCap('one_time', 1, null), true, 'one_time always terminal after its fire')
assert.equal(reachedFireCap('recurring', 1, null), false, 'recurring unlimited never caps')
assert.equal(reachedFireCap('recurring', 1, 3), false, 'recurring 1/3 -> keep going')
assert.equal(reachedFireCap('recurring', 2, 3), false, 'recurring 2/3 -> keep going')
assert.equal(reachedFireCap('recurring', 3, 3), true, 'recurring 3/3 -> stop at cap')
assert.equal(reachedFireCap('recurring', 4, 3), true, 'recurring past cap -> stop')

// ── metric selection ───────────────────────────────────────────────
assert.equal(
  metricValue({ type: 'price', direction: 'above', target: 1 }, 50, 3),
  50,
  'price metric = price',
)
assert.equal(
  metricValue({ type: 'percent', direction: 'above', target: 5, percentBasis: 'h24' }, 50, 3),
  3,
  'h24 metric = ticker 24h change',
)
assert.equal(
  metricValue(
    { type: 'percent', direction: 'above', target: 5, percentBasis: 'since_created', basePrice: 100 },
    110,
    3,
  ),
  10,
  'since_created = (price-base)/base*100',
)

// ── percent crossing end-to-end (since_created, +5% target) ────────
const pct = { type: 'percent' as const, direction: 'above' as const, target: 5, percentBasis: 'since_created' as const, basePrice: 100 }
const prevPct = metricValue(pct, 104, 0) // +4%
const currPct = metricValue(pct, 106, 0) // +6%
assert.equal(crosses(prevPct, currPct, pct.target, pct.direction), true, '+4% -> +6% crosses +5%')

console.log('crossing.test: all assertions passed ✓')
