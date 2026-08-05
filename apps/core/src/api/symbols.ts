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

// Roughly CoinMarketCap's market-cap order, which is what people expect a coin
// list to look like. Binance exposes no supply data, so real market cap cannot
// be computed here and 24h volume is a poor stand-in at the top (stablecoin and
// meme pairs out-trade coins many times their size). This only shapes the head
// of the list; everything below falls through to the volume sort. It is display
// order, not data — being a few months stale costs nothing.
const CAP_RANK = new Map(
  [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'ADA', 'LINK', 'AVAX',
    'XLM', 'SUI', 'TON', 'SHIB', 'HBAR', 'BCH', 'DOT', 'LTC', 'XMR', 'PEPE',
    'UNI', 'NEAR', 'APT', 'ICP', 'ETC', 'POL', 'RENDER', 'ARB', 'FIL', 'ATOM',
    'OP', 'IMX', 'INJ', 'VET', 'TAO', 'FET', 'SEI', 'RUNE', 'AAVE', 'TIA',
    'ALGO', 'GRT', 'JUP', 'WIF', 'LDO', 'MKR', 'STX', 'WLD', 'SAND', 'MANA',
    'AXS', 'EOS', 'FLOW', 'CRV', 'GALA', 'CHZ', 'KAS', 'ONDO', 'ENA', 'S',
    'BONK', 'FLOKI', 'JASMY', 'PYTH', 'ARKM', 'ENS', 'COMP', 'SNX', 'DYDX',
    'STRK', 'EIGEN', 'JTO', 'RAY', 'CAKE', 'THETA', 'QNT', 'KAIA', 'NEO',
    'GMT', 'ZEC', 'DASH', 'ROSE', 'ANKR', 'ZIL', '1INCH', 'BAT',
  ].map((base, i) => [base, i] as const),
)
const capRank = (base: string) => CAP_RANK.get(base) ?? Number.MAX_SAFE_INTEGER

// Fetch every TRADING pair (USDT-quoted first) and update the cache. Returns any
// symbols that are new since the last refresh — i.e. pairs Binance just listed.
export async function refreshSymbols(): Promise<{
  total: number
  added: string[]
  symbols: Sym[]
  degraded: boolean
}> {
  const signal = AbortSignal.timeout(8000)
  // The 24hr tickers are megabytes next to exchangeInfo's kilobytes, so they get
  // their own, longer deadline. Sharing one 8s signal meant a slow link aborted
  // the volume data first and silently degraded the ordering to alphabetical.
  const tickerSignal = AbortSignal.timeout(20_000)
  const [spotEx, spotTk, futuresEx, futuresTk] = await Promise.all([
    fetch(`${SPOT_REST}/api/v3/exchangeInfo`, { signal }),
    fetch(`${SPOT_REST}/api/v3/ticker/24hr?type=MINI`, { signal: tickerSignal }).catch(() => null),
    fetch(`${FUTURES_REST}/fapi/v1/exchangeInfo`, { signal }).catch(() => null),
    fetch(`${FUTURES_REST}/fapi/v1/ticker/24hr`, { signal: tickerSignal }).catch(() => null),
  ])
  if (!spotEx.ok) throw new Error(`spot exchangeInfo ${spotEx.status}`)
  const spotData = await spotEx.json()
  const futuresData = futuresEx?.ok
    ? await futuresEx.json().catch(() => ({ symbols: [] }))
    : { symbols: [] }
  if (!futuresEx?.ok)
    log.warn({ status: futuresEx?.status ?? 'unreachable' }, 'futures symbols unavailable; serving Spot only')
  // 24h quote volume per symbol, so the tail of the picker favours traded pairs.
  // Best-effort: if the ticker call fails, the curated cap order still holds and
  // the rest falls back to alphabetical.
  const vol = new Map<string, number>()
  if (spotTk?.ok) {
    for (const t of (await spotTk.json().catch(() => [])) as any[])
      vol.set(`spot|${t.symbol}`, Number(t.quoteVolume) || 0)
  }
  if (futuresTk?.ok) {
    for (const t of (await futuresTk.json().catch(() => [])) as any[])
      vol.set(`futures|${t.symbol}`, Number(t.quoteVolume) || 0)
  }
  if (!vol.size) log.warn('24h volume unavailable; pair ordering falls back to the curated list')
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
      const ra = capRank(a.base), rb = capRank(b.base)
      if (ra !== rb) return ra - rb // then market-cap order for the coins we rank
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
// can't reach the upstream CDNs directly (geo-blocked). Cached in memory.
// ponytail: unbounded Map, but bounded by the coin universe (~few k) — fine.
// Two sources, because coincap's icon set has stopped keeping up and 404s for a
// lot of listed assets.
const ICON_SOURCES = [
  (base: string) => `https://assets.coincap.io/assets/icons/${base}@2x.png`,
  (base: string) => `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color/${base}.png`,
]
type Icon = { buf: Buffer; type: string }
const iconCache = new Map<string, Icon>()

// Last resort for assets neither CDN carries: a coloured disc with the ticker on
// it. Hue is derived from the ticker, so an asset always keeps the same colour.
// Better than a broken image, and it means the endpoint never has to 404.
function monogram(base: string): Icon {
  let hue = 0
  for (const ch of base) hue = (hue * 31 + ch.charCodeAt(0)) % 360
  const label = base.slice(0, 4).toUpperCase()
  const fontSize = label.length > 3 ? 24 : 32
  // `base` is already reduced to [a-z0-9], so it is safe to inline as SVG text.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">` +
    `<circle cx="48" cy="48" r="48" fill="hsl(${hue} 52% 40%)"/>` +
    `<text x="48" y="50" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="${fontSize}" ` +
    `font-weight="700" fill="#ffffff">${label}</text></svg>`
  return { buf: Buffer.from(svg), type: 'image/svg+xml' }
}

router.get('/icon/:base', async (req, res) => {
  const base = req.params.base.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!base) return res.status(404).end()

  let icon = iconCache.get(base)
  // `transient` tracks a source that failed rather than answered "missing", so a
  // network blip can't pin an asset to its monogram for the process's lifetime.
  let transient = false
  if (!icon) {
    for (const url of ICON_SOURCES) {
      try {
        const r = await fetch(url(base), { signal: AbortSignal.timeout(8000) })
        if (r.ok) {
          icon = { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' }
          break
        }
      } catch {
        transient = true
      }
    }
    if (!icon) icon = monogram(base)
    if (!transient) iconCache.set(base, icon)
  }

  // A monogram produced while a source was unreachable is worth re-checking soon;
  // everything else is stable enough to sit in the browser cache for a week.
  res.set('Cache-Control', transient ? 'public, max-age=300' : 'public, max-age=604800')
  res.type(icon.type)
  res.send(icon.buf)
})

export default router
