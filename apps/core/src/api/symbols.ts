import { Router } from 'express'
import { log } from '../lib/log'
import { engine, type Market } from '../engine/match'

const router = Router()
const SPOT_REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const FUTURES_REST = process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com'
const REFRESH_MS = Number(process.env.SYMBOLS_REFRESH_MS || 3600_000)

type Sym = { symbol: string; base: string; quote: string; market: Market }
let cache: Sym[] | null = null
let known = new Set<string>()
type PriceHit = { price: number; expires: number }
// ponytail: unbounded Map, but bounded by the Binance symbol universe; prune if that ever grows materially.
const priceCache = new Map<string, PriceHit | Promise<number | null>>()

// USD/EUR-pegged stablecoins on Binance. Pairs where BOTH legs are stablecoins
// (e.g. USDCUSDT, FDUSDUSDT, DAIUSDT) are dropped from the list — a ~1:1 peg
// isn't something anyone sets a price alert on. Extend if Binance lists a new one.
const STABLES = new Set([
  'USDT', 'USDC', 'FDUSD', 'TUSD', 'BUSD', 'DAI', 'USDP', 'PYUSD', 'USD1',
  'USDD', 'GUSD', 'USTC', 'AEUR', 'EURI',
])
const isStablePair = (s: { baseAsset: string; quoteAsset: string }) =>
  STABLES.has(s.baseAsset) && STABLES.has(s.quoteAsset)

// Fetch every TRADING pair (USDT-quoted first) and update the cache. Returns any
// symbols that are new since the last refresh — i.e. pairs Binance just listed.
export async function refreshSymbols(): Promise<{
  total: number
  added: string[]
  symbols: Sym[]
  degraded: boolean
}> {
  const signal = AbortSignal.timeout(8000)
  const [spotEx, spotTk, futuresEx, futuresTk] = await Promise.all([
    fetch(`${SPOT_REST}/api/v3/exchangeInfo`, { signal }),
    fetch(`${SPOT_REST}/api/v3/ticker/24hr?type=MINI`, { signal }).catch(() => null),
    fetch(`${FUTURES_REST}/fapi/v1/exchangeInfo`, { signal }).catch(() => null),
    fetch(`${FUTURES_REST}/fapi/v1/ticker/24hr`, { signal }).catch(() => null),
  ])
  if (!spotEx.ok) throw new Error(`spot exchangeInfo ${spotEx.status}`)
  const spotData = await spotEx.json()
  const futuresData = futuresEx?.ok
    ? await futuresEx.json().catch(() => ({ symbols: [] }))
    : { symbols: [] }
  if (!futuresEx?.ok)
    log.warn({ status: futuresEx?.status ?? 'unreachable' }, 'futures symbols unavailable; serving Spot only')
  // 24h quote volume per symbol, so the picker defaults to the most-traded pairs.
  // Best-effort: if the ticker call fails, fall back to the USDT-first alpha sort.
  const vol = new Map<string, number>()
  if (spotTk?.ok) {
    for (const t of (await spotTk.json().catch(() => [])) as any[])
      vol.set(`spot|${t.symbol}`, Number(t.quoteVolume) || 0)
  }
  if (futuresTk?.ok) {
    for (const t of (await futuresTk.json().catch(() => [])) as any[])
      vol.set(`futures|${t.symbol}`, Number(t.quoteVolume) || 0)
  }
  const spot: Sym[] = spotData.symbols
    .filter((s: any) => s.status === 'TRADING' && !isStablePair(s))
    .map((s: any) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset, market: 'spot' }))
  const spotSymbols = new Set(spot.map((s) => s.symbol))
  const list: Sym[] = spot
    .concat(
      futuresData.symbols
        .filter((s: any) =>
          s.status === 'TRADING' && s.contractType === 'PERPETUAL' && !spotSymbols.has(s.symbol) && !isStablePair(s),
        )
        .map((s: any) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset, market: 'futures' })),
    )
    .sort((a: Sym, b: Sym) => {
      // USDT pairs first: quoteVolume is only comparable within one quote asset
      // (an IDR-quoted pair's volume is a huge number just because IDR is tiny).
      const au = a.quote === 'USDT', bu = b.quote === 'USDT'
      if (au !== bu) return au ? -1 : 1
      const va = vol.get(`${a.market}|${a.symbol}`) ?? 0, vb = vol.get(`${b.market}|${b.symbol}`) ?? 0
      if (va !== vb) return vb - va // then most 24h volume first
      return a.symbol.localeCompare(b.symbol)
    })
  const current = new Set(list.map((s) => s.symbol))
  const added = known.size ? [...current].filter((s) => !known.has(s)) : []
  cache = list
  known = current
  return { total: list.length, added, symbols: list, degraded: !futuresEx?.ok }
}

// Periodic refresher: newly-listed Binance pairs become selectable automatically.
// (The engine + WS feed already handle any symbol; this keeps the picker current.)
// Self-scheduling: retries quickly until the list is warm, then settles into the
// normal interval — resilient to a flaky/intermittent network at boot.
export function startSymbolRefresh() {
  const run = async () => {
    let nextMs = REFRESH_MS
    try {
      const { total, added, degraded } = await refreshSymbols()
      if (added.length) log.info({ added }, `symbols refreshed: ${added.length} new pair(s) now supported`)
      else log.info({ total }, 'symbols refreshed')
      if (degraded) nextMs = 15_000
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

async function restPrice(symbol: string, market: Market): Promise<number | null> {
  const key = `${market}|${symbol}`
  const hit = priceCache.get(key)
  if (hit instanceof Promise) return hit
  if (hit && hit.expires > Date.now()) return hit.price

  const pending = (async () => {
    const rest = market === 'spot' ? SPOT_REST : FUTURES_REST
    const path = market === 'spot' ? '/api/v3/ticker/price' : '/fapi/v1/ticker/price'
    const r = await fetch(`${rest}${path}?symbol=${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (r.status >= 400 && r.status < 500) return null
    if (!r.ok) throw new Error(`ticker price ${r.status}`)
    const price = Number(((await r.json()) as { price?: unknown }).price)
    return Number.isFinite(price) && price > 0 ? price : null
  })()
  priceCache.set(key, pending)
  try {
    const price = await pending
    if (price == null) priceCache.delete(key)
    else priceCache.set(key, { price, expires: Date.now() + 5000 })
    return price
  } catch (e) {
    priceCache.delete(key)
    throw e
  }
}

export async function currentPrice(symbol: string, market: Market = 'spot'): Promise<number | null> {
  return engine.lastPrice(symbol, market) ?? restPrice(symbol, market)
}

// Prefer the engine snapshot; selectable symbols without alerts fall back to REST.
router.get('/price/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase()
  const market = req.query.market ?? 'spot'
  if (market !== 'spot' && market !== 'futures') return res.status(400).json({ error: 'invalid_market' })
  try {
    const price = await currentPrice(symbol, market)
    if (price == null) return res.status(404).json({ error: 'no_price' })
    res.json({ symbol, market, price })
  } catch {
    res.status(502).json({ error: 'binance_unreachable' })
  }
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
