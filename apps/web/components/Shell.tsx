'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/useUser'
import { useT } from '@/lib/i18n'
import { Nav } from './Nav'

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useUser()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!isLoading && (error || !user)) router.replace('/login')
  }, [isLoading, error, user, router])

  if (isLoading || !user)
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">{t('در حال بارگذاری…', 'Loading…')}</p>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen">
      <Nav user={user} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
