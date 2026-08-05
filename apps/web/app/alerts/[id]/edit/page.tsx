'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useLang, useT } from '@/lib/i18n'
import { Shell } from '@/components/Shell'
import { CoinIcon } from '@/components/CoinIcon'
import { describeAlert, baseOf, type AlertShape } from '@/lib/format'

interface Alert extends AlertShape {
  id: string
  note?: string | null
}

const NOTE_MAX = 500

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
  const t = useT()
  const { lang } = useLang()
  const { data: alerts } = useSWR<Alert[]>('/api/alerts', api)
  const alert = alerts?.find((a) => a.id === id)
  // null until the user types: the fields show the alert's current values, but
  // the alert only arrives after the request resolves, so they cannot be seeded
  // in useState.
  const [edited, setEdited] = useState<string | null>(null)
  const [editedNote, setEditedNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!alerts) return <p className="text-slate-500 text-sm">{t('در حال بارگذاری…', 'Loading…')}</p>
  if (!alert) return <p className="text-slate-400">{t('هشدار یافت نشد.', 'Alert not found.')}</p>

  const base = baseOf(alert.symbol)
  const target = edited ?? String(alert.target)
  const note = editedNote ?? alert.note ?? ''

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ target: Number(target), note: note.trim() || null }),
      })
      router.push('/dashboard')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">
          {t('هشدارها', 'Alerts')}
        </Link>
        <span>/</span>
        <span className="text-white">{t('ویرایش', 'Edit')}</span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <CoinIcon base={base} size={36} />
          <div>
            <p className="font-semibold">{alert.symbol}</p>
            <p className="text-sm text-slate-400">{describeAlert(alert, lang)}</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">
              {alert.type === 'price' ? t('قیمت هدف جدید', 'New target price') : t('درصد هدف جدید', 'New target percent')}
            </label>
            <input
              type="number"
              step="any"
              required
              value={target}
              onChange={(e) => setEdited(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">{t('یادداشت (اختیاری)', 'Note (optional)')}</label>
            <textarea
              value={note}
              onChange={(e) => setEditedNote(e.target.value)}
              rows={3}
              maxLength={NOTE_MAX}
              placeholder={t('مثلاً: ۳۰٪ پوزیشن را ببند و حد ضرر را به نقطه ورود بیاور', 'e.g. Close 30% of the position and move the stop to entry')}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-500">
                {t(
                  'این یادداشت همراه اعلان برای شما فرستاده می‌شود.',
                  'Sent to you along with the notification.',
                )}
              </p>
              <span dir="ltr" className="shrink-0 text-xs text-slate-600">
                {note.length}/{NOTE_MAX}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? t('در حال ذخیره…', 'Saving…') : t('ذخیره', 'Save')}
          </button>
        </form>
        <p className="text-xs text-slate-500">
          {t(
            'برای تغییر نماد، نوع یا کانال‌ها، هشدار را حذف و دوباره بسازید.',
            'To change the pair, type, or channels, delete the alert and create a new one.',
          )}
        </p>
      </div>
    </div>
  )
}
