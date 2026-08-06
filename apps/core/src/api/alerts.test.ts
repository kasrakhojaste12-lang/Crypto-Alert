import assert from 'node:assert'
import { prisma } from '../lib/db'
import { engine } from '../engine/match'
import { patchAlert, resetAlert, triggeredLast } from './alerts'

const delegate = prisma.alert as any
const subscriptions = prisma.subscription as any
const client = prisma as any
const original = {
  findFirst: delegate.findFirst,
  update: delegate.update,
  updateMany: delegate.updateMany,
  findUniqueOrThrow: delegate.findUniqueOrThrow,
  count: delegate.count,
  subscriptionFindFirst: subscriptions.findFirst,
  transaction: client.$transaction,
  queryRaw: client.$queryRaw,
}

client.$transaction = async (fn: (tx: any) => unknown) => fn(client)
client.$queryRaw = async () => []

const base = {
  id: 'reset-1',
  userId: 'user-1',
  symbol: 'RESETUSDT',
  market: 'spot',
  type: 'price',
  direction: 'above',
  target: 100,
  percentBasis: null,
  basePrice: null,
  timeframe: null,
  repeat: 'one_time',
  maxFires: null,
  status: 'triggered',
  channels: [],
  fireCount: 3,
  cycleFireCount: 1,
  lastFiredAt: new Date('2026-07-12T00:00:00Z'),
  createdAt: new Date('2026-07-01T00:00:00Z'),
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: any) {
      this.body = body
      return this
    },
  }
}

// `plan` is the subscription row's plan string; null = no active subscription.
async function callReset(alert: any, count = 0, plan: string | null = null) {
  let updateData: any
  delegate.findFirst = async () => alert
  delegate.count = async () => count
  subscriptions.findFirst = async () => (plan ? { plan } : null)
  delegate.updateMany = async ({ data }: any) => {
    updateData = data
    return { count: alert.status === 'triggered' ? 1 : 0 }
  }
  delegate.findUniqueOrThrow = async () => ({ ...alert, ...updateData })

  const response = makeResponse()
  await resetAlert({ params: { id: alert.id }, userId: alert.userId } as any, response as any)
  return { response, updateData }
}

const ordered = triggeredLast([
  { id: 'new-live', status: 'paused' },
  { id: 'new-done', status: 'triggered' },
  { id: 'old-live', status: 'active' },
  { id: 'old-done', status: 'triggered' },
])
assert.deepEqual(ordered.map((a) => a.id), ['new-live', 'old-live', 'new-done', 'old-done'])

engine.onTick(base.symbol, 150, 0)
const reset = await callReset(base)
assert.equal(reset.response.statusCode, 200)
assert.deepEqual(reset.updateData, { status: 'active', cycleFireCount: 0 })
assert.equal(reset.response.body.fireCount, 3, 'total fire history is retained')
assert.equal(reset.response.body.cycleFireCount, 0, 'reset starts a fresh cycle')
assert.equal(reset.response.body.lastFiredAt.toISOString(), base.lastFiredAt.toISOString())
assert.ok(engine.watchedSymbols().includes(base.symbol), 'already-met reset stays armed instead of firing immediately')
engine.onTick(base.symbol, 151, 0)
assert.ok(engine.watchedSymbols().includes(base.symbol), 'same-side tick after reset does not re-fire')
engine.remove(base.id)

const conflict = await callReset({ ...base, status: 'active' })
assert.equal(conflict.response.statusCode, 409)
assert.equal(conflict.response.body.error, 'alert_not_triggered')

// Each tier stops at its own ceiling, and only gold — with nothing left to
// upgrade to — is told to delete an alert instead of to upgrade.
const freeLimit = await callReset(base, 5)
assert.equal(freeLimit.response.statusCode, 402)
assert.deepEqual(freeLimit.response.body, {
  error: 'upgrade_required',
  limit: 5,
  plan: 'free',
  nextPlan: 'pro',
})
const proLimit = await callReset(base, 20, 'pro')
assert.equal(proLimit.response.statusCode, 402)
assert.deepEqual(proLimit.response.body, {
  error: 'upgrade_required',
  limit: 20,
  plan: 'pro',
  nextPlan: 'gold',
})
assert.equal((await callReset(base, 19, 'pro')).response.statusCode, 200, 'below the cap the reset goes through')
const goldLimit = await callReset(base, 100, 'gold')
assert.equal(goldLimit.response.statusCode, 402)
assert.deepEqual(goldLimit.response.body, { error: 'limit_reached', limit: 100, plan: 'gold' })
// Launch-campaign subscriptions predate tiers and say 'paid'.
const legacyLimit = await callReset(base, 100, 'paid')
assert.deepEqual(legacyLimit.response.body, { error: 'limit_reached', limit: 100, plan: 'gold' })
assert.equal((await callReset(base, 30, 'paid')).response.statusCode, 200, 'legacy paid users get the gold ceiling')

delegate.findFirst = async () => base
for (const status of ['paused', 'active']) {
  const response = makeResponse()
  await patchAlert({ params: { id: base.id }, userId: base.userId, body: { status } } as any, response as any)
  assert.equal(response.statusCode, 409, `triggered -> ${status} must use the safe reset path`)
  assert.equal(response.body.error, 'reset_required')
}

delegate.findFirst = async () => ({ ...base, status: 'active' })
delegate.updateMany = async () => ({ count: 0 }) // terminal fire won the race
const patchRace = makeResponse()
await patchAlert(
  { params: { id: base.id }, userId: base.userId, body: { status: 'paused' } } as any,
  patchRace as any,
)
assert.equal(patchRace.statusCode, 409, 'PATCH cannot overwrite a concurrently-triggered alert')
assert.equal(patchRace.body.error, 'reset_required')

const fireWrites: any[] = []
delegate.update = async ({ data }: any) => {
  if (data.fireCount != null) fireWrites.push(data)
  return data
}
engine.upsert({
  ...base,
  id: 'cycle-1',
  symbol: 'CYCLEUSDT',
  type: 'candle_close',
  timeframe: '1m',
  repeat: 'recurring',
  maxFires: 2,
  status: 'active',
  fireCount: 5,
  cycleFireCount: 0,
})
engine.onCandleClose('CYCLEUSDT', '1m', 101)
engine.onCandleClose('CYCLEUSDT', '1m', 99)
engine.onCandleClose('CYCLEUSDT', '1m', 101)
await new Promise((resolve) => setImmediate(resolve))
assert.deepEqual(fireWrites.map((w) => w.fireCount), [6, 7], 'notification sequence remains monotonic across reset')
assert.deepEqual(fireWrites.map((w) => w.cycleFireCount), [1, 2], 'recurring cap uses the fresh cycle')
assert.equal(fireWrites.at(-1).status, 'triggered', 'recurring alert stops at its per-cycle cap')

delegate.findFirst = original.findFirst
delegate.update = original.update
delegate.updateMany = original.updateMany
delegate.findUniqueOrThrow = original.findUniqueOrThrow
delegate.count = original.count
subscriptions.findFirst = original.subscriptionFindFirst
client.$transaction = original.transaction
client.$queryRaw = original.queryRaw

console.log('alerts.test: all assertions passed ✓')
process.exit(0)
