'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { toman } from '@/lib/format'

interface Price { usdt: number; toman: number; tomanPerUsdt: number; rial: number; updatedAt: string | null }

export default function BillingPage() {
  return (
    <Shell>
      <Billing />
    </Shell>
  )
}

function Billing() {
  const { user } = useUser()
  const t = useT()
  const { lang } = useLang()
  const [busy, setBusy] = useState(false)
  const { data: price } = useSWR<Price>('/api/billing/price', api)

  async function checkout() {
    setBusy(true)
    try {
      const { redirectUrl } = await api('/api/billing/checkout', { method: 'POST' })
      window.location.href = redirectUrl
    } catch {
      setBusy(false)
    }
  }

  const sub = user?.subscription
  const expiry = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') : null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('اشتراک', 'Subscription')}</h1>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-2">
        <p className="text-sm text-slate-400">{t('وضعیت فعلی', 'Current status')}</p>
        {user?.plan === 'paid' && expiry ? (
          <>
            <p className="text-lg font-semibold text-brand">{t('اشتراک فعال', 'Active subscription')}</p>
            <p className="text-sm text-slate-400">
              {t(`تا تاریخ ${expiry} — تا ۳۰ هشدار`, `Until ${expiry} — up to 30 alerts`)}
            </p>
          </>
        ) : (
          <p className="text-lg font-semibold">{t('پلن رایگان — تا ۳ هشدار', 'Free plan — up to 3 alerts')}</p>
        )}
      </div>

      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 space-y-4">
        <div>
          <p className="font-semibold text-brand">{t('اشتراک ماهانه', 'Monthly subscription')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('تا ۳۰ هشدار، همهٔ کانال‌ها', 'Up to 30 alerts, all channels')}</p>
        </div>
        <p className="text-2xl font-bold">
          {price ? toman(price.rial, lang) : '…'}{' '}
          <span className="text-base font-normal text-slate-400">{t('تومان / ماه', 'Toman / month')}</span>
        </p>
        {price && (
          <p className="text-xs text-slate-500">
            {t(`معادل ${price.usdt} تتر (USDT) — نرخ لحظه‌ای از والکس`, `= ${price.usdt} USDT — live rate from Wallex`)}
          </p>
        )}
        <button
          onClick={checkout}
          disabled={busy}
          className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy
            ? t('در حال انتقال به درگاه…', 'Redirecting to the gateway…')
            : user?.plan === 'paid'
              ? t('تمدید اشتراک', 'Renew subscription')
              : t('ارتقا به اشتراک', 'Upgrade to subscription')}
        </button>
        <p className="text-xs text-slate-500 text-center">{t('پرداخت امن از طریق درگاه زیبال', 'Secure payment via the Zibal gateway')}</p>
      </div>
    </div>
  )
}
