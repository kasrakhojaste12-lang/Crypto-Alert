'use client'
import { useState } from 'react'

export function CoinIcon({ base, size = 28 }: { base: string; size?: number }) {
  const [err, setErr] = useState(false)
  const src = `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`
  if (err)
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-700 grid place-items-center text-[10px] font-bold text-slate-300 shrink-0"
      >
        {base.slice(0, 3)}
      </div>
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt={base}
      onError={() => setErr(true)}
      className="rounded-full shrink-0"
    />
  )
}
