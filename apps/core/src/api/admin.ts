import { Router, type Response, type NextFunction } from 'express'
import { prisma } from '../lib/db'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { normalizePlan, type PlanId } from '../lib/plans'

// Admin allowlist lives in ADMIN_EMAILS (comma-separated). Empty/unset = nobody
// is admin. No migration needed; the set changes ~once a year.
const adminEmails = () =>
  new Set(
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const allow = adminEmails()
  if (!allow.size) return res.status(403).json({ error: 'forbidden' })
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  if (!user || !allow.has(user.email.toLowerCase())) return res.status(403).json({ error: 'forbidden' })
  next()
}

const router = Router()
router.use(requireAuth, requireAdmin)

// groupBy rows -> { [value]: count }
const tally = (rows: any[], key: string): Record<string, number> =>
  Object.fromEntries(rows.map((r) => [r[key], r._count._all]))

export async function stats(_req: AuthedRequest, res: Response) {
  const now = new Date()
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000)
  // A subscription is only money-in once it leaves 'pending'; 'expired' was still paid.
  const paid = { status: { in: ['active', 'expired'] } }
  const live = { status: 'active', periodEnd: { gt: now } }

  const [
    total,
    new24h,
    new7d,
    new30d,
    telegramLinked,
    premium,
    byPlanRaw,
    byStatus,
    byType,
    byMarket,
    topSymbols,
    subsActive,
    revenueAll,
    revenue30d,
    notif24h,
    notifTotal,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: ago(30) } } }),
    prisma.user.count({ where: { telegramChatId: { not: null } } }),
    prisma.user.count({ where: { subscriptions: { some: live } } }),
    // Plan breakdown — normalize legacy 'paid' -> 'gold' in JS so the query
    // stays simple and survives any future plan renames without a migration.
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.alert.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.alert.groupBy({ by: ['type'], _count: { _all: true } }),
    // .catch guards the split-brain window — if this deploys before the
    // futures migration lands, degrade to empty instead of 500-ing the panel.
    prisma.alert.groupBy({ by: ['market'], _count: { _all: true } }).catch(() => [] as any[]),
    prisma.alert.groupBy({
      by: ['symbol'],
      _count: { _all: true },
      where: { status: { not: 'triggered' } },
      orderBy: { _count: { symbol: 'desc' } },
      take: 10,
    }),
    prisma.subscription.count({ where: live }),
    prisma.subscription.aggregate({ _sum: { amount: true }, where: paid }),
    prisma.subscription.aggregate({ _sum: { amount: true }, where: { ...paid, createdAt: { gte: ago(30) } } }),
    prisma.notification.groupBy({ by: ['status'], _count: { _all: true }, where: { createdAt: { gte: ago(1) } } }),
    prisma.notification.count(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, email: true, plan: true, createdAt: true, telegramChatId: true },
    }),
  ])

  // Merge legacy 'paid' into 'gold'
  const byPlan: Record<PlanId, number> = { free: 0, pro: 0, gold: 0 }
  for (const row of byPlanRaw) {
    const normalized = normalizePlan(row.plan)
    byPlan[normalized] = (byPlan[normalized] ?? 0) + row._count._all
  }

  res.json({
    users: { total, new24h, new7d, new30d, telegramLinked, premium, byPlan },
    alerts: {
      byStatus: tally(byStatus, 'status'),
      byType: tally(byType, 'type'),
      byMarket: tally(byMarket, 'market'),
      topSymbols: topSymbols.map((r: any) => ({ symbol: r.symbol, count: r._count._all })),
    },
    subscriptions: {
      active: subsActive,
      revenueRial: revenueAll._sum.amount ?? 0,
      revenue30dRial: revenue30d._sum.amount ?? 0,
    },
    notifications: { last24h: tally(notif24h, 'status'), total: notifTotal },
    // Never leak passwordHash; telegramChatId becomes a boolean flag.
    recentUsers: recentUsers.map(({ telegramChatId, plan, ...u }) => ({
      ...u,
      plan: normalizePlan(plan),
      hasTelegram: telegramChatId !== null,
    })),
  })
}

router.get('/stats', stats)

export default router
