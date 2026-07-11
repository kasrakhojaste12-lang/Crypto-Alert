import { prisma } from './db'
import { log } from './log'

// Launch campaign: every account created before CAMPAIGN_END is granted Premium
// free until that date. Env-overridable; default = 2026-09-02 end of day (two
// months from the 2026-07-02 launch). After the end date, new signups get
// nothing; users who already claimed keep their subscription until it expires.
export const CAMPAIGN_END = new Date(process.env.CAMPAIGN_END || '2026-09-02T23:59:59.999Z')

export function campaignActive(now: Date = new Date()): boolean {
  return now.getTime() < CAMPAIGN_END.getTime()
}

export async function grantCampaignPremium(userId: string): Promise<{ until: string } | null> {
  if (!campaignActive()) return null
  try {
    const now = new Date()
    await prisma.subscription.create({
      data: {
        userId, plan: 'paid', status: 'active', amount: 0,
        periodStart: now, periodEnd: CAMPAIGN_END, zibalOrderId: `launch-${userId}`,
      },
    })
    await prisma.user.update({ where: { id: userId }, data: { plan: 'paid' } })
    log.info({ user: userId }, 'launch campaign: granted free premium')
    return { until: CAMPAIGN_END.toISOString() }
  } catch (e) {
    log.error({ err: String(e), user: userId }, 'launch campaign grant failed')
    return null
  }
}
