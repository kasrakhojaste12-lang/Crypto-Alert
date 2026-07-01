import { prisma } from './db'

export const FREE_ALERT_LIMIT = 3
export const PAID_ALERT_LIMIT = 30

// Alerts that count toward the limit = everything except permanently triggered ones.
export function activeAlertCount(userId: string) {
  return prisma.alert.count({ where: { userId, status: { not: 'triggered' } } })
}

export async function hasActiveSubscription(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active', periodEnd: { gt: new Date() } },
  })
  return !!sub
}
