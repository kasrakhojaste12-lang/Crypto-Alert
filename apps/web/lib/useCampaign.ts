'use client'
import useSWR from 'swr'
import { api } from './api'

export interface Campaign {
  active: boolean
  endsAt: string // ISO date the free-Premium launch offer ends
}

export function useCampaign() {
  const { data } = useSWR<Campaign>('/api/auth/campaign', api, { shouldRetryOnError: false })
  return data
}
