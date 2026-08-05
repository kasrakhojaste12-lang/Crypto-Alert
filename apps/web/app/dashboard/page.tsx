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
  channels: { type: string; identifier: string }[]
}

type DirectionFilter = 'all' | 'above' | 'below'

const CHANNEL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  telegram: TelegramIcon,
  discord: DiscordIcon,
  email: EmailIcon,
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
    refreshInterval: 5000,
    onSuccess: () => void mutateUser(),
  })
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [direction, setDirection] = useState<DirectionFilter>('all')

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
            : t('برای بازنشانی این هشدار باید اشتراک را ارتقا دهید.', 'Upgrade your plan to reset this alert.')
          : t('بازنشانی هشدار انجام نشد.', 'Failed to reset the alert.'),
      )
    } finally {
      setResetting(null)
    }
  }

  const used = user?.activeAlerts ?? 0
  const limit = user?.alertLimit ?? 3
  const paid = user?.plan === 'paid'

  const all = alerts ?? []
  const aboveCount = all.filter((a) => a.direction === 'above').length
  const belowCount = all.filter((a) => a.direction === 'below').length
  const visible = direction === 'all' ? all : all.filter((a) => a.direction === direction)

  const FILTERS: { value: DirectionFilter; label: string; count: number; icon?: ComponentType<{ className?: string }> }[] = [
    { value: 'all', label: t('همه', 'All'), count: all.length },
    { value: 'above', label: t('بالاتر از', 'Above'), count: aboveCount, icon: ArrowUpIcon },
    { value: 'below', label: t('پایین‌تر از', 'Below'), count: belowCount, icon: ArrowDownIcon },
  ]

  return (
    <div className="space-y-6">
      <TelegramBanner className="rounded-2xl" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('هشدارهای من', 'My alerts')}</h1>
        <Link
          href="/alerts/new"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-dark"
        >
          {t('+ ساخت هشدار', '+ New alert')}
        </Link>
      </div>

      {/* Alert-count meter */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-300">
            {paid
              ? t(
                  `${fmtNum(Math.min(used, limit), lang)} از ${fmtNum(limit, lang)} هشدار`,
                  `${fmtNum(Math.min(used, limit), lang)} of ${fmtNum(limit, lang)} alerts`,
                )
              : t(
                  `${fmtNum(Math.min(used, limit), lang)} از ${fmtNum(limit, lang)} هشدار رایگان`,
                  `${fmtNum(Math.min(used, limit), lang)} of ${fmtNum(limit, lang)} free alerts`,
                )}
          </span>
          {!paid && used >= limit && (
            <Link href="/billing" className="text-brand">
              {t('ارتقا ←', 'Upgrade →')}
            </Link>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
          />
        </div>
      </div>

      {/* Direction filter — only useful once there is something to filter */}
      {all.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <p className="text-sm text-slate-400">{t('فیلتر بر اساس جهت', 'Filter by direction')}</p>
          <div role="group" aria-label={t('فیلتر بر اساس جهت', 'Filter by direction')} className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const Icon = f.icon
              const on = direction === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setDirection(f.value)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
                    on
                      ? 'border-brand bg-brand/15 font-semibold text-brand'
                      : 'border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{f.label}</span>
                  <span className="rounded-full bg-slate-800 px-1.5 text-xs text-slate-400">{fmtNum(f.count, lang)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerts list */}
      {resetError && <p role="alert" className="text-sm text-rose-400">{resetError}</p>}
      {!alerts ? (
        <p className="text-slate-500 text-sm">{t('در حال بارگذاری…', 'Loading…')}</p>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
          <p className="text-slate-400">{t('هنوز هشداری نساخته‌اید.', "You haven't created any alerts yet.")}</p>
          <Link href="/alerts/new" className="text-brand text-sm">
            {t('اولین هشدار خود را بسازید ←', 'Create your first alert →')}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
          <p className="text-slate-400">
            {t('هشداری با این جهت وجود ندارد.', 'No alerts with this direction.')}
          </p>
          <button onClick={() => setDirection('all')} className="text-brand text-sm">
            {t('نمایش همه', 'Show all')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const st = statusInfo(a.status, lang)
            const base = baseOf(a.symbol)
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-center gap-4"
              >
                <CoinIcon base={base} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <DirectionBadge
                      direction={a.direction}
                      label={a.direction === 'above' ? t('بالاتر از', 'Above') : t('پایین‌تر از', 'Below')}
                    />
                    <span className="font-semibold">{a.symbol}</span>
                    {a.market === 'futures' && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        {t('فیوچرز', 'Futures')}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{describeAlert(a, lang)}</p>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{repeatLabel(a.repeat, lang, a.maxFires)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      {a.channels.map((c) => {
                        const Icon = CHANNEL_ICON[c.type]
                        return Icon ? (
                          <span key={c.type} title={c.type} className="inline-flex">
                            <Icon className="h-4 w-4" />
                          </span>
                        ) : (
                          <span key={c.type}>{c.type}</span>
                        )
                      })}
                    </span>
                  </div>
                </div>
                <div className={`flex gap-2 text-xs ${a.status === 'triggered' ? 'items-center' : 'flex-col'}`}>
                  {a.status !== 'triggered' && (
                    <>
                      <button onClick={() => toggle(a)} className="text-slate-400 hover:text-white">
                        {a.status === 'paused' ? t('فعال‌سازی', 'Activate') : t('توقف', 'Pause')}
                      </button>
                      <Link href={`/alerts/${a.id}/edit`} className="text-slate-400 hover:text-white">
                        {t('ویرایش', 'Edit')}
                      </Link>
                    </>
                  )}
                  {a.status === 'triggered' && (
                    <button
                      onClick={() => reset(a.id)}
                      disabled={resetting === a.id}
                      className="text-brand hover:text-brand-dark disabled:opacity-50"
                    >
                      {resetting === a.id ? '…' : t('بازنشانی', 'Reset')}
                    </button>
                  )}
                  <button onClick={() => remove(a.id)} className="text-slate-500 hover:text-rose-400">
                    {t('حذف', 'Delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DirectionBadge({ direction, label }: { direction: 'above' | 'below'; label: string }) {
  const up = direction === 'above'
  const Icon = up ? ArrowUpIcon : ArrowDownIcon
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  )
}
