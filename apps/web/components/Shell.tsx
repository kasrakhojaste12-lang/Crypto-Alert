'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/useUser'
import { useT } from '@/lib/i18n'
import { Nav } from './Nav'

export function Shell({ children, belowHeader }: { children: React.ReactNode; belowHeader?: React.ReactNode }) {
  const { user, isLoading, error } = useUser()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!isLoading && (error || !user)) router.replace('/login')
  }, [isLoading, error, user, router])

  if (isLoading || !user)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">{t('در حال بارگذاری…', 'Loading…')}</div>
    )

  return (
    <div className="min-h-screen">
      <Nav user={user} />
      {belowHeader}
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
