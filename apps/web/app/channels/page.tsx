'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { TelegramIcon, DiscordIcon } from '@/components/BrandIcons'

export default function ChannelsPage() {
  return (
    <Shell>
      <Channels />
    </Shell>
  )
}

function Channels() {
  const { user, mutate } = useUser()
  const t = useT()
  const [link, setLink] = useState<{ code: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function makeLink() {
    setBusy(true)
    try {
      setLink(await api('/api/channels/telegram/link', { method: 'POST' }))
    } finally {
      setBusy(false)
    }
  }

  async function unlink() {
    setBusy(true)
    try {
      await api('/api/channels/telegram/unlink', { method: 'POST' })
      setLink(null)
      await mutate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('کانال‌های اعلان', 'Notification channels')}</h1>

      {/* Telegram */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TelegramIcon className="h-6 w-6" />
            <span className="font-semibold">{t('تلگرام', 'Telegram')}</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${
              user?.telegramLinked ? 'bg-brand/20 text-brand' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {user?.telegramLinked ? t('متصل', 'Connected') : t('متصل نشده', 'Not connected')}
          </span>
        </div>

        {user?.telegramLinked ? (
          <>
            <p className="text-sm text-slate-400">
              {t('حساب تلگرام شما متصل است و هشدارها را دریافت می‌کنید.', "Your Telegram is connected and you'll receive alerts.")}
            </p>
            <button
              onClick={unlink}
              disabled={busy}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-red-500/60 hover:text-red-400 disabled:opacity-50"
            >
              {busy ? '...' : t('قطع اتصال تلگرام', 'Disconnect Telegram')}
            </button>
            <p className="text-xs text-slate-500">
              {t('برای تغییر حساب، ابتدا قطع اتصال کنید و سپس دوباره متصل شوید.', 'To switch accounts, disconnect first, then connect again.')}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              {t('برای اتصال، روی دکمه بزنید و در تلگرام دستور ', 'To connect, tap the button and send ')}
              <span dir="ltr">/start</span>
              {t(' را برای ربات ارسال کنید.', ' to the bot in Telegram.')}
            </p>
            <button
              onClick={makeLink}
              disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? '...' : t('ساخت لینک اتصال', 'Create connection link')}
            </button>
            {link && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm space-y-2">
                <a href={link.url} target="_blank" rel="noreferrer" className="text-brand break-all" dir="ltr">
                  {link.url}
                </a>
                <p className="text-xs text-slate-500">
                  {t('پس از ارسال ', 'After sending ')}
                  <span dir="ltr">/start</span>
                  {t(' در تلگرام، این صفحه را تازه‌سازی کنید.', ' in Telegram, refresh this page.')}
                </p>
                <button onClick={() => mutate()} className="text-xs text-slate-400 hover:text-white">
                  {t('بررسی وضعیت اتصال', 'Check connection status')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Discord */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <DiscordIcon className="h-6 w-6" />
          <span className="font-semibold">{t('دیسکورد', 'Discord')}</span>
        </div>
        <p className="text-sm text-slate-400">
          {t(
            'آدرس وبهوک دیسکورد را هنگام ساخت هر هشدار وارد کنید. (تنظیمات کانال ← Integrations ← Webhooks)',
            'Enter a Discord webhook URL when creating each alert. (Channel settings → Integrations → Webhooks)',
          )}
        </p>
      </div>
    </div>
  )
}
