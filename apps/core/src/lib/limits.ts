import type { Prisma } from '@prisma/client'
import { prisma } from './db'

export const FREE_ALERT_LIMIT = 3
export const PAID_ALERT_LIMIT = 30

export type LimitDb = Pick<Prisma.TransactionClient, 'alert' | 'subscription'>

// Alerts that count toward the limit = everything except terminal triggered ones.
export function activeAlertCount(userId: string, db: LimitDb = prisma) {
  return db.alert.count({ where: { userId, status: { not: 'triggered' } } })
}

export async function hasActiveSubscription(userId: string, db: LimitDb = prisma) {
  const sub = await db.subscription.findFirst({
    where: { userId, status: 'active', periodEnd: { gt: new Date() } },
  })
  return !!sub
}
