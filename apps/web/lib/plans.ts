'use client'
import type { PlanId } from './useUser'

// Display names only — every entitlement comes from the server.
export const PLAN_LABEL: Record<PlanId, { fa: string; en: string }> = {
  free: { fa: 'رایگان', en: 'Free' },
  pro: { fa: 'پرو', en: 'Pro' },
  gold: { fa: 'طلایی', en: 'Gold' },
}

export function planName(plan: PlanId | null | undefined, lang: 'fa' | 'en') {
  if (!plan) return ''
  return PLAN_LABEL[plan][lang]
}
