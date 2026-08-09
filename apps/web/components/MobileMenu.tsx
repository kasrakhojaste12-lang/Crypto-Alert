'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, useT } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LangToggle } from '@/components/LangToggle'

interface NavItem {
  href: string
  label: string
}

// Hamburger nav for the landing page. Desktop shows links inline in the
// header (see page.tsx); below the `sm` breakpoint everything collapses into
// this slide-in panel instead of crowding the header. Works in both RTL
// (Persian) and LTR (English) — the panel slides in from whichever side is
// the reading start.
export function MobileMenu({
  items,
  authed,
}: {
  items: NavItem[]
  authed: boolean
}) {
  const t = useT()
  const { lang } = useLang()
  const [open, setOpen] = useState(false)

  // Lock body scroll while the panel is open; Escape closes it.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const fromEdge = lang === 'fa' ? 'right-0' : 'left-0'
  const offscreen = lang === 'fa' ? 'translate-x-full' : '-translate-x-full'

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('باز کردن منو', 'Open menu')}
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 ${fromEdge} z-50 flex w-72 max-w-[85vw] flex-col glass shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : offscreen
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-slate-400">{t('منو', 'Menu')}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('بستن منو', 'Close menu')}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangToggle />
          </div>
          <Link
            href={authed ? '/dashboard' : '/register'}
            onClick={() => setOpen(false)}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-dark transition"
          >
            {authed ? t('داشبورد', 'Dashboard') : t('رایگان شروع کن', 'Start free')}
          </Link>
        </div>
      </div>
    </div>
  )
}
