'use client'
import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { TelegramIcon } from '@/components/BrandIcons'
import { CloseIcon } from '@/components/Icons'

const STORAGE_KEY = 'alertkey:telegram-banner-dismissed'

// Green promo bar linking to the Telegram channel. Placed on the landing page
// and dashboard. Optional className lets callers round it inside card layouts.
// Dismissible, and the dismissal sticks across visits.
export function TelegramBanner({ className = '' }: { className?: string }) {
  const t = useT()
  // null until localStorage has been read. Rendering the banner first and
  // hiding it a frame later would flash it back at everyone who dismissed it,
  // so nothing is drawn until we know.
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setDismissed(false) // storage blocked (private mode): just show it
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Nothing to do: it stays hidden for this session only.
    }
  }

  if (dismissed !== false) return null

  const close = t('بستن این پیام', 'Dismiss this message')

  return (
    <div className={`relative flex overflow-hidden bg-brand text-slate-950 ${className}`}>
      <a
        href="https://t.me/crypto_alertkey"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-11 py-2.5 text-center text-sm font-medium transition hover:bg-brand-dark"
      >
        <TelegramIcon className="h-5 w-5 shrink-0" />
        <span>
          {t(
            'به کانال تلگرام الرت کی بپیوندید و از بروزرسانی‌ها و امکانات جدید زودتر از همه باخبر شوید',
            'Join the Alert Key Telegram channel — be first to get updates & new features',
          )}
        </span>
        <span dir="ltr" className="font-bold underline underline-offset-2">
          @crypto_alertkey
        </span>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={close}
        title={close}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-slate-950/60 transition hover:text-slate-950"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
