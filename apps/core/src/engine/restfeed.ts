import { log } from '../lib/log'
import { engine, type Market } from './match'

const SPOT_REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const FUTURES_REST = process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com'
const INTERVAL = Number(process.env.REST_FEED_INTERVAL_MS || 5000)

// Fallback feed for environments where the Binance WebSocket is filtered but
// REST is reachable (e.g. local dev from Iran: the WS handshake opens but no
// data flows). Polls 24h tickers for ONLY the symbols that have active alerts,
// then drives the same engine.onTick path. Production should use the WS feed.
export function startRestFeed() {
  log.info({ intervalMs: INTERVAL }, 'starting REST polling feed (WebSocket fallback)')
  poll('spot')
  poll('futures')
}

async function poll(market: Market) {
  try {
    const symbols = engine.watchedSymbols(market)
    if (symbols.length) {
      const urls = market === 'spot'
        ? [`${SPOT_REST}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`]
        : symbols.map((symbol) => `${FUTURES_REST}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`)
      const responses = await Promise.all(urls.map((url) => fetch(url)))
      for (const r of responses) {
        if (r.ok) {
          const data = await r.json()
          for (const t of Array.isArray(data) ? data : [data]) {
            const price = parseFloat(t.lastPrice)
            const changePct = parseFloat(t.priceChangePercent)
            if (!Number.isNaN(price)) engine.onTick(t.symbol, price, changePct, market)
          }
        } else {
          log.warn({ status: r.status, market }, 'REST feed poll non-200')
        }
      }
    }
  } catch (e) {
    log.error({ err: String(e), market }, 'REST feed poll error')
  }
  setTimeout(() => poll(market), INTERVAL)
}
