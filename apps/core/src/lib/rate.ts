import { log } from './log'

// USDT→Toman rate from Wallex (Iranian exchange, reachable from abroad — Nobitex
// geo-fences its DNS so it is not). Refreshed hourly; kept in memory.
// ponytail: single-instance in-memory cache; if core restarts it refetches on boot.
const WALLEX_URL = 'https://api.wallex.ir/v1/markets'
const FALLBACK = Number(process.env.USDT_TOMAN_FALLBACK || 172000) // Toman per USDT
const REFRESH_MS = 60 * 60 * 1000 // 1 hour

let tomanPerUsdt = FALLBACK
let updatedAt: Date | null = null

export async function fetchRate(): Promise<void> {
  try {
    const r = await fetch(WALLEX_URL, { signal: AbortSignal.timeout(15_000) })
    const data: any = await r.json()
    const price = Number(data?.result?.symbols?.USDTTMN?.stats?.lastPrice)
    if (!Number.isFinite(price) || price <= 0) throw new Error('bad price in wallex response')
    tomanPerUsdt = price
    updatedAt = new Date()
    log.info({ tomanPerUsdt }, 'usdt/toman rate updated (wallex)')
  } catch (e) {
    log.warn({ err: String(e), keeping: tomanPerUsdt }, 'wallex rate fetch failed; keeping last value')
  }
}

export function startRatePolling(): void {
  void fetchRate()
  setInterval(() => void fetchRate(), REFRESH_MS)
}

export function getRate(): { tomanPerUsdt: number; updatedAt: Date | null } {
  return { tomanPerUsdt, updatedAt }
}
