import { Router, type Response } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { engine, type Market } from '../engine/match'
import {
  FREE_ALERT_LIMIT,
  PAID_ALERT_LIMIT,
  activeAlertCount,
  hasActiveSubscription,
  type LimitDb,
} from '../lib/limits'
import { isDiscordWebhook } from '../dispatch/discord'

const router = Router()
router.use(requireAuth)

const channelInput = z.object({
  type: z.enum(['telegram', 'discord', 'email']),
  identifier: z.string().optional(), // resolved server-side for telegram and email
})

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

const alertInput = z
  .object({
    symbol: z.string().trim().min(3).regex(/^[a-z0-9]+$/i).transform((s) => s.toUpperCase()),
    market: z.enum(['spot', 'futures']).default('spot'),
    type: z.enum(['price', 'percent', 'candle_close']),
    direction: z.enum(['above', 'below']),
    target: z.number(),
    percentBasis: z.enum(['h24', 'since_created']).nullish(),
    timeframe: z.enum(TIMEFRAMES).nullish(), // candle_close only
    repeat: z.enum(['one_time', 'recurring']).default('one_time'),
    maxFires: z.number().int().positive().max(1000).nullish(), // recurring only; null = unlimited
    channels: z.array(channelInput).min(1),
  })
  .refine((d) => d.type !== 'percent' || !!d.percentBasis, {
    message: 'percentBasis required for percent alerts',
  })
  .refine((d) => d.type !== 'candle_close' || !!d.timeframe, {
    message: 'timeframe required for candle_close alerts',
  })

const patchInput = z.object({
  status: z.enum(['active', 'paused']).optional(),
  target: z.number().optional(),
})

function serialize(a: any) {
  return { ...a, target: Number(a.target), basePrice: a.basePrice == null ? null : Number(a.basePrice) }
}

const SPOT_REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const FUTURES_REST = process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com'
// Validates a symbol and returns its price. 'invalid' = Binance rejects it (400);
// 'unknown' = transient network/unknown (don't block creation on a blip).
async function probeSymbol(
  symbol: string,
  market: Market,
): Promise<{ status: 'ok' | 'invalid' | 'unknown'; price: number | null }> {
  try {
    const path = market === 'futures' ? '/fapi/v1/ticker/price' : '/api/v3/ticker/price'
    const r = await fetch(
      `${market === 'futures' ? FUTURES_REST : SPOT_REST}${path}?symbol=${encodeURIComponent(symbol)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (r.status === 400) return { status: 'invalid', price: null }
    if (!r.ok) return { status: 'unknown', price: null }
    return { status: 'ok', price: Number((await r.json()).price) }
  } catch {
    return { status: 'unknown', price: null }
  }
}

async function alertLimitError(userId: string, db?: LimitDb) {
  const [count, paid] = await Promise.all([
    activeAlertCount(userId, db),
    hasActiveSubscription(userId, db),
  ])
  const limit = paid ? PAID_ALERT_LIMIT : FREE_ALERT_LIMIT
  return count >= limit ? { error: paid ? 'limit_reached' : 'upgrade_required', limit } : null
}

async function lockAlertSlots(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
}

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: Record<string, unknown> = {},
  ) {
    super(code)
  }
}

async function resolveChannels(
  user: { telegramChatId: string | null; email: string },
  channels: z.infer<typeof channelInput>[],
) {
  return channels.map((c) => {
    if (c.type === 'telegram') {
      if (!user.telegramChatId) throw new HttpError(400, 'telegram_not_linked')
      return { type: 'telegram', identifier: user.telegramChatId }
    }
    // Email always goes to the account address — no separate linking step, and a
    // client-supplied identifier is ignored so nobody can alert-spam a stranger.
    if (c.type === 'email') {
      if (!user.email) throw new HttpError(400, 'email_missing')
      return { type: 'email', identifier: user.email }
    }
    // discord
    if (!c.identifier || !isDiscordWebhook(c.identifier)) throw new HttpError(400, 'invalid_discord_webhook')
    return { type: 'discord', identifier: c.identifier }
  })
}

export function triggeredLast<T extends { status: string }>(alerts: T[]) {
  return alerts.sort((a, b) => Number(a.status === 'triggered') - Number(b.status === 'triggered'))
}

router.get('/', async (req: AuthedRequest, res) => {
  const alerts = await prisma.alert.findMany({
    where: { userId: req.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  res.json(triggeredLast(alerts).map(serialize))
})

router.post('/', async (req: AuthedRequest, res) => {
  const p = alertInput.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input', details: p.error.issues })

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // Alert-count guard: free = 3, paid = 30. Paid users at the cap get a distinct
  // code so the UI shows "limit reached" instead of an upgrade prompt.
  const limitError = await alertLimitError(user.id)
  if (limitError) return res.status(402).json(limitError)

  let channels
  try {
    channels = await resolveChannels(user, p.data.channels)
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.code, ...e.details })
    throw e
  }

  // Current price doubles as symbol validation + base price. In WS mode the
  // engine already has it (no extra call); in REST mode a new symbol is probed.
  let currentPrice = engine.lastPrice(p.data.symbol, p.data.market)
  if (currentPrice == null) {
    const probe = await probeSymbol(p.data.symbol, p.data.market)
    if (probe.status === 'invalid') return res.status(400).json({ error: 'unknown_symbol' })
    currentPrice = probe.price
  }

  let basePrice: number | null = null
  if (p.data.type === 'percent' && p.data.percentBasis === 'since_created') {
    if (currentPrice == null) return res.status(400).json({ error: 'no_price_yet' })
    basePrice = currentPrice
  }

  const alert = await prisma
    .$transaction(async (tx) => {
      await lockAlertSlots(tx, user.id)
      const finalLimitError = await alertLimitError(user.id, tx)
      if (finalLimitError)
        throw new HttpError(402, finalLimitError.error, { limit: finalLimitError.limit })
      return tx.alert.create({
        data: {
          userId: user.id,
          symbol: p.data.symbol,
          market: p.data.market,
          type: p.data.type,
          direction: p.data.direction,
          target: p.data.target,
          percentBasis: p.data.percentBasis ?? null,
          basePrice,
          timeframe: p.data.type === 'candle_close' ? p.data.timeframe ?? null : null,
          repeat: p.data.repeat,
          // maxFires only applies to recurring alerts
          maxFires: p.data.repeat === 'recurring' ? p.data.maxFires ?? null : null,
          status: 'active',
          channels,
        },
      })
    })
    .catch((e) => {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.code, ...e.details })
        return null
      }
      throw e
    })
  if (!alert) return
  engine.upsert(alert)
  res.json(serialize(alert))
})

export async function resetAlert(req: AuthedRequest, res: Response) {
  const updated = await prisma
    .$transaction(async (tx) => {
      await lockAlertSlots(tx, req.userId!)
      const alert = await tx.alert.findFirst({ where: { id: req.params.id, userId: req.userId } })
      if (!alert) throw new HttpError(404, 'not_found')
      if (alert.status !== 'triggered') throw new HttpError(409, 'alert_not_triggered')

      const limitError = await alertLimitError(alert.userId, tx)
      if (limitError) throw new HttpError(402, limitError.error, { limit: limitError.limit })

      const changed = await tx.alert.updateMany({
        where: { id: alert.id, status: 'triggered' },
        data: { status: 'active', cycleFireCount: 0 },
      })
      if (changed.count !== 1) throw new HttpError(409, 'alert_not_triggered')
      return tx.alert.findUniqueOrThrow({ where: { id: alert.id } })
    })
    .catch((e) => {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.code, ...e.details })
        return null
      }
      throw e
    })
  if (!updated) return
  engine.reactivate(updated)
  res.json(serialize(updated))
}

router.post('/:id/reset', resetAlert)

export async function patchAlert(req: AuthedRequest, res: Response) {
  const a = await prisma.alert.findFirst({ where: { id: req.params.id, userId: req.userId } })
  if (!a) return res.status(404).json({ error: 'not_found' })
  const p = patchInput.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })
  if (a.status === 'triggered' && p.data.status)
    return res.status(409).json({ error: 'reset_required' })

  const data: any = {}
  if (p.data.target !== undefined) data.target = p.data.target
  if (p.data.status) data.status = p.data.status
  if (!Object.keys(data).length) return res.json(serialize(a))

  const changed = await prisma.alert.updateMany({
    where: { id: a.id, status: { not: 'triggered' } },
    data,
  })
  if (changed.count !== 1) return res.status(409).json({ error: 'reset_required' })
  const updated = await prisma.alert.findUniqueOrThrow({ where: { id: a.id } })

  if (p.data.status === 'active') engine.upsert(updated)
  else if (p.data.status === 'paused') engine.remove(updated.id)
  else engine.upsertIfPresent(updated)
  res.json(serialize(updated))
}

router.patch('/:id', patchAlert)

router.delete('/:id', async (req: AuthedRequest, res) => {
  const a = await prisma.alert.findFirst({ where: { id: req.params.id, userId: req.userId } })
  if (!a) return res.status(404).json({ error: 'not_found' })
  await prisma.alert.delete({ where: { id: a.id } })
  engine.remove(a.id)
  res.json({ ok: true })
})

export default router
