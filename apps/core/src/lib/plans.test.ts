import assert from 'node:assert'
import {
  PLANS,
  TIMEFRAMES,
  checkAlertAgainstPlan,
  clampMaxFires,
  isPaidPlan,
  nextPlanFor,
  normalizePlan,
} from './plans'

// Legacy rows: 'paid' is what every launch-campaign subscription carries.
assert.equal(normalizePlan('paid'), 'gold', 'campaign accounts keep the top tier')
assert.equal(normalizePlan('gold'), 'gold')
assert.equal(normalizePlan('pro'), 'pro')
assert.equal(normalizePlan(null), 'free')
assert.equal(normalizePlan('nonsense'), 'free', 'unknown plan strings must not grant anything')

assert.deepEqual([nextPlanFor('free'), nextPlanFor('pro'), nextPlanFor('gold')], ['pro', 'gold', null])
assert.ok(isPaidPlan('gold') && isPaidPlan('pro'))
assert.ok(!isPaidPlan('free') && !isPaidPlan('paid') && !isPaidPlan(undefined))

// Entitlements must never shrink as you pay more.
const tiers = [PLANS.free, PLANS.pro, PLANS.gold]
for (let i = 1; i < tiers.length; i++) {
  const lower = tiers[i - 1], higher = tiers[i]
  assert.ok(higher.alertLimit > lower.alertLimit, `${higher.id} must allow more alerts than ${lower.id}`)
  assert.ok(higher.maxFiresPerAlert >= lower.maxFiresPerAlert)
  assert.ok(higher.priceUsdt > lower.priceUsdt)
  for (const type of lower.alertTypes) assert.ok(higher.alertTypes.includes(type))
  for (const tf of lower.timeframes) assert.ok(higher.timeframes.includes(tf))
  for (const ch of lower.channels) assert.ok(higher.channels.includes(ch))
}
assert.deepEqual(PLANS.gold.timeframes, [...TIMEFRAMES], 'gold unlocks every timeframe')

// SMS is advertised but undeliverable: it may only ever appear as coming soon.
for (const plan of tiers)
  assert.ok(!plan.channels.includes('sms' as never), `${plan.id} must not accept sms yet`)
assert.deepEqual(PLANS.gold.comingSoon, ['sms'])

const priceAlert = { type: 'price', repeat: 'one_time', channels: [{ type: 'telegram' }] } as const
assert.equal(checkAlertAgainstPlan('free', priceAlert), null, 'the free plan still works out of the box')
assert.equal(checkAlertAgainstPlan('free', { ...priceAlert, channels: [{ type: 'email' }] }), null)

assert.deepEqual(
  checkAlertAgainstPlan('free', { ...priceAlert, type: 'candle_close', timeframe: '1h' }),
  { feature: 'candle_close' },
)
assert.deepEqual(checkAlertAgainstPlan('free', { ...priceAlert, type: 'percent' }), { feature: 'percent' })
assert.deepEqual(checkAlertAgainstPlan('free', { ...priceAlert, repeat: 'recurring' }), { feature: 'recurring' })
assert.deepEqual(
  checkAlertAgainstPlan('free', { ...priceAlert, channels: [{ type: 'discord' }] }),
  { feature: 'channel', detail: 'discord' },
)
assert.deepEqual(
  checkAlertAgainstPlan('free', { ...priceAlert, channels: [{ type: 'telegram' }, { type: 'email' }] }),
  { feature: 'channelsPerAlert', detail: '1' },
  'one channel per alert on free',
)

// The gold-only timeframes are the main upgrade lever; keep them enforced.
assert.deepEqual(
  checkAlertAgainstPlan('pro', { ...priceAlert, type: 'candle_close', timeframe: '5m' }),
  { feature: 'timeframe', detail: '5m' },
)
assert.equal(checkAlertAgainstPlan('pro', { ...priceAlert, type: 'candle_close', timeframe: '1h' }), null)
assert.equal(checkAlertAgainstPlan('gold', { ...priceAlert, type: 'candle_close', timeframe: '1m' }), null)
assert.equal(
  checkAlertAgainstPlan('gold', {
    ...priceAlert,
    repeat: 'recurring',
    channels: [{ type: 'telegram' }, { type: 'email' }, { type: 'discord' }],
  }),
  null,
)
assert.deepEqual(
  checkAlertAgainstPlan('gold', { ...priceAlert, channels: [{ type: 'sms' }] }),
  { feature: 'channel', detail: 'sms' },
  'sms is not accepted even on gold until the worker can send it',
)

// A blank repeat count means "whatever my plan allows", never unlimited.
assert.equal(clampMaxFires('free', null), 1)
assert.equal(clampMaxFires('pro', null), 3)
assert.equal(clampMaxFires('gold', null), 10)
assert.equal(clampMaxFires('gold', 4), 4, 'gold chooses its own repeat count')
assert.equal(clampMaxFires('gold', 999), 10, 'clamped to the anti-spam ceiling')
assert.equal(clampMaxFires('pro', 7), 3)
assert.equal(clampMaxFires('gold', 0), 1)
assert.equal(clampMaxFires('gold', 2.7), 2)

console.log('plans.test: all assertions passed ✓')
