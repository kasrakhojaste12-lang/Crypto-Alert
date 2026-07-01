// Launch campaign: every account created before CAMPAIGN_END is granted Premium
// free until that date. Env-overridable; default = 2026-09-02 end of day (two
// months from the 2026-07-02 launch). After the end date, new signups get
// nothing; users who already claimed keep their subscription until it expires.
export const CAMPAIGN_END = new Date(process.env.CAMPAIGN_END || '2026-09-02T23:59:59.999Z')

export function campaignActive(now: Date = new Date()): boolean {
  return now.getTime() < CAMPAIGN_END.getTime()
}
