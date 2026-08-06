'use client'
import { useState } from 'react'

// Icons are proxied through our origin (the icon CDNs are blocked in Iran); same base as the API.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export function CoinIcon({ base, size = 28 }: { base: string; size?: number }) {
  const [err, setErr] = useState(false)
  const src = `${API}/api/symbols/icon/${base.toLowerCase()}`
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
    // Plenty of coin logos are a dark glyph on a transparent background, which
    // disappears completely against the dark theme. A white disc behind every
    // icon fixes those without touching the rest: logos that carry their own
    // filled circle cover it entirely, so only the transparent ones show it.
    <span
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-950/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={size}
        height={size}
        alt={base}
        onError={() => setErr(true)}
        className="h-full w-full object-contain"
      />
    </span>
  )
}
