import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/db'
import { log } from '../lib/log'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { getRate } from '../lib/rate'
import { PLANS, isPaidPlan, type PaidPlanId, type PlanId } from '../lib/plans'

const router = Router()

const PERIOD_DAYS = 30

// Prices are denominated in USDT (see lib/plans) and converted to Toman/Rial at
// the live Wallex rate. Zibal charges Rial (= Toman × 10).
function priceFor(plan: PlanId) {
  const { tomanPerUsdt, updatedAt } = getRate()
  const usdt = PLANS[plan].priceUsdt
  const toman = Math.round(usdt * tomanPerUsdt)
  return { plan, usdt, tomanPerUsdt, toman, rial: toman * 10, updatedAt }
}

// Public, and kept in its original single-price shape (= Pro) so older clients
// don't break. New UI reads /plans instead.
router.get('/price', (_req, res) => res.json(priceFor('pro')))

// Public: everything the pricing page needs — prices and entitlements together,
// so the cards can never advertise a limit the API doesn't actually enforce.
router.get('/plans', (_req, res) => {
  const { tomanPerUsdt, updatedAt } = getRate()
  res.json({
    tomanPerUsdt,
    updatedAt,
    periodDays: PERIOD_DAYS,
    plans: (['free', 'pro', 'gold'] as const).map((id) => {
      const { rial, toman } = priceFor(id)
      return { ...PLANS[id], toman, rial }
    }),
  })
})

const BRIDGE = process.env.BRIDGE_BASE_URL || 'http://localhost:4100'
const WEB = process.env.WEB_BASE_URL || 'http://localhost:3000'
const BRIDGE_SECRET = process.env.BRIDGE_SHARED_SECRET || 'bridge-secret'
const PLAN_LABEL_FA: Record<PaidPlanId, string> = { pro: 'پرو', gold: 'طلایی' }

// 1) Create a pending subscription for the requested plan and hand back a signed
//    redirect to the Iran-side bridge (the core never talks to Zibal directly).
router.post('/checkout', requireAuth, async (req: AuthedRequest, res) => {
  // Default to Pro so a client that predates tiers still checks out.
  const plan: PaidPlanId = req.body?.plan == null ? 'pro' : isPaidPlan(req.body.plan) ? req.body.plan : 'invalid' as never
  if (!isPaidPlan(plan)) return res.status(400).json({ error: 'invalid_plan' })

  const { rial } = priceFor(plan)
  const orderId = crypto.randomUUID()
  // The plan is recorded on the pending subscription, so confirmation can't
  // activate a different tier than the amount that was charged.
  await prisma.subscription.create({
    data: { userId: req.userId!, plan, amount: rial, status: 'pending', zibalOrderId: orderId },
  })
  const token = jwt.sign(
    {
      orderId,
      amount: rial,
      returnUrl: `${WEB}/billing/result`,
      description: `اشتراک الرت کی — ${PLAN_LABEL_FA[plan]}`,
    },
    BRIDGE_SECRET,
    { expiresIn: '30m' },
  )
  res.json({ redirectUrl: `${BRIDGE}/pay?token=${token}`, amount: rial, plan })
})

// 2) The bridge calls this (HMAC-signed) after verifying payment with Zibal.
router.post('/zibal/confirm', async (req, res) => {
  const { orderId, trackId, verified } = req.body ?? {}
  const sig = req.header('x-bridge-signature')
  const expected = crypto
    .createHmac('sha256', BRIDGE_SECRET)
    .update(`${orderId}:${trackId}:${verified}`)
    .digest('hex')
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return res.status(401).json({ error: 'bad_signature' })

  const sub = await prisma.subscription.findUnique({ where: { zibalOrderId: orderId } })
  if (!sub) return res.status(404).json({ error: 'order_not_found' })
  if (sub.status === 'active') return res.json({ ok: true }) // idempotent

  if (!verified) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired', zibalTrackId: String(trackId) },
    })
    return res.json({ ok: false })
  }

  const start = new Date()
  const end = new Date(Date.now() + PERIOD_DAYS * 86400_000)
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'active', periodStart: start, periodEnd: end, zibalTrackId: String(trackId) },
    }),
    // The tier lives on the subscription; User.plan stays a coarse legacy flag.
    prisma.user.update({ where: { id: sub.userId }, data: { plan: 'paid' } }),
  ])
  log.info({ user: sub.userId, orderId, plan: sub.plan }, 'subscription activated')
  res.json({ ok: true })
})

export default router
