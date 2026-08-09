'use client'
import useSWR from 'swr'
import { api, type ApiError } from '@/lib/api'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { fmtNum, toman, baseOf, statusInfo } from '@/lib/format'

interface Stats {
  users: { total: number; new24h: number; new7d: number; new30d: number; telegramLinked: number; premium: number }
  alerts: {
    byStatus: Record<string, number>
    byType: Record<string, number>
    byMarket: Record<string, number>
    topSymbols: { symbol: string; count: number }[]
  }
  subscriptions: { active: number; revenueRial: number; revenue30dRial: number }
  notifications: { last24h: Record<string, number>; total: number }
  recentUsers: { id: string; email: string; plan: string; createdAt: string }[]
}

export default function AdminPage() {
  return (
    <Shell>
      <Admin />
    </Shell>
  )
}

const TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  price: { fa: 'قیمت', en: 'Price' },
  percent: { fa: 'درصد', en: 'Percent' },
  candle_close: { fa: 'بسته‌شدن کندل', en: 'Candle close' },
}
const MARKET_LABEL: Record<string, { fa: string; en: string }> = {
  spot: { fa: 'اسپات', en: 'Spot' },
  futures: { fa: 'فیوچرز', en: 'Futures' },
}
const NOTIF_LABEL: Record<string, { fa: string; en: string; cls: string }> = {
  sent: { fa: 'ارسال شده', en: 'Sent', cls: 'text-brand' },
  failed: { fa: 'ناموفق', en: 'Failed', cls: 'text-rose-400' },
  pending: { fa: 'در صف', en: 'Pending', cls: 'text-amber-400' },
}

function Admin() {
  const t = useT()
  const { lang } = useLang()
  // shouldRetryOnError: a 403 here is permanent — don't hammer it (same as useUser).
  const { data, error } = useSWR<Stats>('/api/admin/stats', api, {
    refreshInterval: 30_000,
    shouldRetryOnError: false,
  })

  if ((error as ApiError | undefined)?.status === 403)
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <p className="text-slate-300">{t('به این بخش دسترسی ندارید.', 'You do not have access to this page.')}</p>
      </div>
    )
  if (error) return <p className="text-rose-400">{t('خطا در بارگذاری آمار', 'Failed to load stats')}</p>
  if (!data) return <p className="text-slate-400">{t('در حال بارگذاری…', 'Loading…')}</p>

  const alertsTotal = Object.values(data.alerts.byStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('پنل مدیریت', 'Admin panel')}</h1>

      <Section title={t('کاربران', 'Users')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('کل کاربران', 'Total users')} value={data.users.total} lang={lang} big />
          <Stat label={t('۲۴ ساعت اخیر', 'Last 24h')} value={data.users.new24h} lang={lang} />
          <Stat label={t('۷ روز اخیر', 'Last 7 days')} value={data.users.new7d} lang={lang} />
          <Stat label={t('۳۰ روز اخیر', 'Last 30 days')} value={data.users.new30d} lang={lang} />
          <Stat label={t('پرمیوم فعال', 'Premium')} value={data.users.premium} lang={lang} />
          <Stat label={t('تلگرام متصل', 'Telegram linked')} value={data.users.telegramLinked} lang={lang} />
        </div>
      </Section>

      <Section title={t('درآمد', 'Revenue')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('اشتراک فعال', 'Active subs')} value={data.subscriptions.active} lang={lang} />
          <Stat
            label={t('درآمد کل (تومان)', 'Total revenue (Toman)')}
            value={toman(data.subscriptions.revenueRial, lang)}
            lang={lang}
            raw
          />
          <Stat
            label={t('۳۰ روز اخیر (تومان)', 'Last 30 days (Toman)')}
            value={toman(data.subscriptions.revenue30dRial, lang)}
            lang={lang}
            raw
          />
        </div>
      </Section>

      <Section title={`${t('هشدارها', 'Alerts')} — ${fmtNum(alertsTotal, lang)}`}>
        <div className="space-y-3">
          <ChipRow
            items={Object.entries(data.alerts.byStatus).map(([k, v]) => ({
              label: statusInfo(k, lang).label,
              cls: statusInfo(k, lang).cls,
              value: v,
            }))}
            lang={lang}
          />
          <ChipRow
            items={Object.entries(data.alerts.byType).map(([k, v]) => ({
              label: TYPE_LABEL[k]?.[lang] ?? k,
              cls: 'bg-slate-800 text-slate-300',
              value: v,
            }))}
            lang={lang}
          />
          <ChipRow
            items={Object.entries(data.alerts.byMarket).map(([k, v]) => ({
              label: MARKET_LABEL[k]?.[lang] ?? k,
              cls: 'bg-slate-800 text-slate-300',
              value: v,
            }))}
            lang={lang}
          />
        </div>
      </Section>

      <Section title={t('پرطرفدارترین ارزها', 'Top symbols')}>
        {data.alerts.topSymbols.length === 0 ? (
          <Empty t={t} />
        ) : (
          <ul className="space-y-2">
            {data.alerts.topSymbols.map((s) => (
              <li key={s.symbol} className="flex items-center gap-3">
                <CoinIcon base={baseOf(s.symbol)} size={24} />
                <span className="font-medium" dir="ltr">
                  {s.symbol}
                </span>
                <span className="ms-auto text-slate-400">{fmtNum(s.count, lang)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('اعلان‌های ۲۴ ساعت اخیر', 'Notifications (24h)')}>
        <div className="flex flex-wrap items-center gap-4">
          {['sent', 'failed', 'pending'].map((k) => (
            <div key={k} className="flex items-baseline gap-2">
              <span className={`text-lg font-bold ${NOTIF_LABEL[k].cls}`}>
                {fmtNum(data.notifications.last24h[k] ?? 0, lang)}
              </span>
              <span className="text-sm text-slate-400">{NOTIF_LABEL[k][lang]}</span>
            </div>
          ))}
          <span className="ms-auto text-xs text-slate-500">
            {t('کل از ابتدا: ', 'All time: ')}
            {fmtNum(data.notifications.total, lang)}
          </span>
        </div>
      </Section>

      <Section title={t('آخرین ثبت‌نام‌ها', 'Recent signups')}>
        {data.recentUsers.length === 0 ? (
          <Empty t={t} />
        ) : (
          <ul className="divide-y divide-slate-800">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="truncate" dir="ltr">
                  {u.email}
                </span>
                {u.plan === 'paid' && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">{t('پرمیوم', 'Premium')}</span>
                )}
                <span className="ms-auto shrink-0 text-xs text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  lang,
  big,
  raw,
}: {
  label: string
  value: number | string
  lang: 'fa' | 'en'
  big?: boolean
  raw?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className={`font-bold ${big ? 'text-3xl text-brand' : 'text-2xl'}`}>
        {raw ? value : fmtNum(value, lang)}
      </div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  )
}

function ChipRow({ items, lang }: { items: { label: string; cls: string; value: number }[]; lang: 'fa' | 'en' }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span key={i.label} className={`rounded-full px-3 py-1 text-xs ${i.cls}`}>
          {i.label} <span className="font-bold">{fmtNum(i.value, lang)}</span>
        </span>
      ))}
    </div>
  )
}

const Empty = ({ t }: { t: (fa: string, en: string) => string }) => (
  <p className="text-sm text-slate-500">{t('چیزی نیست', 'Nothing yet')}</p>
)
