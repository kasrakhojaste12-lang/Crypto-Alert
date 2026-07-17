import assert from 'node:assert'
import { prisma } from '../lib/db'
import { requireAdmin, stats } from './admin'

const users = prisma.user as any
const alerts = prisma.alert as any
const subscriptions = prisma.subscription as any
const notifications = prisma.notification as any

function makeResponse() {
  return {
    statusCode: 0,
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

// --- requireAdmin gate (security path) ---------------------------------------

async function gate(dbEmail: string | null, adminEmails: string | undefined) {
  if (adminEmails === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = adminEmails
  users.findUnique = async () => (dbEmail ? { email: dbEmail } : null)
  const res = makeResponse()
  let passed = false
  await requireAdmin({ userId: 'u1' } as any, res as any, () => {
    passed = true
  })
  return { passed, status: res.statusCode, body: res.body }
}

// Unset/empty ADMIN_EMAILS must lock everyone out, not let everyone in.
let r = await gate('me@example.com', undefined)
assert.equal(r.passed, false)
assert.equal(r.status, 403)
assert.deepEqual(r.body, { error: 'forbidden' })

r = await gate('me@example.com', '')
assert.equal(r.passed, false)
assert.equal(r.status, 403)

r = await gate('me@example.com', '   ,  ,')
assert.equal(r.passed, false, 'a list of only separators/blanks grants nobody')

// Non-listed user is rejected.
r = await gate('someone@example.com', 'me@example.com')
assert.equal(r.passed, false)
assert.equal(r.status, 403)

// A near-miss must not pass (no substring/prefix matching).
r = await gate('me@example.com.evil.com', 'me@example.com')
assert.equal(r.passed, false)

// Listed user passes.
r = await gate('me@example.com', 'me@example.com')
assert.equal(r.passed, true)
assert.equal(r.status, 0, 'no response written when the gate passes')

// Matching is case-insensitive and tolerant of list whitespace, both sides.
r = await gate('Me@Example.COM', ' other@x.com , me@example.com ')
assert.equal(r.passed, true)

// Deleted/unknown user id with a still-valid cookie is rejected.
r = await gate(null, 'me@example.com')
assert.equal(r.passed, false)
assert.equal(r.status, 403)

// --- stats payload ------------------------------------------------------------

let countCall = 0
// Promise.all preserves call order: total, new24h, new7d, new30d, telegramLinked, premium
users.count = async () => [10, 1, 3, 7, 4, 2][countCall++]
users.findMany = async () => [
  { id: 'u1', email: 'a@b.com', plan: 'paid', createdAt: new Date('2026-07-01') },
]

let groupCall = 0
// Call order in stats(): byStatus, byType, byMarket, topSymbols.
alerts.groupBy = async () =>
  [
    [
      { status: 'active', _count: { _all: 5 } },
      { status: 'triggered', _count: { _all: 2 } },
    ],
    [{ type: 'price', _count: { _all: 6 } }],
    [
      { market: 'spot', _count: { _all: 5 } },
      { market: 'futures', _count: { _all: 2 } },
    ],
    [{ symbol: 'BTCUSDT', _count: { _all: 3 } }],
  ][groupCall++]

subscriptions.count = async () => 2
let aggCall = 0
// Second aggregate returns a null sum — Prisma does that when nothing matches.
subscriptions.aggregate = async () => [{ _sum: { amount: 500_000 } }, { _sum: { amount: null } }][aggCall++]

notifications.groupBy = async () => [
  { status: 'sent', _count: { _all: 9 } },
  { status: 'failed', _count: { _all: 1 } },
]
notifications.count = async () => 12

const res = makeResponse()
await stats({ userId: 'u1' } as any, res as any)
const b = res.body

assert.deepEqual(b.users, { total: 10, new24h: 1, new7d: 3, new30d: 7, telegramLinked: 4, premium: 2 })
assert.deepEqual(b.alerts.byStatus, { active: 5, triggered: 2 })
assert.deepEqual(b.alerts.byType, { price: 6 })
assert.deepEqual(b.alerts.topSymbols, [{ symbol: 'BTCUSDT', count: 3 }])
assert.deepEqual(b.alerts.byMarket, { spot: 5, futures: 2 })
assert.deepEqual(b.subscriptions, { active: 2, revenueRial: 500_000, revenue30dRial: 0 })
assert.deepEqual(b.notifications, { last24h: { sent: 9, failed: 1 }, total: 12 })
assert.equal(b.recentUsers.length, 1)
assert.equal(b.recentUsers[0].email, 'a@b.com')
// Never leak password hashes through the admin panel.
assert.ok(!('passwordHash' in b.recentUsers[0]))

// --- byMarket degrades, never 500s, when the client lacks Alert.market --------
// Split-brain window: admin deployed before the futures migration lands, so the
// generated client rejects `market`. The .catch must swallow it and the rest of
// the panel must still render.
let g2 = 0
alerts.groupBy = async () => {
  const call = g2++
  if (call === 2) throw new Error('Unknown field `market` for select statement') // the market groupBy
  return [
    [{ status: 'active', _count: { _all: 5 } }],
    [{ type: 'price', _count: { _all: 6 } }],
    undefined, // market slot — thrown above
    [{ symbol: 'BTCUSDT', _count: { _all: 3 } }],
  ][call]
}
countCall = 0
aggCall = 0
const degraded = makeResponse()
await stats({ userId: 'u1' } as any, degraded as any)
assert.deepEqual(degraded.body.alerts.byMarket, {}, 'market breakdown degrades to empty when the column is unknown')
assert.deepEqual(degraded.body.alerts.byStatus, { active: 5 }, 'other breakdowns are unaffected by the market failure')
assert.equal(degraded.statusCode, 0, 'stats still responds 200, never 500, when market is unavailable')

console.log('admin: all assertions passed ✓')
process.exit(0)
