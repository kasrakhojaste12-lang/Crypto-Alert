import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { engine } from '../engine/match'
import { FREE_ALERT_LIMIT, PAID_ALERT_LIMIT, activeAlertCount, hasActiveSubscription } from '../lib/limits'
import { isDiscordWebhook } from '../dispatch/discord'

const router = Router()
router.use(requireAuth)

const channelInput = z.object({
  type: z.enum(['telegram', 'discord']), // email: temporarily removed, re-add later
  identifier: z.string().optional(), // resolved server-side for telegram
})

const alertInput = z
  .object({
    symbol: z.string().min(3).transform((s) => s.toUpperCase()),
    type: z.enum(['price', 'percent']),
    direction: z.enum(['above', 'below']),
    target: z.number(),
    percentBasis: z.enum(['h24', 'since_created']).nullish(),
    repeat: z.enum(['one_time', 'recurring']).default('one_time'),
    channels: z.array(channelInput).min(1),
  })
  .refine((d) => d.type !== 'percent' || !!d.percentBasis, {
    message: 'percentBasis required for percent alerts',
  })

const patchInput = z.object({
  status: z.enum(['active', 'paused']).optional(),
  target: z.number().optional(),
})

function serialize(a: any) {
  return { ...a, target: Number(a.target), basePrice: a.basePrice == null ? null : Number(a.basePrice) }
}

const REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
// Validates a symbol and returns its price. 'invalid' = Binance rejects it (400);
// 'unknown' = transient network/unknown (don't block creation on a blip).
async function probeSymbol(symbol: string): Promise<{ status: 'ok' | 'invalid' | 'unknown'; price: number | null }> {
  try {
    const r = await fetch(`${REST}/api/v3/ticker/price?symbol=${symbol}`)
    if (r.status === 400) return { status: 'invalid', price: null }
    if (!r.ok) return { status: 'unknown', price: null }
    return { status: 'ok', price: Number((await r.json()).price) }
  } catch {
    return { status: 'unknown', price: null }
  }
}

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

async function resolveChannels(user: { telegramChatId: string | null }, channels: z.infer<typeof channelInput>[]) {
  return channels.map((c) => {
    if (c.type === 'telegram') {
      if (!user.telegramChatId) throw new HttpError(400, 'telegram_not_linked')
      return { type: 'telegram', identifier: user.telegramChatId }
    }
    // discord
    if (!c.identifier || !isDiscordWebhook(c.identifier)) throw new HttpError(400, 'invalid_discord_webhook')
    return { type: 'discord', identifier: c.identifier }
  })
}

router.get('/', async (req: AuthedRequest, res) => {
  const alerts = await prisma.alert.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } })
  res.json(alerts.map(serialize))
})

router.post('/', async (req: AuthedRequest, res) => {
  const p = alertInput.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input', details: p.error.issues })

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // Alert-count guard: free = 3, paid = 30. Paid users at the cap get a distinct
  // code so the UI shows "limit reached" instead of an upgrade prompt.
  const count = await activeAlertCount(user.id)
  const paid = await hasActiveSubscription(user.id)
  const limit = paid ? PAID_ALERT_LIMIT : FREE_ALERT_LIMIT
  if (count >= limit)
    return res.status(402).json({ error: paid ? 'limit_reached' : 'upgrade_required', limit })

  let channels
  try {
    channels = await resolveChannels(user, p.data.channels)
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.code })
    throw e
  }

  // Current price doubles as symbol validation + base price. In WS mode the
  // engine already has it (no extra call); in REST mode a new symbol is probed.
  let currentPrice = engine.lastPrice(p.data.symbol)
  if (currentPrice == null) {
    const probe = await probeSymbol(p.data.symbol)
    if (probe.status === 'invalid') return res.status(400).json({ error: 'unknown_symbol' })
    currentPrice = probe.price
  }

  let basePrice: number | null = null
  if (p.data.type === 'percent' && p.data.percentBasis === 'since_created') {
    if (currentPrice == null) return res.status(400).json({ error: 'no_price_yet' })
    basePrice = currentPrice
  }

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      symbol: p.data.symbol,
      type: p.data.type,
      direction: p.data.direction,
      target: p.data.target,
      percentBasis: p.data.percentBasis ?? null,
      basePrice,
      repeat: p.data.repeat,
      status: 'active',
      channels,
    },
  })
  engine.upsert(alert)
  res.json(serialize(alert))
})

router.patch('/:id', async (req: AuthedRequest, res) => {
  const a = await prisma.alert.findFirst({ where: { id: req.params.id, userId: req.userId } })
  if (!a) return res.status(404).json({ error: 'not_found' })
  const p = patchInput.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })

  const data: any = {}
  if (p.data.target !== undefined) data.target = p.data.target
  if (p.data.status) data.status = p.data.status
  const updated = await prisma.alert.update({ where: { id: a.id }, data })

  if (updated.status === 'active') engine.upsert(updated)
  else engine.remove(updated.id, updated.symbol)
  res.json(serialize(updated))
})

router.delete('/:id', async (req: AuthedRequest, res) => {
  const a = await prisma.alert.findFirst({ where: { id: req.params.id, userId: req.userId } })
  if (!a) return res.status(404).json({ error: 'not_found' })
  await prisma.alert.delete({ where: { id: a.id } })
  engine.remove(a.id, a.symbol)
  res.json({ ok: true })
})

export default router
