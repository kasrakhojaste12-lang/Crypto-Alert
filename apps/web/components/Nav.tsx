'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { LangToggle } from '@/components/LangToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/Logo'
import type { User } from '@/lib/useUser'

// Plan badge colours — handles legacy 'paid' (= gold)
const PLAN_META: Record<string, { label: string; cls: string }> = {
  free: { label: 'Free', cls: 'border border-slate-700/60 bg-slate-800/60 text-slate-400' },
  pro:  { label: 'Pro',  cls: 'border border-blue-500/30 bg-blue-500/10 text-blue-400' },
  gold: { label: 'Gold', cls: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
  paid: { label: 'Gold', cls: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
}

function NavLinks({ path }: { path: string }) {
  const t = useT()
  const links = [
    { href: '/dashboard', label: t('هشدارها', 'Alerts') },
    { href: '/channels',  label: t('کانال‌ها', 'Channels') },
    { href: '/billing',   label: t('اشتراک',   'Plans') },
    { href: '/settings',  label: t('تنظیمات',  'Settings') },
  ]
  return (
    <>
      {links.map((l) => {
        const active = path.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              active ? 'text-white' : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {active && (
              <span className="absolute inset-0 rounded-lg bg-white/[0.07] shadow-sm" />
            )}
            {active && (
              <span className="absolute bottom-0 inset-x-3 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
            )}
            <span className="relative">{l.label}</span>
          </Link>
        )
      })}
    </>
  )
}

export function Nav({ user }: { user: User }) {
  const path = usePathname()
  const router = useRouter()
  const t = useT()
  const plan = (user.plan ?? 'free') as string
  const planMeta = PLAN_META[plan] ?? PLAN_META.free

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-4xl px-4">
        <div className="h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <Logo className="h-7 w-auto" />
            <span className="font-bold gradient-text tracking-wide">
              {t('الرت کی', 'Alert Key')}
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-0.5 flex-1 justify-center">
            <NavLinks path={path} />
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
            <LangToggle />
            <span className={`hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-semibold ${planMeta.cls}`}>
              {planMeta.label}
            </span>
            <button
              onClick={logout}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-rose-500/5"
            >
              {t('خروج', 'Exit')}
            </button>
          </div>
        </div>

        {/* Mobile nav scrollable row */}
        <nav className="sm:hidden flex items-center gap-0.5 pb-2 overflow-x-auto">
          <NavLinks path={path} />
        </nav>
      </div>
    </header>
  )
}
