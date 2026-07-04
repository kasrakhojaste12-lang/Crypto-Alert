import WebSocket from 'ws'
import { log } from '../lib/log'
import { engine } from './match'

// Individual-symbol ticker feed. The all-market `!ticker@arr` firehose is not
// delivered from every network — the WS opens but streams ZERO data (observed on
// the production VPS: connection "connected" yet no ticks ever arrive, so no
// price/percent alert can fire). Per-symbol `<symbol>@ticker` streams DO deliver,
// so we subscribe to only the symbols that currently have price/percent alerts
// and reconcile as alerts come and go — the same pattern the kline feed uses.
// Each `<symbol>@ticker` payload carries `c` (last price) and `P` (24h %), so
// both price and percent(h24) alerts are served with no loss vs the array stream.
const RAW_URL = process.env.BINANCE_WS_URL || 'wss://data-stream.binance.vision/ws'
// Tolerate a stale `.../ws/!ticker@arr` value in the env: we need the bare /ws
// endpoint to drive SUBSCRIBE, so strip any stream path after /ws.
const WS_BASE = RAW_URL.replace(/\/ws\/.*$/, '/ws')
const RECONCILE_MS = Number(process.env.TICKER_RECONCILE_MS || 5000)
const STALE_MS = Number(process.env.TICKER_STALE_MS || 60000)

// Pure parse of a raw ticker frame → the fields the engine needs, or null for
// control frames (SUBSCRIBE/UNSUBSCRIBE acks). Kept pure so it's unit-testable.
export function parseTicker(raw: string): { s: string; price: number; changePct: number } | null {
  const p = JSON.parse(raw)
  const d = p?.data ?? p // raw /ws frame vs combined /stream wrapper
  if (!d?.s || d.c == null) return null // ack / non-ticker frame
  const price = parseFloat(d.c)
  if (Number.isNaN(price)) return null
  return { s: d.s, price, changePct: parseFloat(d.P) }
}

let ws: WebSocket | null = null
let backoff = 1000
let subscribed = new Set<string>()
let msgId = 1
let lastMsgAt = 0

export function startFeed() {
  connect()
  setInterval(reconcile, RECONCILE_MS)
  // Watchdog: a live individual-ticker stream sends ~1 msg/sec per symbol, so if
  // we have subscriptions but nothing has arrived for STALE_MS, the socket has
  // gone half-open (no 'close'/'error' fired) — force a reconnect. This is the
  // exact failure that took the old feed down silently.
  setInterval(() => {
    if (!subscribed.size || ws?.readyState !== WebSocket.OPEN) return
    if (Date.now() - lastMsgAt > STALE_MS) {
      log.warn({ staleMs: Date.now() - lastMsgAt }, 'binance feed stale; forcing reconnect')
      ws.close() // triggers 'close' -> reconnect
    }
  }, STALE_MS)
}

function neededStreams(): string[] {
  return engine.watchedSymbols().map((s) => `${s.toLowerCase()}@ticker`)
}

function connect() {
  log.info({ url: WS_BASE }, 'connecting to binance feed')
  subscribed = new Set() // fresh connection: nothing subscribed yet
  lastMsgAt = Date.now()
  ws = new WebSocket(WS_BASE)

  ws.on('open', () => {
    backoff = 1000
    lastMsgAt = Date.now()
    log.info('binance feed connected')
    reconcile() // (re)subscribe to everything currently needed
  })

  ws.on('message', (data) => {
    lastMsgAt = Date.now()
    try {
      const t = parseTicker(data.toString())
      if (t) engine.onTick(t.s, t.price, t.changePct)
    } catch (e) {
      log.error({ err: String(e) }, 'feed parse error')
    }
  })

  ws.on('close', () => {
    log.warn({ backoff }, 'binance feed closed; reconnecting')
    setTimeout(connect, backoff)
    backoff = Math.min(backoff * 2, 30000)
  })

  ws.on('error', (e) => {
    log.error({ err: e.message }, 'binance feed error')
    ws?.close() // triggers 'close' -> reconnect
  })
}

function send(method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) {
  if (!params.length || ws?.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ method, params, id: msgId++ }))
}

// Diff current subscriptions against the symbols the engine watches and adjust.
function reconcile() {
  if (ws?.readyState !== WebSocket.OPEN) return
  const want = new Set(neededStreams())
  send('SUBSCRIBE', [...want].filter((s) => !subscribed.has(s)))
  send('UNSUBSCRIBE', [...subscribed].filter((s) => !want.has(s)))
  subscribed = want
}
