import './lib/env'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { log } from './lib/log'
import { engine } from './engine/match'
import { startFeed } from './engine/binance'
import { startRestFeed } from './engine/restfeed'
import { startCandleFeed } from './engine/candles'
import authRouter from './api/auth'
import alertsRouter from './api/alerts'
import channelsRouter from './api/channels'
import symbolsRouter, { startSymbolRefresh } from './api/symbols'
import billingRouter from './api/billing'
import { startRatePolling } from './lib/rate'

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: process.env.WEB_BASE_URL || 'http://localhost:3000',
    credentials: true,
  }),
)

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), authRouter)
app.use('/api/alerts', rateLimit({ windowMs: 60 * 1000, max: 60 }), alertsRouter)
app.use('/api/channels', channelsRouter)
app.use('/api/symbols', symbolsRouter)
app.use('/api/billing', billingRouter)
app.get('/health', (_req, res) => res.json({ ok: true }))

// Dev-only synthetic tick injection. Binance is unreachable from Iranian IPs,
// so this lets you exercise the matching engine locally without the live feed.
// Gated by DEV_TICK=1; returns 404 otherwise. Never enable in production.
app.post('/api/dev/tick', (req, res) => {
  if (process.env.DEV_TICK !== '1') return res.status(404).end()
  const { symbol, price, changePct = 0 } = req.body ?? {}
  if (!symbol || price == null) return res.status(400).json({ error: 'symbol_and_price_required' })
  engine.onTick(String(symbol).toUpperCase(), Number(price), Number(changePct))
  res.json({ ok: true })
})

// Dev-only synthetic candle-close injection (mirrors /api/dev/tick) for testing
// candle_close alerts without the live kline feed. Gated by DEV_TICK=1.
app.post('/api/dev/candle', (req, res) => {
  if (process.env.DEV_TICK !== '1') return res.status(404).end()
  const { symbol, interval, close } = req.body ?? {}
  if (!symbol || !interval || close == null)
    return res.status(400).json({ error: 'symbol_interval_close_required' })
  engine.onCandleClose(String(symbol).toUpperCase(), String(interval), Number(close))
  res.json({ ok: true })
})

const PORT = Number(process.env.CORE_PORT || 4000) // dev feed: /api/dev/tick

async function main() {
  await engine.loadActive()
  startSymbolRefresh() // auto-pick up newly-listed Binance pairs
  startRatePolling() // hourly USDT→Toman from Wallex for subscription pricing
  // FEED_MODE=rest polls REST (WS blocked locally); default 'ws' for production.
  if ((process.env.FEED_MODE || 'ws') === 'rest') startRestFeed()
  else startFeed()
  startCandleFeed() // candle-close alerts (kline WS, or REST poll in rest mode)
  app.listen(PORT, () => log.info(`core API listening on ${PORT}`))
}

main().catch((e) => {
  log.error(e, 'core failed to start')
  process.exit(1)
})
