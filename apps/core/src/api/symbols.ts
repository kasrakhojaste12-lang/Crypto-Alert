import { Router } from 'express'
import { log } from '../lib/log'
import { engine } from '../engine/match'

const router = Router()
const REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const REFRESH_MS = Number(process.env.SYMBOLS_REFRESH_MS || 3600_000)

type Sym = { symbol: string; base: string; quote: string }
let cache: Sym[] | null = null
let known = new Set<string>()

// Fetch every TRADING pair (USDT-quoted first) and update the cache. Returns any
// symbols that are new since the last refresh — i.e. pairs Binance just listed.
export async function refreshSymbols(): Promise<{ total: number; added: string[] }> {
  const [exRes, tkRes] = await Promise.all([
    fetch(`${REST}/api/v3/exchangeInfo`),
    fetch(`${REST}/api/v3/ticker/24hr?type=MINI`),
  ])
  if (!exRes.ok) throw new Error(`exchangeInfo ${exRes.status}`)
  const data = await exRes.json()
  // 24h quote volume per symbol, so the picker defaults to the most-traded pairs.
  // Best-effort: if the ticker call fails, fall back to the USDT-first alpha sort.
  const vol = new Map<string, number>()
  if (tkRes.ok) {
    for (const t of (await tkRes.json()) as any[]) vol.set(t.symbol, Number(t.quoteVolume) || 0)
  }
  const list: Sym[] = data.symbols
    .filter((s: any) => s.status === 'TRADING')
    .map((s: any) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }))
    .sort((a: Sym, b: Sym) => {
      // USDT pairs first: quoteVolume is only comparable within one quote asset
      // (an IDR-quoted pair's volume is a huge number just because IDR is tiny).
      const au = a.quote === 'USDT', bu = b.quote === 'USDT'
      if (au !== bu) return au ? -1 : 1
      const va = vol.get(a.symbol) ?? 0, vb = vol.get(b.symbol) ?? 0
      if (va !== vb) return vb - va // then most 24h volume first
      return a.symbol.localeCompare(b.symbol)
    })
  const current = new Set(list.map((s) => s.symbol))
  const added = known.size ? [...current].filter((s) => !known.has(s)) : []
  cache = list
  known = current
  return { total: list.length, added }
}

// Periodic refresher: newly-listed Binance pairs become selectable automatically.
// (The engine + WS feed already handle any symbol; this keeps the picker current.)
// Self-scheduling: retries quickly until the list is warm, then settles into the
// normal interval — resilient to a flaky/intermittent network at boot.
export function startSymbolRefresh() {
  const run = async () => {
    let nextMs = REFRESH_MS
    try {
      const { total, added } = await refreshSymbols()
      if (added.length) log.info({ added }, `symbols refreshed: ${added.length} new pair(s) now supported`)
      else log.info({ total }, 'symbols refreshed')
    } catch (e) {
      log.warn({ err: String(e) }, 'symbol refresh failed; will retry')
      if (!cache) nextMs = 15_000 // not warmed yet — retry soon
    }
    setTimeout(run, nextMs)
  }
  void run()
}

// Served from the periodically-refreshed cache (lazy fetch only if not warmed yet).
router.get('/', async (_req, res) => {
  if (!cache) {
    try {
      await refreshSymbols()
    } catch {
      /* fall through to 502 below */
    }
  }
  if (!cache) return res.status(502).json({ error: 'binance_unreachable' })
  res.json(cache)
})

// Live price snapshot from the engine (populated by the feed).
router.get('/price/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase()
  const price = engine.lastPrice(symbol)
  if (price == null) return res.status(404).json({ error: 'no_price' })
  res.json({ symbol, price })
})

// Coin icons proxied through the origin so they work from Iran, where the client
// can't reach assets.coincap.io directly (geo-blocked). Cached in memory.
// ponytail: unbounded Map, but bounded by the coin universe (~few k) — fine.
const ICON_SRC = 'https://assets.coincap.io/assets/icons'
const iconCache = new Map<string, { buf: Buffer; type: string } | null>() // null = known-missing

router.get('/icon/:base', async (req, res) => {
  const base = req.params.base.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!base) return res.status(404).end()
  if (!iconCache.has(base)) {
    try {
      const r = await fetch(`${ICON_SRC}/${base}@2x.png`, { signal: AbortSignal.timeout(8000) })
      iconCache.set(
        base,
        r.ok ? { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' } : null,
      )
    } catch {
      return res.status(502).end() // transient failure — don't cache it
    }
  }
  const hit = iconCache.get(base)
  if (!hit) return res.status(404).end()
  res.set('Cache-Control', 'public, max-age=604800') // 1 week; browser-cached
  res.type(hit.type)
  res.send(hit.buf)
})

export default router
