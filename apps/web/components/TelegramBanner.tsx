'use client'
import { useT } from '@/lib/i18n'
import { TelegramIcon } from '@/components/BrandIcons'

// Green promo bar linking to the Telegram channel. Placed on the landing page
// and dashboard. Optional className lets callers round it inside card layouts.
export function TelegramBanner({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <a
      href="https://t.me/crypto_alertkey"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-brand px-4 py-2.5 text-center text-sm font-medium text-slate-950 transition hover:bg-brand-dark ${className}`}
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
  )
}
