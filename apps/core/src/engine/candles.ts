import WebSocket from 'ws'
import { log } from '../lib/log'
import { engine } from './match'

// Candle-close feed. Primary path is Binance kline WebSocket streams: each event
// carries `k.x` (is-this-kline-closed) and `k.c` (close), so we act ONLY on the
// final close — never on intrabar movement. Subscriptions are reconciled to
// exactly the (symbol, timeframe) combos the engine currently needs, and
// re-established on reconnect. FEED_MODE=rest uses the REST kline poller instead
// (for environments where the WS is filtered, e.g. local dev from Iran).

const WS_BASE = process.env.BINANCE_KLINE_WS_URL || 'wss://data-stream.binance.vision/ws'
const RECONCILE_MS = Number(process.env.KLINE_RECONCILE_MS || 5000)
const REST = process.env.BINANCE_REST_URL || 'https://data-api.binance.vision'
const REST_INTERVAL = Number(process.env.REST_KLINE_INTERVAL_MS || 5000)

export function startCandleFeed() {
  if ((process.env.FEED_MODE || 'ws') === 'rest') startRestKlinePoll()
  else startKlineWs()
}

// ── WebSocket path (production) ────────────────────────────────────────────
let ws: WebSocket | null = null
let backoff = 1000
let subscribed = new Set<string>()
let msgId = 1

function startKlineWs() {
  connect()
  setInterval(reconcile, RECONCILE_MS)
}

function connect() {
  log.info({ url: WS_BASE }, 'connecting to binance kline feed')
  subscribed = new Set() // fresh connection: nothing subscribed yet
  ws = new WebSocket(WS_BASE)

  ws.on('open', () => {
    backoff = 1000
    log.info('kline feed connected')
    reconcile() // (re)subscribe to everything currently needed
  })

  ws.on('message', (data) => {
    try {
      const p = JSON.parse(data.toString())
      const k = p?.k ?? p?.data?.k // raw /ws vs combined /stream shape
      const s = p?.s ?? p?.data?.s
      if (!k || !s || k.x !== true) return // ignore control acks + open (unclosed) candles
      const close = parseFloat(k.c)
      if (!Number.isNaN(close)) engine.onCandleClose(s, k.i, close)
    } catch (e) {
      log.error({ err: String(e) }, 'kline feed parse error')
    }
  })

  ws.on('close', () => {
    log.warn({ backoff }, 'kline feed closed; reconnecting')
    setTimeout(connect, backoff)
    backoff = Math.min(backoff * 2, 30000)
  })

  ws.on('error', (e) => {
    log.error({ err: e.message }, 'kline feed error')
    ws?.close() // triggers 'close' -> reconnect
  })
}

function send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
  if (!params.length || ws?.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ method, params, id: msgId++ }))
}

// Diff current subscriptions against what the engine needs and adjust.
function reconcile() {
  if (ws?.readyState !== WebSocket.OPEN) return
  const want = new Set(engine.neededStreams())
  send('SUBSCRIBE', [...want].filter((s) => !subscribed.has(s)))
  send('UNSUBSCRIBE', [...subscribed].filter((s) => !want.has(s)))
  subscribed = want
}

// ── REST polling fallback (FEED_MODE=rest / local dev) ──────────────────────
// Tracks the last closed candle's closeTime per stream; fires only when a NEW
// candle has closed since the previous poll (so it never replays old candles
// or reacts to the still-forming one).
const lastCloseTime = new Map<string, number>()

function startRestKlinePoll() {
  log.info({ intervalMs: REST_INTERVAL }, 'starting REST kline poller (candle feed fallback)')
  pollKlines()
}

async function pollKlines() {
  try {
    for (const stream of engine.neededStreams()) {
      const [sym, interval] = stream.split('@kline_')
      const symbol = sym.toUpperCase()
      try {
        const r = await fetch(`${REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=2`)
        if (!r.ok) continue
        const rows = (await r.json()) as any[]
        const closedRow = rows.length >= 2 ? rows[rows.length - 2] : null // last FULLY-closed candle
        if (!closedRow) continue
        const closeTime = Number(closedRow[6])
        const prev = lastCloseTime.get(stream)
        lastCloseTime.set(stream, closeTime)
        if (prev !== undefined && closeTime > prev) engine.onCandleClose(symbol, interval, Number(closedRow[4]))
      } catch {
        /* transient per-symbol error — skip this poll */
      }
    }
  } catch (e) {
    log.error({ err: String(e) }, 'REST kline poll error')
  }
  setTimeout(pollKlines, REST_INTERVAL)
}
