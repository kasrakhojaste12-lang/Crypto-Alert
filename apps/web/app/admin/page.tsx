'use client'
import useSWR from 'swr'
import { api, type ApiError } from '@/lib/api'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { fmtNum, toman, baseOf, statusInfo } from '@/lib/format'

type PlanId = 'free' | 'pro' | 'gold'

interface Stats {
  users: {
    total: number
    new24h: number
    new7d: number
    new30d: number
    telegramLinked: number
    premium: number
    byPlan: Record<PlanId, number>
  }
  alerts: {
    byStatus: Record<string, number>
    byType: Record<string, number>
    byMarket: Record<string, number>
    topSymbols: { symbol: string; count: number }[]
  }
  subscriptions: { active: number; revenueRial: number; revenue30dRial: number }
  notifications: { last24h: Record<string, number>; total: number }
  recentUsers: { id: string; email: string; plan: PlanId; createdAt: string; hasTelegram: boolean }[]
}

export default function AdminPage() {
  return (
    <Shell>
      <Admin />
    </Shell>
  )
}

// ─── label maps ──────────────────────────────────────────────────────────────

const PLAN_META: Record<PlanId, { fa: string; en: string; cls: string; dot: string }> = {
  free: { fa: 'رایگان',   en: 'Free',  cls: 'bg-slate-700/60 text-slate-300',      dot: 'bg-slate-500' },
  pro:  { fa: 'پرو',      en: 'Pro',   cls: 'bg-blue-500/15 text-blue-400',         dot: 'bg-blue-400' },
  gold: { fa: 'طلایی',   en: 'Gold',  cls: 'bg-amber-500/15 text-amber-400',       dot: 'bg-amber-400' },
}

const TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  price:        { fa: 'قیمت',           en: 'Price' },
  percent:      { fa: 'درصد',           en: 'Percent' },
  candle_close: { fa: 'بسته‌شدن کندل', en: 'Candle close' },
}
const MARKET_LABEL: Record<string, { fa: string; en: string }> = {
  spot:    { fa: 'اسپات',   en: 'Spot' },
  futures: { fa: 'فیوچرز', en: 'Futures' },
}
const NOTIF_META: Record<string, { fa: string; en: string; cls: string }> = {
  sent:    { fa: 'ارسال‌شده', en: 'Sent',    cls: 'text-brand' },
  failed:  { fa: 'ناموفق',   en: 'Failed',  cls: 'text-rose-400' },
  pending: { fa: 'در صف',    en: 'Pending', cls: 'text-amber-400' },
}

// ─── main component ──────────────────────────────────────────────────────────

function Admin() {
  const t = useT()
  const { lang } = useLang()
  const { data, error } = useSWR<Stats>('/api/admin/stats', api, {
    refreshInterval: 30_000,
    shouldRetryOnError: false,
  })

  if ((error as ApiError | undefined)?.status === 403)
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <p className="text-2xl">🔒</p>
        <p className="mt-3 text-slate-300">
          {t('دسترسی به این بخش ندارید.', 'You do not have access to this page.')}
        </p>
      </div>
    )
  if (error)
    return <p className="text-rose-400">{t('خطا در بارگذاری آمار', 'Failed to load stats')}</p>
  if (!data)
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-800/60" />
        ))}
      </div>
    )

  const alertsTotal = Object.values(data.alerts.byStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('پنل مدیریت', 'Admin panel')}</h1>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
          {t('بروزرسانی هر ۳۰ ثانیه', 'Refreshes every 30s')}
        </span>
      </div>

      {/* ── Users ── */}
      <Section title={t('کاربران', 'Users')} icon="👤">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('کل', 'Total')}            value={data.users.total}          lang={lang} accent />
          <Stat label={t('۲۴ ساعت',  'Last 24h')}  value={data.users.new24h}         lang={lang} />
          <Stat label={t('۷ روز',    'Last 7d')}   value={data.users.new7d}          lang={lang} />
          <Stat label={t('۳۰ روز',   'Last 30d')}  value={data.users.new30d}         lang={lang} />
          <Stat label={t('پرمیوم',   'Premium')}   value={data.users.premium}        lang={lang} />
          <Stat label={t('تلگرام',   'Telegram')}  value={data.users.telegramLinked} lang={lang} />
        </div>

        {/* plan breakdown */}
        <div className="mt-4 flex flex-wrap gap-3">
          {(['free', 'pro', 'gold'] as PlanId[]).map((p) => {
            const meta = PLAN_META[p]
            const count = data.users.byPlan[p] ?? 0
            const pct = data.users.total > 0
              ? Math.round((count / data.users.total) * 100)
              : 0
            return (
              <div key={p} className={`flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex-1 min-w-[7rem]`}>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <div>
                  <div className="text-lg font-bold">{fmtNum(count, lang)}</div>
                  <div className="text-xs text-slate-400">
                    {meta[lang]} · {fmtNum(pct, lang)}٪
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Revenue ── */}
      <Section title={t('درآمد', 'Revenue')} icon="💰">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('اشتراک فعال', 'Active subs')}          value={data.subscriptions.active}           lang={lang} />
          <Stat label={t('درآمد کل (تومان)', 'Total (Toman)')}   value={toman(data.subscriptions.revenueRial, lang)}    lang={lang} raw />
          <Stat label={t('۳۰ روز (تومان)', 'Last 30d (Toman)')} value={toman(data.subscriptions.revenue30dRial, lang)}  lang={lang} raw />
        </div>
      </Section>

      {/* ── Alerts ── */}
      <Section title={`${t('هشدارها', 'Alerts')} — ${fmtNum(alertsTotal, lang)}`} icon="🔔">
        <div className="space-y-3">
          <ChipRow
            items={Object.entries(data.alerts.byStatus).map(([k, v]) => ({
              label: statusInfo(k, lang).label,
              cls:   statusInfo(k, lang).cls,
              value: v,
            }))}
            lang={lang}
          />
          <ChipRow
            items={Object.entries(data.alerts.byType).map(([k, v]) => ({
              label: TYPE_LABEL[k]?.[lang] ?? k,
              cls:   'bg-slate-800 text-slate-300',
              value: v,
            }))}
            lang={lang}
          />
          {Object.keys(data.alerts.byMarket).length > 0 && (
            <ChipRow
              items={Object.entries(data.alerts.byMarket).map(([k, v]) => ({
                label: MARKET_LABEL[k]?.[lang] ?? k,
                cls:   'bg-slate-800 text-slate-300',
                value: v,
              }))}
              lang={lang}
            />
          )}
        </div>
      </Section>

      {/* ── Top symbols ── */}
      <Section title={t('پرطرفدارترین ارزها', 'Top symbols')} icon="📊">
        {data.alerts.topSymbols.length === 0 ? (
          <Empty t={t} />
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {data.alerts.topSymbols.map((s, i) => (
              <li key={s.symbol} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-center text-xs text-slate-600">{i + 1}</span>
                <CoinIcon base={baseOf(s.symbol)} size={24} />
                <span className="font-medium" dir="ltr">{s.symbol}</span>
                <div className="ms-auto flex items-center gap-2">
                  <div
                    className="h-1.5 rounded-full bg-brand/40"
                    style={{ width: `${Math.round((s.count / data.alerts.topSymbols[0].count) * 64)}px` }}
                  />
                  <span className="w-8 text-end text-slate-400">{fmtNum(s.count, lang)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Notifications ── */}
      <Section title={t('اعلان‌های ۲۴ ساعت اخیر', 'Notifications (24h)')} icon="📨">
        <div className="flex flex-wrap items-center gap-5">
          {(['sent', 'failed', 'pending'] as const).map((k) => (
            <div key={k} className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${NOTIF_META[k].cls}`}>
                {fmtNum(data.notifications.last24h[k] ?? 0, lang)}
              </span>
              <span className="text-sm text-slate-400">{NOTIF_META[k][lang]}</span>
            </div>
          ))}
          <span className="ms-auto text-xs text-slate-500">
            {t('کل از ابتدا: ', 'All time: ')}
            <span className="font-semibold text-slate-400">{fmtNum(data.notifications.total, lang)}</span>
          </span>
        </div>
      </Section>

      {/* ── Recent signups ── */}
      <Section title={t('آخرین ثبت‌نام‌ها', 'Recent signups')} icon="🆕">
        {data.recentUsers.length === 0 ? (
          <Empty t={t} />
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {data.recentUsers.map((u) => {
              const meta = PLAN_META[u.plan] ?? PLAN_META.free
              return (
                <li key={u.id} className="flex items-center gap-3 py-2.5 text-sm">
                  {/* telegram dot */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      u.hasTelegram ? 'bg-sky-400' : 'bg-slate-700'
                    }`}
                    title={u.hasTelegram
                      ? (lang === 'fa' ? 'تلگرام متصل' : 'Telegram linked')
                      : (lang === 'fa' ? 'بدون تلگرام'  : 'No Telegram')}
                  />
                  <span className="truncate" dir="ltr">{u.email}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${meta.cls}`}>
                    {meta[lang]}
                  </span>
                  <span className="ms-auto shrink-0 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString(
                      lang === 'fa' ? 'fa-IR' : 'en-US',
                      { month: 'short', day: 'numeric' },
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

// ─── shared sub-components ───────────────────────────────────────────────────

function Section({
  title, icon, children,
}: {
  title: string; icon?: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-400">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({
  label, value, lang, accent, raw,
}: {
  label: string; value: number | string; lang: 'fa' | 'en'; accent?: boolean; raw?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className={`font-bold tabular-nums ${
        accent ? 'text-3xl text-brand' : 'text-2xl text-slate-100'
      }`}>
        {raw ? value : fmtNum(Number(value), lang)}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  )
}

function ChipRow({
  items, lang,
}: { items: { label: string; cls: string; value: number }[]; lang: 'fa' | 'en' }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span key={i.label} className={`rounded-full px-3 py-1 text-xs ${i.cls}`}>
          {i.label}{' '}<span className="font-bold">{fmtNum(i.value, lang)}</span>
        </span>
      ))}
    </div>
  )
}

const Empty = ({ t }: { t: (fa: string, en: string) => string }) => (
  <p className="text-sm text-slate-500">{t('چیزی نیست', 'Nothing yet')}</p>
)
