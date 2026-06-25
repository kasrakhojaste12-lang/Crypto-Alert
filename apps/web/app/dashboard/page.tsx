'use client'
import Link from 'next/link'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { describeAlert, faNum, baseOf, STATUS_FA, REPEAT_FA, type AlertShape } from '@/lib/format'

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
  const limit = user?.freeLimit ?? 3
  const paid = user?.plan === 'paid'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">هشدارهای من</h1>
        <Link
          href="/alerts/new"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-dark"
        >
          + ساخت هشدار
        </Link>
      </div>

      {/* Free-tier counter */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {paid ? (
          <p className="text-sm text-brand">اشتراک فعال — هشدار نامحدود</p>
        ) : (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">
                {faNum(Math.min(used, limit))} از {faNum(limit)} هشدار رایگان
              </span>
              {used >= limit && (
                <Link href="/billing" className="text-brand">
                  ارتقا ←
                </Link>
              )}
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Alerts list */}
      {!alerts ? (
        <p className="text-slate-500 text-sm">در حال بارگذاری…</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
          <p className="text-slate-400">هنوز هشداری نساخته‌اید.</p>
          <Link href="/alerts/new" className="text-brand text-sm">
            اولین هشدار خود را بسازید ←
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const st = STATUS_FA[a.status] ?? { label: a.status, cls: 'bg-slate-700 text-slate-300' }
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
                  <p className="text-sm text-slate-400 mt-0.5">{describeAlert(a)}</p>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{REPEAT_FA[a.repeat]}</span>
                    <span>·</span>
                    <span>{a.channels.map((c) => CHANNEL_ICON[c.type] ?? c.type).join(' ')}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {a.status !== 'triggered' && (
                    <>
                      <button onClick={() => toggle(a)} className="text-slate-400 hover:text-white">
                        {a.status === 'paused' ? 'فعال‌سازی' : 'توقف'}
                      </button>
                      <Link href={`/alerts/${a.id}/edit`} className="text-slate-400 hover:text-white">
                        ویرایش
                      </Link>
                    </>
                  )}
                  <button onClick={() => remove(a.id)} className="text-slate-500 hover:text-rose-400">
                    حذف
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
