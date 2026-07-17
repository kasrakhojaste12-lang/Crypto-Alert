import assert from 'node:assert'
import { engine } from '../engine/match'
import { currentPrice, refreshSymbols } from './symbols'

const originalFetch = globalThis.fetch
let mode: 'price' | 'symbols' | 'symbols_degraded' = 'price'
let calls = 0
const requested: URL[] = []

globalThis.fetch = async (input) => {
  calls++
  const url = new URL(String(input))
  requested.push(url)

  if (mode === 'price') {
    const symbol = url.searchParams.get('symbol')
    if (symbol === 'INVALIDUSDT') return Response.json({ code: -1121 }, { status: 400 })
    return Response.json({ price: url.pathname.startsWith('/fapi/') ? '456.78' : '123.45' })
  }

  if (mode === 'symbols_degraded') {
    if (url.pathname === '/api/v3/exchangeInfo')
      return Response.json({
        symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' }],
      })
    throw new Error('optional market-data endpoint unavailable')
  }

  if (url.pathname === '/api/v3/exchangeInfo')
    return Response.json({ symbols: [
      { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' },
      { symbol: 'DUPUSDT', baseAsset: 'DUP', quoteAsset: 'USDT', status: 'TRADING' },
    ] })
  if (url.pathname === '/api/v3/ticker/24hr')
    return Response.json([{ symbol: 'BTCUSDT', quoteVolume: '100' }, { symbol: 'DUPUSDT', quoteVolume: '10' }])
  if (url.pathname === '/fapi/v1/exchangeInfo')
    return Response.json({ symbols: [
      { symbol: 'DUPUSDT', baseAsset: 'DUP', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
      { symbol: 'AEROUSDT', baseAsset: 'AERO', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
      { symbol: 'STABLEUSDT', baseAsset: 'STABLE', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
      { symbol: 'DELIVERYUSDT', baseAsset: 'DELIVERY', quoteAsset: 'USDT', status: 'TRADING', contractType: 'CURRENT_QUARTER' },
      { symbol: 'PAUSEDUSDT', baseAsset: 'PAUSED', quoteAsset: 'USDT', status: 'SETTLING', contractType: 'PERPETUAL' },
      { symbol: 'USDCUSDT', baseAsset: 'USDC', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
    ] })
  if (url.pathname === '/fapi/v1/ticker/24hr')
    return Response.json([
      { symbol: 'AEROUSDT', quoteVolume: '50' },
      { symbol: 'STABLEUSDT', quoteVolume: '40' },
      { symbol: 'DUPUSDT', quoteVolume: '1000' },
    ])
  return Response.json({}, { status: 404 })
}

const [first, second] = await Promise.all([
  currentPrice('FALLBACKUSDT'),
  currentPrice('FALLBACKUSDT'),
])
assert.equal(first, 123.45)
assert.equal(second, 123.45)
assert.equal(calls, 1, 'concurrent REST lookups share one request')
assert.equal(await currentPrice('FALLBACKUSDT', 'futures'), 456.78)
assert.equal(calls, 2, 'Spot and Futures use separate REST cache keys')
assert.equal(await currentPrice('INVALIDUSDT'), null)

engine.onTick('ENGINEUSDT', 42, 0, 'spot')
engine.onTick('ENGINEUSDT', 84, 0, 'futures')
assert.equal(await currentPrice('ENGINEUSDT'), 42)
assert.equal(await currentPrice('ENGINEUSDT', 'futures'), 84)
assert.equal(calls, 3, 'market-specific engine snapshots take precedence over REST')
assert.ok(requested.some((url) => url.pathname === '/fapi/v1/ticker/price'), 'Futures price uses fapi')

mode = 'symbols'
const { symbols } = await refreshSymbols()
assert.deepEqual(symbols.find((s) => s.symbol === 'DUPUSDT')?.market, 'spot', 'Spot wins duplicate symbols')
assert.deepEqual(
  symbols.filter((s) => ['AEROUSDT', 'STABLEUSDT'].includes(s.symbol)).map((s) => s.market),
  ['futures', 'futures'],
  'active Futures-only perpetuals are included',
)
assert.ok(!symbols.some((s) => ['DELIVERYUSDT', 'PAUSEDUSDT', 'USDCUSDT'].includes(s.symbol)))

mode = 'symbols_degraded'
const degraded = await refreshSymbols()
assert.deepEqual(degraded.symbols.map((s) => s.symbol), ['BTCUSDT'], 'Spot remains available during Futures outage')
assert.equal(degraded.degraded, true, 'degraded refreshes are eligible for a short retry')

globalThis.fetch = originalFetch
console.log('symbols.test: all assertions passed ✓')
process.exit(0) // importing the engine also initializes BullMQ; don't keep this standalone test alive.
