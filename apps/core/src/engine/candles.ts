import WebSocket from 'ws'
import { log } from '../lib/log'
import { engine, type Market } from './match'

// Candle-close feed. Primary path is Binance kline WebSocket streams: each event
// carries `k.x` (is-this-kline-closed) and `k.c` (close), so we act ONLY on the
// final close — never on intrabar movement. Subscriptions are reconciled to
// exactly the (symbol, timeframe) combos the engine currently needs, and
// re-established on reconnect. FEED_MODE=rest uses the REST kline poller instead
// (for environments where the WS is filtered, e.g. local dev from Iran).

const SPOT_WS = (
  process.env.BINANCE_KLINE_WS_URL ||
  process.env.BINANCE_WS_URL ||
  'wss://data-stream.binance.vision/ws'
).replace(/\/ws\/.*$/, '/ws')
const FUTURES_WS = (process.env.BINANCE_FUTURES_WS_URL || 'wss://fstream.binance.com/ws').replace(
  /\/ws\/.*$/,
  '/ws',
)
const RECONCILE_MS = Number(process.env.KLINE_RECONCILE_MS || 5000)
const SPOT_REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const FUTURES_REST = process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com'
const REST_INTERVAL = Number(process.env.REST_KLINE_INTERVAL_MS || 5000)

export function startCandleFeed() {
  if ((process.env.FEED_MODE || 'ws') === 'rest') {
    startRestKlinePoll('spot')
    startRestKlinePoll('futures')
  } else {
    startKlineWs('spot', SPOT_WS)
    startKlineWs('futures', FUTURES_WS)
  }
}

// ── WebSocket path (production) ────────────────────────────────────────────
function startKlineWs(market: Market, url: string) {
  let ws: WebSocket | null = null
  let backoff = 1000
  let subscribed = new Set<string>()
  let msgId = 1

  const send = (method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) => {
    if (!params.length || ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ method, params, id: msgId++ }))
  }

  const reconcile = () => {
    if (ws?.readyState !== WebSocket.OPEN) return
    const want = new Set(engine.neededStreams(market))
    send('SUBSCRIBE', [...want].filter((s) => !subscribed.has(s)))
    send('UNSUBSCRIBE', [...subscribed].filter((s) => !want.has(s)))
    subscribed = want
  }

  const connect = () => {
    log.info({ market, url }, 'connecting to binance kline feed')
    subscribed = new Set() // fresh connection: nothing subscribed yet
    ws = new WebSocket(url)

    ws.on('open', () => {
      backoff = 1000
      log.info({ market }, 'kline feed connected')
      reconcile() // (re)subscribe to everything currently needed
    })

    ws.on('message', (data) => {
      try {
        const p = JSON.parse(data.toString())
        const k = p?.k ?? p?.data?.k // raw /ws vs combined /stream shape
        const s = p?.s ?? p?.data?.s
        if (!k || !s || k.x !== true) return // ignore control acks + open (unclosed) candles
        const close = parseFloat(k.c)
        if (!Number.isNaN(close)) engine.onCandleClose(s, k.i, close, market)
      } catch (e) {
        log.error({ err: String(e), market }, 'kline feed parse error')
      }
    })

    ws.on('close', () => {
      log.warn({ backoff, market }, 'kline feed closed; reconnecting')
      setTimeout(connect, backoff)
      backoff = Math.min(backoff * 2, 30000)
    })

    ws.on('error', (e) => {
      log.error({ err: e.message, market }, 'kline feed error')
      ws?.close() // triggers 'close' -> reconnect
    })
  }

  connect()
  setInterval(reconcile, RECONCILE_MS)
}

// ── REST polling fallback (FEED_MODE=rest / local dev) ──────────────────────
// Tracks the last closed candle's closeTime per stream; fires only when a NEW
// candle has closed since the previous poll (so it never replays old candles
// or reacts to the still-forming one).
function startRestKlinePoll(market: Market) {
  const lastCloseTime = new Map<string, number>()
  const rest = market === 'spot' ? SPOT_REST : FUTURES_REST
  const path = market === 'spot' ? '/api/v3/klines' : '/fapi/v1/klines'

  const poll = async () => {
    try {
      for (const stream of engine.neededStreams(market)) {
        const [sym, interval] = stream.split('@kline_')
        const symbol = sym.toUpperCase()
        try {
          const r = await fetch(`${rest}${path}?symbol=${symbol}&interval=${interval}&limit=2`)
          if (!r.ok) continue
          const rows = (await r.json()) as any[]
          const closedRow = rows.length >= 2 ? rows[rows.length - 2] : null // last FULLY-closed candle
          if (!closedRow) continue
          const closeTime = Number(closedRow[6])
          const prev = lastCloseTime.get(stream)
          lastCloseTime.set(stream, closeTime)
          if (prev !== undefined && closeTime > prev)
            engine.onCandleClose(symbol, interval, Number(closedRow[4]), market)
        } catch {
          /* transient per-symbol error — skip this poll */
        }
      }
    } catch (e) {
      log.error({ err: String(e), market }, 'REST kline poll error')
    }
    setTimeout(poll, REST_INTERVAL)
  }

  log.info({ intervalMs: REST_INTERVAL, market }, 'starting REST kline poller (candle feed fallback)')
  void poll()
}
