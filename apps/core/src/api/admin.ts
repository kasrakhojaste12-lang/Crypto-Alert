import { Router, type Response, type NextFunction } from 'express'
import { prisma } from '../lib/db'
import { requireAuth, type AuthedRequest } from '../lib/auth'

// ponytail: env allowlist instead of a User.isAdmin column — no migration, and
// the admin set changes about once a year. Add the column when admins need to
// be managed from the UI rather than by editing .env.
// Empty/unset ADMIN_EMAILS = nobody is an admin (safe default).
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
    prisma.alert.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.alert.groupBy({ by: ['type'], _count: { _all: true } }),
    // ponytail: .catch guards the split-brain window — if this deploys before the
    // futures migration lands, the client rejects `market` as unknown; degrade the
    // one breakdown to empty instead of 500-ing the whole panel. Drop the catch
    // once Alert.market is in the committed schema everywhere.
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
      take: 10,
      select: { id: true, email: true, plan: true, createdAt: true },
    }),
  ])

  res.json({
    users: { total, new24h, new7d, new30d, telegramLinked, premium },
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
    recentUsers,
  })
}

router.get('/stats', stats)

export default router
