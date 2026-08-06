'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useUser, type PlanId } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { planName } from '@/lib/plans'
import { toman } from '@/lib/format'
import { Shell } from '@/components/Shell'

// Shape of GET /api/billing/plans — entitlements + converted price per plan.
interface PlanCard {
  id: PlanId
  priceUsdt: number
  alertLimit: number
  alertTypes: string[]
  timeframes: string[]
  channels: string[]
  channelsPerAlert: number
  recurring: boolean
  maxFiresPerAlert: number
  comingSoon: string[]
  toman: number
  rial: number
}
interface PlansResponse {
  tomanPerUsdt: number
  updatedAt: string | null
  periodDays: number
  plans: PlanCard[]
}

export default function BillingPage() {
  return (
    <Shell>
      <Billing />
    </Shell>
  )
}

function Billing() {
  const t = useT()
  const { lang } = useLang()
  const { user } = useUser()
  const { data } = useSWR<PlansResponse>('/api/billing/plans', api)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tier: PlanId = user?.tier ?? 'free'
  const periodDays = data?.periodDays || 30

  async function checkout(plan: 'pro' | 'gold') {
    setError(null)
    setBusy(plan)
    try {
      const { redirectUrl } = await api<{ redirectUrl: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      window.location.href = redirectUrl
    } catch {
      setError(t('شروع پرداخت ناموفق بود؛ دوباره تلاش کنید.', 'Could not start the payment; please try again.'))
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t('پلن‌ها و اشتراک', 'Plans & subscription')}</h1>
        <p className="text-sm text-slate-400">
          {t(
            `پلن فعلی شما: ${planName(tier, lang)}`,
            `Your current plan: ${planName(tier, lang)}`,
          )}
          {user?.subscription?.periodEnd && (
            <>
              {' — '}
              {t('اعتبار تا ', 'valid until ')}
              <span dir="ltr">
                {new Date(user.subscription.periodEnd).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB')}
              </span>
            </>
          )}
        </p>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {(data?.plans ?? []).map((plan) => (
          <PlanCardView
            key={plan.id}
            plan={plan}
            current={tier === plan.id}
            periodDays={periodDays}
            busy={busy === plan.id}
            onSelect={plan.id === 'free' ? undefined : () => checkout(plan.id as 'pro' | 'gold')}
            lang={lang}
            t={t}
          />
        ))}
        {!data && <p className="text-sm text-slate-500">{t('در حال دریافت قیمت…', 'Loading prices…')}</p>}
      </div>

      {data?.tomanPerUsdt && (
        <p className="text-xs text-slate-500">
          {t(
            `قیمت‌ها بر پایهٔ دلار تتر محاسبه می‌شود (هر تتر ${toman(data.tomanPerUsdt * 10, lang)} تومان) و مبلغ نهایی در لحطهٔ پرداخت قطعی می‌شود.`,
            `Prices are pegged to USDT (1 USDT = ${toman(data.tomanPerUsdt * 10, lang)} Toman); the final amount is fixed at checkout.`,
          )}
        </p>
      )}
    </div>
  )
}

function PlanCardView({
  plan,
  current,
  periodDays,
  busy,
  onSelect,
  lang,
  t,
}: {
  plan: PlanCard
  current: boolean
  periodDays: number
  busy: boolean
  onSelect?: () => void
  lang: 'fa' | 'en'
  t: (fa: string, en: string) => string
}) {
  const gold = plan.id === 'gold'
  const perDay = toman(Math.round(plan.rial / periodDays), lang)
  const tf = plan.timeframes
  const hasScalp = tf.includes('1m') || tf.includes('5m')

  const rows: string[] = [
    t(`${plan.alertLimit} هشدار فعال همزمان`, `${plan.alertLimit} active alerts`),
    plan.alertTypes.includes('candle_close')
      ? t(
          hasScalp
            ? 'هشدار بسته‌شدن کندل در همهٔ تایم‌فریم‌ها (شامل ۱ و ۵ دقیقه)'
            : `هشدار بسته‌شدن کندل (${tf.join('، ')})`,
          hasScalp
            ? 'Candle-close alerts on every timeframe (incl. 1m & 5m)'
            : `Candle-close alerts (${tf.join(', ')})`,
        )
      : t('فقط هشدار قیمتی', 'Price alerts only'),
    plan.alertTypes.includes('percent')
      ? t('هشدار درصد تغییر ۲۴ ساعته', '24h percent-change alerts')
      : t('بدون هشدار درصد تغییر', 'No percent-change alerts'),
    plan.recurring
      ? t(
          `هشدار تکرارشونده تا ${plan.maxFiresPerAlert} اعلان برای هر هشدار`,
          `Recurring alerts, up to ${plan.maxFiresPerAlert} notifications each`,
        )
      : t('هر هشدار یک بار اعلان', 'One notification per alert'),
    t(
      `کانال‌ها: ${plan.channels.join('، ')} (${plan.channelsPerAlert} کانال برای هر هشدار)`,
      `Channels: ${plan.channels.join(', ')} (${plan.channelsPerAlert} per alert)`,
    ),
  ]

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-2xl border p-5 ${
        gold ? 'border-amber-400/40 bg-amber-400/5 ring-2 ring-amber-400/40' : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {gold && (
        <span className="absolute -top-3 start-5 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-950">
          {t('پیشنهاد ما', 'Best value')}
        </span>
      )}

      <div className="space-y-1">
        <h2 className={`text-lg font-bold ${gold ? 'text-amber-300' : ''}`}>{planName(plan.id, lang)}</h2>
        {plan.priceUsdt === 0 ? (
          <p className="text-2xl font-bold">{t('رایگان', 'Free')}</p>
        ) : (
          <>
            <p className="text-2xl font-bold">
              {toman(plan.rial, lang)}{' '}
              <span className="text-sm font-normal text-slate-400">{t('تومان / ماه', 'Toman / month')}</span>
            </p>
            <p className="text-xs text-slate-500">
              {t(`روزی ${perDay} تومان — ${plan.priceUsdt} تتر`, `${perDay} Toman/day — ${plan.priceUsdt} USDT`)}
            </p>
          </>
        )}
      </div>

      <ul className="flex-1 space-y-2 text-sm text-slate-300">
        {rows.map((row) => (
          <li key={row} className="flex gap-2">
            <span className={gold ? 'text-amber-300' : 'text-brand'}>✓</span>
            <span>{row}</span>
          </li>
        ))}
        {plan.comingSoon.includes('sms') && (
          <li className="flex items-center gap-2 text-slate-400">
            <span className="text-slate-500">✓</span>
            <span>{t('اعلان پیامکی موبایل', 'Mobile SMS alerts')}</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
              {t('به‌زودی', 'Soon')}
            </span>
          </li>
        )}
      </ul>

      {current ? (
        <div className="rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-400">
          {t('پلن فعلی شما', 'Your current plan')}
        </div>
      ) : onSelect ? (
        <button
          onClick={onSelect}
          disabled={busy}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
            gold
              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              : 'bg-brand text-slate-950 hover:bg-brand-dark'
          }`}
        >
          {busy ? t('در حال انتقال به درگاه…', 'Redirecting to payment…') : t('تهیهٔ این پلن', 'Choose this plan')}
        </button>
      ) : (
        <div className="rounded-xl border border-slate-800 px-4 py-2.5 text-center text-sm text-slate-500">
          {t('برای شروع کار', 'For getting started')}
        </div>
      )}
    </div>
  )
}
