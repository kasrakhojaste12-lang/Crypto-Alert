'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { describeAlert, fmtNum, baseOf, statusInfo, repeatLabel, type AlertShape } from '@/lib/format'

interface Alert extends AlertShape {
  id: string
  channels: { type: string; identifier: string }[]
}

const CHANNEL_ICON: Record<string, string> = { telegram: '✈️', discord: '🎮', email: '✉️' }

export default function DashboardPage() {
  return (
    <Shell>
      <Dashboard />
    </Shell>
  )
}

function Dashboard() {
  const { user } = useUser()
  const t = useT()
  const { lang } = useLang()
  const { data: alerts, mutate } = useSWR<Alert[]>('/api/alerts', api)

  async function toggle(a: Alert) {
    const status = a.status === 'paused' ? 'active' : 'paused'
    await api(`/api/alerts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    mutate()
  }
  async function remove(id: string) {
    await api(`/api/alerts/${id}`, { method: 'DELETE' })
    mutate()
  }

  const used = user?.activeAlerts ?? 0
  const limit = user?.alertLimit ?? 3
  const paid = user?.plan === 'paid'

  return (
    <div className="space-y-6">
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

      {/* Alerts list */}
      {!alerts ? (
        <p className="text-slate-500 text-sm">{t('در حال بارگذاری…', 'Loading…')}</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
          <p className="text-slate-400">{t('هنوز هشداری نساخته‌اید.', "You haven't created any alerts yet.")}</p>
          <Link href="/alerts/new" className="text-brand text-sm">
            {t('اولین هشدار خود را بسازید ←', 'Create your first alert →')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
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
                    <span className="font-semibold">{a.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{describeAlert(a, lang)}</p>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{repeatLabel(a.repeat, lang)}</span>
                    <span>·</span>
                    <span>{a.channels.map((c) => CHANNEL_ICON[c.type] ?? c.type).join(' ')}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
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
