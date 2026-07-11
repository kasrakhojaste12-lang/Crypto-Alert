import assert from 'node:assert'
import { engine } from '../engine/match'
import { currentPrice } from './symbols'

const originalFetch = globalThis.fetch
let calls = 0
globalThis.fetch = async (input) => {
  calls++
  const symbol = new URL(String(input)).searchParams.get('symbol')
  return symbol === 'INVALIDUSDT'
    ? Response.json({ code: -1121 }, { status: 400 })
    : Response.json({ price: '123.45' })
}

const [first, second] = await Promise.all([
  currentPrice('FALLBACKUSDT'),
  currentPrice('FALLBACKUSDT'),
])
assert.equal(first, 123.45)
assert.equal(second, 123.45)
assert.equal(calls, 1, 'concurrent REST lookups share one request')
assert.equal(await currentPrice('INVALIDUSDT'), null)

engine.onTick('ENGINEUSDT', 42, 0)
assert.equal(await currentPrice('ENGINEUSDT'), 42)
assert.equal(calls, 2, 'engine snapshot takes precedence over REST')

globalThis.fetch = originalFetch
console.log('symbols.test: all assertions passed ✓')
process.exit(0) // importing the engine also initializes BullMQ; don't keep this standalone test alive.
