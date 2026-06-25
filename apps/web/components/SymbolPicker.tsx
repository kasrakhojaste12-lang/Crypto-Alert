'use client'
import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { faPrice } from '@/lib/format'
import { CoinIcon } from './CoinIcon'

interface Sym {
  symbol: string
  base: string
  quote: string
}

export function SymbolPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const { data: symbols } = useSWR<Sym[]>('/api/symbols', api)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!symbols) return []
    const term = q.trim().toUpperCase()
    const list = term ? symbols.filter((s) => s.symbol.includes(term) || s.base.includes(term)) : symbols
    return list.slice(0, 50)
  }, [symbols, q])

  const selected = symbols?.find((s) => s.symbol === value)

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-right hover:border-slate-600"
      >
        {selected ? (
          <>
            <CoinIcon base={selected.base} />
            <span className="font-semibold">{selected.symbol}</span>
            <LivePrice symbol={selected.symbol} />
          </>
        ) : (
          <span className="text-slate-400">انتخاب نماد…</span>
        )}
        <span className="ms-auto text-slate-500">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو… مثلاً BTC"
            className="w-full bg-transparent border-b border-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => {
                  onChange(s.symbol)
                  setOpen(false)
                  setQ('')
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 text-right"
              >
                <CoinIcon base={s.base} size={22} />
                <span>{s.symbol}</span>
                <span className="ms-auto text-xs text-slate-500">{s.quote}</span>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-4 text-sm text-slate-500">نمادی یافت نشد</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export function LivePrice({ symbol }: { symbol: string }) {
  const { data } = useSWR<{ price: number }>(
    symbol ? `/api/symbols/price/${symbol}` : null,
    api,
    { refreshInterval: 5000, shouldRetryOnError: false },
  )
  if (!data) return <span className="ms-auto text-xs text-slate-500">—</span>
  return <span className="ms-auto text-sm text-brand tabular-nums">{faPrice(data.price)}</span>
}
