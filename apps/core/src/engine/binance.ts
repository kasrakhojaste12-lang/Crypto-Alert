import WebSocket from 'ws'
import { log } from '../lib/log'
import { engine } from './match'

const WS_URL = process.env.BINANCE_WS_URL || 'wss://data-stream.binance.vision/ws/!ticker@arr'

let ws: WebSocket | null = null
let backoff = 1000

// One connection to the all-market tickers stream delivers every symbol's
// last price + 24h % change. `ws` auto-replies to ping frames (keepalive).
export function startFeed() {
  connect()
}

function connect() {
  log.info({ url: WS_URL }, 'connecting to binance feed')
  ws = new WebSocket(WS_URL)

  ws.on('open', () => {
    backoff = 1000
    log.info('binance feed connected')
  })

  ws.on('message', (data) => {
    try {
      const payload = JSON.parse(data.toString())
      // Combined stream wraps as { stream, data }, raw stream is the array itself.
      const arr = Array.isArray(payload) ? payload : payload?.data
      if (!Array.isArray(arr)) return
      for (const t of arr) {
        const price = parseFloat(t.c)
        const changePct = parseFloat(t.P)
        if (!Number.isNaN(price)) engine.onTick(t.s, price, changePct)
      }
    } catch (e) {
      log.error({ err: String(e) }, 'feed parse error')
    }
  })

  ws.on('close', () => {
    log.warn({ backoff }, 'binance feed closed; reconnecting')
    reconnect()
  })

  ws.on('error', (e) => {
    log.error({ err: e.message }, 'binance feed error')
    ws?.close() // triggers 'close' -> reconnect
  })
}

function reconnect() {
  setTimeout(connect, backoff)
  backoff = Math.min(backoff * 2, 30000)
}
