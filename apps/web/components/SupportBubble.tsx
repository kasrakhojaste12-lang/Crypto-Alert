'use client'
import { useT } from '@/lib/i18n'

// Floating support button, shown site-wide (rendered in the root layout).
// Bottom-left suits the RTL layout; opens the Telegram support account.
export function SupportBubble() {
  const t = useT()
  const label = t('پشتیبانی', 'Support')
  return (
    <a
      href="https://t.me/AlertKey_support"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="fixed bottom-4 left-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-brand text-slate-950 shadow-lg shadow-brand/30 ring-1 ring-black/10 transition hover:bg-brand-dark hover:scale-105"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </a>
  )
}
