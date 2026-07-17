'use client'
import useSWR from 'swr'
import { api } from './api'

export interface User {
  id: string
  email: string
  plan: 'free' | 'paid'
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
