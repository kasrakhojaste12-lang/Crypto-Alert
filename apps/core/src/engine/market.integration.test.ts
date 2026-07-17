import assert from 'node:assert'
import { neededTickerStreams } from './binance'
import { engine, type Market } from './match'

const priceAlert = (id: string, market: Market, target: number) => ({
  id,
  userId: 'u1',
  symbol: 'SAMEUSDT',
  market,
  type: 'price' as const,
  direction: 'above' as const,
  target,
  percentBasis: null,
  basePrice: null,
  timeframe: null,
  repeat: 'one_time' as const,
  maxFires: null,
  status: 'active',
  fireCount: 0,
  cycleFireCount: 0,
  channels: [],
})

engine.onTick('SAMEUSDT', 90, 0, 'spot')
engine.onTick('SAMEUSDT', 190, 0, 'futures')
engine.upsert(priceAlert('spot-price', 'spot', 100))
engine.upsert(priceAlert('futures-price', 'futures', 200))
assert.deepEqual(neededTickerStreams('spot'), ['sameusdt@ticker'])
assert.deepEqual(neededTickerStreams('futures'), ['sameusdt@ticker'])

engine.onTick('SAMEUSDT', 110, 0, 'spot')
assert.deepEqual(engine.watchedSymbols('spot'), [], 'Spot tick fires only the Spot alert')
assert.deepEqual(engine.watchedSymbols('futures'), ['SAMEUSDT'], 'Futures alert remains subscribed')
assert.equal(engine.lastPrice('SAMEUSDT', 'spot'), 110)
assert.equal(engine.lastPrice('SAMEUSDT', 'futures'), 190)

const candleAlert = (id: string, market: Market) => ({
  ...priceAlert(id, market, 100),
  symbol: 'CANDLEUSDT',
  type: 'candle_close' as const,
  timeframe: '1m',
})
engine.upsert(candleAlert('spot-candle', 'spot'))
engine.upsert(candleAlert('futures-candle', 'futures'))
assert.deepEqual(engine.neededStreams('spot'), ['candleusdt@kline_1m'])
assert.deepEqual(engine.neededStreams('futures'), ['candleusdt@kline_1m'])

engine.onCandleClose('CANDLEUSDT', '1m', 101, 'spot')
assert.deepEqual(engine.neededStreams('spot'), [], 'Spot close fires only the Spot candle alert')
assert.deepEqual(engine.neededStreams('futures'), ['candleusdt@kline_1m'])

engine.remove('futures-price')
engine.remove('futures-candle')
console.log('market.integration.test: all assertions passed ✓')
process.exit(0)
