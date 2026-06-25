'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { describeAlert, baseOf, type AlertShape } from '@/lib/format'

interface Alert extends AlertShape {
  id: string
}

export default function EditAlertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Shell>
      <EditAlert id={id} />
    </Shell>
  )
}

function EditAlert({ id }: { id: string }) {
  const router = useRouter()
  const { data: alerts } = useSWR<Alert[]>('/api/alerts', api)
  const alert = alerts?.find((a) => a.id === id)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)

  if (!alerts) return <p className="text-slate-500 text-sm">در حال بارگذاری…</p>
  if (!alert) return <p className="text-slate-400">هشدار یافت نشد.</p>

  const base = baseOf(alert.symbol)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ target: Number(target) }) })
      router.push('/dashboard')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">
          هشدارها
        </Link>
        <span>/</span>
        <span className="text-white">ویرایش</span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <CoinIcon base={base} size={36} />
          <div>
            <p className="font-semibold">{alert.symbol}</p>
            <p className="text-sm text-slate-400">{describeAlert(alert)}</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">
              {alert.type === 'price' ? 'قیمت هدف جدید' : 'درصد هدف جدید'}
            </label>
            <input
              type="number"
              step="any"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={String(alert.target)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          برای تغییر نماد، نوع یا کانال‌ها، هشدار را حذف و دوباره بسازید.
        </p>
      </div>
    </div>
  )
}
