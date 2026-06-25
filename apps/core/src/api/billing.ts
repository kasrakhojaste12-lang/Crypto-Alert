import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/db'
import { log } from '../lib/log'
import { requireAuth, type AuthedRequest } from '../lib/auth'

const router = Router()

const PRICE_RIAL = Number(process.env.SUB_PRICE_RIAL || 500000)
const PERIOD_DAYS = 30
const BRIDGE = process.env.BRIDGE_BASE_URL || 'http://localhost:4100'
const WEB = process.env.WEB_BASE_URL || 'http://localhost:3000'
const BRIDGE_SECRET = process.env.BRIDGE_SHARED_SECRET || 'bridge-secret'

// 1) Create a pending subscription and hand back a signed redirect to the
//    Iran-side bridge (the core never talks to Zibal directly).
router.post('/checkout', requireAuth, async (req: AuthedRequest, res) => {
  const orderId = crypto.randomUUID()
  await prisma.subscription.create({
    data: { userId: req.userId!, amount: PRICE_RIAL, status: 'pending', zibalOrderId: orderId },
  })
  const token = jwt.sign(
    { orderId, amount: PRICE_RIAL, returnUrl: `${WEB}/billing/result` },
    BRIDGE_SECRET,
    { expiresIn: '30m' },
  )
  res.json({ redirectUrl: `${BRIDGE}/pay?token=${token}`, amount: PRICE_RIAL })
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
    prisma.user.update({ where: { id: sub.userId }, data: { plan: 'paid' } }),
  ])
  log.info({ user: sub.userId, orderId }, 'subscription activated')
  res.json({ ok: true })
})

export default router
