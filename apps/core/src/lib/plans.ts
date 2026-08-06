// Single source of truth for what each subscription plan may do. The API gates
// on this, /api/auth/me hands it to the browser, and the forms only ever mirror
// it — so an entitlement can never be enforced in one place and forgotten in
// another. Everything here is pure so it can be tested without a database.

export type PlanId = 'free' | 'pro' | 'gold'
export type AlertType = 'price' | 'percent' | 'candle_close'
// 'sms' is deliberately absent: it is announced in the UI but the worker cannot
// send it yet, so it must never be an accepted channel. See comingSoon below.
export type ChannelType = 'telegram' | 'email' | 'discord'

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

export type Plan = {
  id: PlanId
  priceUsdt: number
  alertLimit: number
  alertTypes: AlertType[]
  timeframes: Timeframe[]
  channels: ChannelType[]
  /** Channels a single alert may fan out to at once. */
  channelsPerAlert: number
  recurring: boolean
  /** Hard cap on notifications per alert per cycle — the anti-spam limit. */
  maxFiresPerAlert: number
  /** Advertised on the plan card with a "soon" badge; not accepted by the API. */
  comingSoon: string[]
}

// Prices are in USDT and converted to Toman at the live rate (see api/billing).
const PRO_USDT = Number(process.env.SUB_PRICE_USDT || 5)
const GOLD_USDT = Number(process.env.SUB_PRICE_GOLD_USDT || 12)

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    priceUsdt: 0,
    alertLimit: 5,
    // Price only. Percent and candle-close are the reason to pay.
    alertTypes: ['price'],
    timeframes: [],
    // Telegram or email — not both on one alert. Gating free accounts to
    // Telegram alone would mean nobody's first alert works until they find the
    // bot and send /start, and free signups are the top of the funnel.
    channels: ['telegram', 'email'],
    channelsPerAlert: 1,
    recurring: false,
    maxFiresPerAlert: 1,
    comingSoon: [],
  },
  pro: {
    id: 'pro',
    priceUsdt: PRO_USDT,
    alertLimit: 20,
    alertTypes: ['price', 'percent', 'candle_close'],
    // 1m and 5m are held back for gold: intraday scalpers are the segment with
    // the most to gain, and a timeframe they need converts far better than a
    // bigger alert count. Add them here to undo that.
    timeframes: ['15m', '1h', '4h', '1d'],
    channels: ['telegram', 'email', 'discord'],
    channelsPerAlert: 3,
    recurring: true,
    maxFiresPerAlert: 3,
    comingSoon: [],
  },
  gold: {
    id: 'gold',
    priceUsdt: GOLD_USDT,
    alertLimit: 100,
    alertTypes: ['price', 'percent', 'candle_close'],
    timeframes: [...TIMEFRAMES],
    channels: ['telegram', 'email', 'discord'],
    channelsPerAlert: 3,
    recurring: true,
    // The user picks the repeat count; this is the ceiling so an alert can never
    // spam them forever.
    maxFiresPerAlert: 10,
    comingSoon: ['sms'],
  },
}

export const PAID_PLANS = ['pro', 'gold'] as const
export type PaidPlanId = (typeof PAID_PLANS)[number]
export const isPaidPlan = (v: unknown): v is PaidPlanId =>
  typeof v === 'string' && (PAID_PLANS as readonly string[]).includes(v)

// Plan strings live in the database as free text. 'paid' predates tiers — every
// launch-campaign account carries it — and those users were promised the best
// tier, so it resolves to gold.
export function normalizePlan(value: string | null | undefined): PlanId {
  if (value === 'gold' || value === 'paid') return 'gold'
  if (value === 'pro') return 'pro'
  return 'free'
}

export function nextPlanFor(plan: PlanId): PaidPlanId | null {
  if (plan === 'free') return 'pro'
  if (plan === 'pro') return 'gold'
  return null
}

export type AlertShape = {
  type: AlertType
  timeframe?: string | null
  repeat: 'one_time' | 'recurring'
  channels: Array<{ type: string }>
}

export type PlanViolation = { feature: string; detail?: string }

// The one place that decides whether a plan may create a given alert. Returns
// the first thing it isn't allowed, so the UI can name it in the upgrade prompt.
export function checkAlertAgainstPlan(plan: PlanId, a: AlertShape): PlanViolation | null {
  const p = PLANS[plan]
  if (!p.alertTypes.includes(a.type)) return { feature: a.type }
  if (a.type === 'candle_close' && a.timeframe && !p.timeframes.includes(a.timeframe as Timeframe))
    return { feature: 'timeframe', detail: a.timeframe }
  if (a.repeat === 'recurring' && !p.recurring) return { feature: 'recurring' }
  for (const c of a.channels)
    if (!p.channels.includes(c.type as ChannelType)) return { feature: 'channel', detail: c.type }
  if (a.channels.length > p.channelsPerAlert)
    return { feature: 'channelsPerAlert', detail: String(p.channelsPerAlert) }
  return null
}

// Every plan gets a ceiling, so "unlimited" is no longer expressible: an alert
// that notifies forever is a support ticket waiting to happen. A blank request
// means "as many as my plan allows".
export function clampMaxFires(plan: PlanId, requested: number | null | undefined): number {
  const cap = PLANS[plan].maxFiresPerAlert
  if (requested == null) return cap
  return Math.max(1, Math.min(Math.floor(requested), cap))
}
