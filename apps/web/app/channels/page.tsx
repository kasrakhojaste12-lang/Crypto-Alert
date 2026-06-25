'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { Shell } from '@/components/Shell'

export default function ChannelsPage() {
  return (
    <Shell>
      <Channels />
    </Shell>
  )
}

function Channels() {
  const { user, mutate } = useUser()
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">کانال‌های اعلان</h1>

      {/* Telegram */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✈️</span>
            <span className="font-semibold">تلگرام</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${
              user?.telegramLinked ? 'bg-brand/20 text-brand' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {user?.telegramLinked ? 'متصل' : 'متصل نشده'}
          </span>
        </div>

        {user?.telegramLinked ? (
          <p className="text-sm text-slate-400">حساب تلگرام شما متصل است و هشدارها را دریافت می‌کنید.</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              برای اتصال، روی دکمه بزنید و در تلگرام دستور <span dir="ltr">/start</span> را برای ربات ارسال کنید.
            </p>
            <button
              onClick={makeLink}
              disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? '...' : 'ساخت لینک اتصال'}
            </button>
            {link && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm space-y-2">
                <a href={link.url} target="_blank" rel="noreferrer" className="text-brand break-all" dir="ltr">
                  {link.url}
                </a>
                <p className="text-xs text-slate-500">
                  پس از ارسال <span dir="ltr">/start</span> در تلگرام، این صفحه را تازه‌سازی کنید.
                </p>
                <button onClick={() => mutate()} className="text-xs text-slate-400 hover:text-white">
                  بررسی وضعیت اتصال
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Discord */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <span className="font-semibold">دیسکورد</span>
        </div>
        <p className="text-sm text-slate-400">
          آدرس وبهوک دیسکورد را هنگام ساخت هر هشدار وارد کنید. (تنظیمات کانال ← Integrations ← Webhooks)
        </p>
      </div>
    </div>
  )
}
