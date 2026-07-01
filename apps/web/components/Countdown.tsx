'use client'
import { useEffect, useState } from 'react'
import { useLang, useT } from '@/lib/i18n'
import { fmtNum } from '@/lib/format'

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

// Live countdown to `endsAt`. Renders nothing until mounted (Date.now can't run
// on the server without a hydration mismatch).
export function Countdown({ endsAt }: { endsAt: string }) {
  const t = useT()
  const { lang } = useLang()
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    const end = new Date(endsAt).getTime()
    const tick = () => setMs(end - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  if (ms == null) return null
  const { d, h, m, s } = split(ms)
  const pad = lang === 'fa' ? '۰' : '0'
  const cell = (v: number) => fmtNum(v, lang).padStart(2, pad)
  const units: [string, string][] = [
    [cell(d), t('روز', 'days')],
    [cell(h), t('ساعت', 'hours')],
    [cell(m), t('دقیقه', 'min')],
    [cell(s), t('ثانیه', 'sec')],
  ]

  return (
    <div dir="ltr" className="flex items-stretch gap-2">
      {units.map(([v, label], i) => (
        <div
          key={i}
          className="min-w-[3.5rem] rounded-xl bg-white/25 px-2 py-1.5 text-center ring-1 ring-white/40"
        >
          <div className="text-xl font-extrabold tabular-nums leading-none">{v}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
        </div>
      ))}
    </div>
  )
}
