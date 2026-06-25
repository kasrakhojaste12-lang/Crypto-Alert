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
  const r = await fetch(`${REST}/api/v3/exchangeInfo`)
  if (!r.ok) throw new Error(`exchangeInfo ${r.status}`)
  const data = await r.json()
  const list: Sym[] = data.symbols
    .filter((s: any) => s.status === 'TRADING')
    .map((s: any) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }))
    .sort((a: Sym, b: Sym) => {
      const au = a.quote === 'USDT', bu = b.quote === 'USDT'
      if (au !== bu) return au ? -1 : 1
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

export default router
