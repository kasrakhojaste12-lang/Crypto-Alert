import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { PLANS, normalizePlan, type PlanId } from './plans'

// Kept for callers that predate tiers. Prefer PLANS[tier].alertLimit.
export const FREE_ALERT_LIMIT = PLANS.free.alertLimit
export const PAID_ALERT_LIMIT = PLANS.gold.alertLimit

export type LimitDb = Pick<Prisma.TransactionClient, 'alert' | 'subscription'>

// Alerts that count toward the limit = everything except terminal triggered ones.
export function activeAlertCount(userId: string, db: LimitDb = prisma) {
  return db.alert.count({ where: { userId, status: { not: 'triggered' } } })
}

// The tier comes from the active subscription rather than User.plan, so it
// expires on its own the moment periodEnd passes — no cron needed to demote.
// Highest periodEnd wins if someone has stacked subscriptions.
export async function planOf(userId: string, db: LimitDb = prisma): Promise<PlanId> {
  const sub = await db.subscription.findFirst({
    where: { userId, status: 'active', periodEnd: { gt: new Date() } },
    orderBy: { periodEnd: 'desc' },
  })
  return sub ? normalizePlan(sub.plan) : 'free'
}

export async function hasActiveSubscription(userId: string, db: LimitDb = prisma) {
  return (await planOf(userId, db)) !== 'free'
}
