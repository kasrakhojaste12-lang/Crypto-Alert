'use client'
import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { api, type ApiError } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { TelegramBanner } from '@/components/TelegramBanner'
import { TelegramIcon, DiscordIcon, EmailIcon } from '@/components/BrandIcons'
import { ArrowUpIcon, ArrowDownIcon } from '@/components/Icons'
import { describeAlert, fmtNum, baseOf, statusInfo, repeatLabel, type AlertShape } from '@/lib/format'

interface Alert extends AlertShape {
  id: string
  note?: string | null
  channels: { type: string; identifier: string }[]
}

type AlertFilter = 'all' | 'above' | 'below' | 'triggered' | 'paused'

const CHANNEL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  telegram: TelegramIcon,
  discord:  DiscordIcon,
  email:    EmailIcon,
}

export default function DashboardPage() {
  return (
    <Shell>
      <Dashboard />
    </Shell>
  )
}

function Dashboard() {
  const { user, mutate: mutateUser } = useUser()
  const t = useT()
  const { lang } = useLang()
  const { data: alerts, mutate } = useSWR<Alert[]>('/api/alerts', api, {
    refreshInterval: 5_000,
    onSuccess: () => void mutateUser(),
  })
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AlertFilter>('all')

  async function toggle(a: Alert) {
    const status = a.status === 'paused' ? 'active' : 'paused'
    await api(`/api/alerts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    mutate()
  }
  async function remove(id: string) {
    await api(`/api/alerts/${id}`, { method: 'DELETE' })
    await Promise.all([mutate(), mutateUser()])
  }
  async function reset(id: string) {
    setResetting(id)
    setResetError(null)
    try {
      await api(`/api/alerts/${id}/reset`, { method: 'POST' })
      await Promise.all([mutate(), mutateUser()])
    } catch (e) {
      const err = e as ApiError
      setResetError(
        err.status === 402
          ? err.message === 'limit_reached'
            ? t('به سقف هشدارهای فعال رسیده‌اید.', 'You have reached your active-alert limit.')
            : t('برای بازنشانی باید اشتراک را ارتقا دهید.', 'Upgrade your plan to reset this alert.')
          : t('بازنشانی هشدار انجام نشد.', 'Failed to reset the alert.'),
      )
    } finally {
      setResetting(null)
    }
  }

  const used   = user?.activeAlerts ?? 0
  const limit  = user?.alertLimit   ?? 3
  const plan   = (user?.plan ?? 'free') as string
  const isPaid = plan === 'paid' || plan === 'pro' || plan === 'gold'

  const all = alerts ?? []
  const byStatus = (s: string)  => all.filter((a) => a.status    === s).length
  const byDir    = (d: string)  => all.filter((a) => a.direction === d).length

  const activeCount    = byStatus('active')
  const triggeredCount = byStatus('triggered')
  const pausedCount    = byStatus('paused')

  const matches = (a: Alert, f: AlertFilter) => {
    if (f === 'all')       return true
    if (f === 'triggered') return a.status === 'triggered'
    if (f === 'paused')    return a.status === 'paused'
    return a.direction === f
  }
  const visible = all.filter((a) => matches(a, filter))

  const FILTERS: { value: AlertFilter; label: string; count: number }[] = [
    { value: 'all',       label: t('همه',          'All'),       count: all.length },
    { value: 'above',     label: t('↑ بالاتر',  '\u2191 Above'),   count: byDir('above') },
    { value: 'below',     label: t('↓ پایین‌تر', '\u2193 Below'),   count: byDir('below') },
    { value: 'triggered', label: t('🔔 اجرا شده', 'Fired'),     count: triggeredCount },
    { value: 'paused',    label: t('⏸ متوقف',    'Paused'),    count: pausedCount },
  ]

  const pct = Math.min(100, (used / limit) * 100)
  const isHot = pct >= 90

  return (
    <div className="space-y-5">
      <TelegramBanner className="rounded-2xl" />

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">{t('هشدارهای من', 'My Alerts')}</span>
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            {t('آپدیت خودکار هر ۵ ثانیه', 'Live — updates every 5 s')}
          </p>
        </div>
        <Link
          href="/alerts/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-brand/20 transition hover:bg-brand-dark hover:shadow-brand/30 shrink-0"
        >
          <span>+</span> {t('هشدار جدید', 'New Alert')}
        </Link>
      </div>

      {/* ===== QUICK STATS ROW ===== */}
      {all.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatChip
            value={activeCount}
            label={t('فعال', 'Active')}
            color="emerald"
            lang={lang}
          />
          <StatChip
            value={triggeredCount}
            label={t('اجرا شده', 'Fired')}
            color="amber"
            lang={lang}
          />
          <StatChip
            value={pausedCount}
            label={t('متوقف', 'Paused')}
            color="slate"
            lang={lang}
          />
        </div>
      )}

      {/* ===== QUOTA BAR ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 backdrop-blur-sm">
        {/* bg decoration */}
        <div className="pointer-events-none absolute -end-6 -top-6 h-20 w-20 rounded-full bg-brand/8 blur-2xl" />

        <div className="relative mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono font-semibold text-slate-200">
              {fmtNum(Math.min(used, limit), lang)}
              <span className="text-slate-600"> / {fmtNum(limit, lang)}</span>
            </span>
            <span className="text-slate-500">
              {isPaid ? t('هشدار', 'alerts') : t('هشدار رایگان', 'free alerts')}
            </span>
          </div>
          {!isPaid && used >= limit && (
            <Link
              href="/billing"
              className="text-xs font-bold text-brand transition hover:text-brand-dark"
            >
              {t('ارتقا پلن ←', 'Upgrade →')}
            </Link>
          )}
        </div>

        {/* gradient progress bar */}
        <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: isHot
                ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                : 'linear-gradient(90deg,#10b981,#06b6d4)',
              boxShadow: isHot
                ? '0 0 10px rgba(239,68,68,0.5)'
                : '0 0 10px rgba(16,185,129,0.4)',
            }}
          />
        </div>
      </div>

      {/* ===== FILTERS ===== */}
      {all.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const on = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-all ${
                  on
                    ? 'border-brand/40 bg-brand/10 text-brand shadow-sm shadow-brand/10'
                    : 'border-white/[0.06] bg-slate-900/40 text-slate-500 hover:border-white/10 hover:text-slate-300'
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
                    on ? 'bg-brand/20 text-brand' : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {fmtNum(f.count, lang)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ===== ERROR ===== */}
      {resetError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
          {resetError}
        </div>
      )}

      {/* ===== ALERTS LIST ===== */}
      {!alerts ? (
        // skeleton
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-800/30" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState t={t} />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.06] p-10 text-center">
          <p className="text-slate-500">{t('هشداری با این فیلتر وجود ندارد.', 'No alerts match this filter.')}</p>
          <button onClick={() => setFilter('all')} className="mt-2 text-sm text-brand">
            {t('نمایش همه', 'Show all')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              lang={lang}
              t={t}
              resetting={resetting}
              onToggle={toggle}
              onReset={reset}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────── SUB-COMPONENTS ────────────────────

function StatChip({
  value, label, color, lang,
}: {
  value: number; label: string; color: 'emerald' | 'amber' | 'slate'; lang: 'fa' | 'en'
}) {
  const cls = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    amber:   'border-amber-500/20   bg-amber-500/5   text-amber-400',
    slate:   'border-white/[0.06]   bg-slate-900/40  text-slate-500',
  }[color]
  return (
    <div className={`rounded-xl border p-3 text-center backdrop-blur-sm ${cls}`}>
      <div className="text-2xl font-bold tabular-nums">{fmtNum(value, lang)}</div>
      <div className="mt-0.5 text-[11px] opacity-70">{label}</div>
    </div>
  )
}

function AlertCard({
  alert: a, lang, t, resetting, onToggle, onReset, onRemove,
}: {
  alert: Alert
  lang: 'fa' | 'en'
  t: (fa: string, en: string) => string
  resetting: string | null
  onToggle: (a: Alert) => void
  onReset: (id: string) => void
  onRemove: (id: string) => void
}) {
  const st          = statusInfo(a.status, lang)
  const base        = baseOf(a.symbol)
  const isUp        = a.direction === 'above'
  const isActive    = a.status === 'active'
  const isTriggered = a.status === 'triggered'
  const isPaused    = a.status === 'paused'

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 backdrop-blur-sm ${
        isTriggered
          ? 'border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-slate-950/60 to-slate-950/80'
          : isActive
          ? 'border-white/[0.07] bg-gradient-to-br from-slate-900/70 to-slate-950/80 hover:border-brand/20 hover:shadow-md hover:shadow-brand/5'
          : 'border-white/[0.04] bg-gradient-to-br from-slate-900/40 to-slate-950/60'
      }`}
    >
      {/* Left accent stripe */}
      <div
        className={`absolute inset-y-0 start-0 w-[3px] rounded-full transition-all ${
          isTriggered
            ? 'bg-amber-400 opacity-80'
            : isUp
            ? `bg-emerald-500 ${isActive ? 'opacity-100 pulse-green' : 'opacity-20'}`
            : `bg-rose-500 ${isActive ? 'opacity-100 pulse-red' : 'opacity-20'}`
        }`}
      />

      <div className="flex items-center gap-4 p-4 ps-5">
        {/* Coin + live dot */}
        <div className="relative shrink-0">
          <CoinIcon base={base} size={42} />
          {isActive && (
            <span
              className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${
                isUp ? 'bg-emerald-400' : 'bg-rose-400'
              } animate-pulse`}
            />
          )}
          {isTriggered && (
            <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-amber-400 animate-pulse" />
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Top row: symbol + badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold tracking-widest text-slate-100" dir="ltr">
              {a.symbol}
            </span>
            {a.market === 'futures' && (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-px text-[10px] font-bold text-amber-400">
                PERP
              </span>
            )}
            <DirectionPill direction={a.direction} t={t} />
            <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${st.cls}`}>
              {st.label}
            </span>
          </div>

          {/* Description — monospace for price */}
          <p className={`mt-1 text-sm font-mono ${
            isPaused ? 'text-slate-600' : 'text-slate-300'
          }`}>
            {describeAlert(a, lang)}
          </p>

          {/* Note */}
          {a.note && (
            <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
              <span aria-hidden>&#x1F4DD;</span>
              <span className="whitespace-pre-wrap break-words">{a.note}</span>
            </p>
          )}

          {/* Meta row: repeat + channels */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-600">
            <span>{repeatLabel(a.repeat, lang, a.maxFires)}</span>
            <span>&middot;</span>
            <span className="flex items-center gap-1.5">
              {a.channels.map((c) => {
                const Icon = CHANNEL_ICON[c.type]
                return Icon ? (
                  <span key={c.type} title={c.type} className="opacity-50 group-hover:opacity-80 transition-opacity">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span key={c.type}>{c.type}</span>
                )
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isTriggered && (
            <>
              <button
                onClick={() => onToggle(a)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isPaused
                    ? 'bg-brand/10 text-brand hover:bg-brand/20'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isPaused ? t('فعال‌سازی', 'Activate') : t('توقف', 'Pause')}
              </button>
              <Link
                href={`/alerts/${a.id}/edit`}
                className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-700 hover:text-white"
              >
                {t('ویرایش', 'Edit')}
              </Link>
            </>
          )}
          {isTriggered && (
            <button
              onClick={() => onReset(a.id)}
              disabled={resetting === a.id}
              className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
            >
              {resetting === a.id ? '…' : t('بازنشانی', 'Reset')}
            </button>
          )}
          <button
            onClick={() => onRemove(a.id)}
            className="rounded-lg px-3 py-1.5 text-xs text-slate-700 transition hover:bg-rose-500/10 hover:text-rose-400"
          >
            {t('حذف', 'Delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

function DirectionPill({
  direction, t,
}: {
  direction: 'above' | 'below'
  t: (fa: string, en: string) => string
}) {
  const up = direction === 'above'
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-px text-[10px] font-bold ${
        up
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-rose-500/15 text-rose-400'
      }`}
    >
      {up ? <ArrowUpIcon className="h-2.5 w-2.5" /> : <ArrowDownIcon className="h-2.5 w-2.5" />}
      {up ? t('بالاتر', 'Above') : t('پایین‌تر', 'Below')}
    </span>
  )
}

function EmptyState({ t }: { t: (fa: string, en: string) => string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.06] p-14 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-cyan-500/5 text-3xl ring-1 ring-white/10">
        🔔
      </div>
      <p className="font-semibold text-slate-300">
        {t('هنوز هشداری نساخته‌اید', 'No alerts yet')}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {t(
          'هشدار بساز و فوری اطلاع بگیر',
          'Set a price target and get notified the moment it hits',
        )}
      </p>
      <Link
        href="/alerts/new"
        className="mt-5 inline-flex rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
      >
        {t('ساخت هشدار ←', 'Create alert →')}
      </Link>
    </div>
  )
}
