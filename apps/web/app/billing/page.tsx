'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { Shell } from '@/components/Shell'
import { toman } from '@/lib/format'

const PRICE_RIAL = 500000 // mirrors SUB_PRICE_RIAL default; display only

export default function BillingPage() {
  return (
    <Shell>
      <Billing />
    </Shell>
  )
}

function Billing() {
  const { user } = useUser()
  const [busy, setBusy] = useState(false)

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
  const expiry = sub?.periodEnd ? new Date(sub.periodEnd).toLocaleDateString('fa-IR') : null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">اشتراک</h1>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-2">
        <p className="text-sm text-slate-400">وضعیت فعلی</p>
        {user?.plan === 'paid' && expiry ? (
          <>
            <p className="text-lg font-semibold text-brand">اشتراک فعال</p>
            <p className="text-sm text-slate-400">تا تاریخ {expiry} — هشدار نامحدود</p>
          </>
        ) : (
          <p className="text-lg font-semibold">پلن رایگان — تا ۳ هشدار</p>
        )}
      </div>

      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 space-y-4">
        <div>
          <p className="font-semibold text-brand">اشتراک ماهانه</p>
          <p className="text-sm text-slate-400 mt-1">هشدار نامحدود، همهٔ کانال‌ها</p>
        </div>
        <p className="text-2xl font-bold">
          {toman(PRICE_RIAL)} <span className="text-base font-normal text-slate-400">تومان / ماه</span>
        </p>
        <button
          onClick={checkout}
          disabled={busy}
          className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? 'در حال انتقال به درگاه…' : user?.plan === 'paid' ? 'تمدید اشتراک' : 'ارتقا به اشتراک'}
        </button>
        <p className="text-xs text-slate-500 text-center">پرداخت امن از طریق درگاه زیبال</p>
      </div>
    </div>
  )
}
