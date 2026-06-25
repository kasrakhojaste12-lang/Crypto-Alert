'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/useUser'
import { Nav } from './Nav'

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (error || !user)) router.replace('/login')
  }, [isLoading, error, user, router])

  if (isLoading || !user)
    return <div className="min-h-screen grid place-items-center text-slate-400">در حال بارگذاری…</div>

  return (
    <div className="min-h-screen">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
