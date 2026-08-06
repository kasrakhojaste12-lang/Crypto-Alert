'use client'
import useSWR from 'swr'
import { api } from './api'

export type PlanId = 'free' | 'pro' | 'gold'
export type AlertType = 'price' | 'percent' | 'candle_close'
export type ChannelType = 'telegram' | 'email' | 'discord'

// Mirrors Plan in apps/core/src/lib/plans.ts — the server ships the whole thing
// on /api/auth/me so the UI never hardcodes a limit of its own.
export interface Entitlements {
  id: PlanId
  priceUsdt: number
  alertLimit: number
  alertTypes: AlertType[]
  timeframes: string[]
  channels: ChannelType[]
  channelsPerAlert: number
  recurring: boolean
  maxFiresPerAlert: number
  comingSoon: string[]
}

export interface User {
  id: string
  email: string
  /** Legacy coarse flag. Use `tier` for anything plan-dependent. */
  plan: 'free' | 'paid'
  tier: PlanId
  entitlements: Entitlements
  nextPlan: Exclude<PlanId, 'free'> | null
  telegramLinked: boolean
  telegramLanguage: 'fa' | 'en'
  activeAlerts: number
  freeLimit: number
  alertLimit: number
  subscription: { status: string; periodEnd: string | null } | null
}

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User>('/api/auth/me', api, {
    shouldRetryOnError: false,
  })
  return { user: data, error, isLoading, mutate }
}
