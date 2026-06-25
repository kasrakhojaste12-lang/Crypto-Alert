import { log } from '../lib/log'
import { engine } from './match'

const REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const INTERVAL = Number(process.env.REST_FEED_INTERVAL_MS || 5000)

// Fallback feed for environments where the Binance WebSocket is filtered but
// REST is reachable (e.g. local dev from Iran: the WS handshake opens but no
// data flows). Polls 24h tickers for ONLY the symbols that have active alerts,
// then drives the same engine.onTick path. Production should use the WS feed.
export function startRestFeed() {
  log.info({ intervalMs: INTERVAL }, 'starting REST polling feed (WebSocket fallback)')
  poll()
}

async function poll() {
  try {
    const symbols = engine.watchedSymbols()
    if (symbols.length) {
      const url = `${REST}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
      const r = await fetch(url)
      if (r.ok) {
        const arr = await r.json()
        for (const t of arr) {
          const price = parseFloat(t.lastPrice)
          const changePct = parseFloat(t.priceChangePercent)
          if (!Number.isNaN(price)) engine.onTick(t.symbol, price, changePct)
        }
      } else {
        log.warn({ status: r.status }, 'REST feed poll non-200')
      }
    }
  } catch (e) {
    log.error({ err: String(e) }, 'REST feed poll error')
  }
  setTimeout(poll, INTERVAL)
}
