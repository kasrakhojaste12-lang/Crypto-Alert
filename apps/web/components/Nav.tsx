'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { User } from '@/lib/useUser'

const links = [
  { href: '/dashboard', label: 'هشدارها' },
  { href: '/channels', label: 'کانال‌ها' },
  { href: '/billing', label: 'اشتراک' },
  { href: '/settings', label: 'تنظیمات' },
]

function NavLinks({ path }: { path: string }) {
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm transition ${
            path.startsWith(l.href) ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </>
  )
}

export function Nav({ user }: { user: User }) {
  const path = usePathname()
  const router = useRouter()

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          <span className="font-bold text-brand whitespace-nowrap">⚡ الرت کی</span>
          {/* desktop: links inline */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLinks path={path} />
          </nav>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                user.plan === 'paid' ? 'bg-brand/20 text-brand' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {user.plan === 'paid' ? 'اشتراک فعال' : 'رایگان'}
            </span>
            <button onClick={logout} className="text-sm text-slate-400 hover:text-rose-400 transition">
              خروج
            </button>
          </div>
        </div>
        {/* mobile: links on their own scrollable row */}
        <nav className="sm:hidden flex items-center gap-1 pb-2 overflow-x-auto">
          <NavLinks path={path} />
        </nav>
      </div>
    </header>
  )
}
