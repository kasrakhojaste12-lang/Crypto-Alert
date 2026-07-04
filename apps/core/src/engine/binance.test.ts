// Runnable self-check for the ticker feed's frame parsing. `npm test` runs this.
import assert from 'node:assert'
import { parseTicker } from './binance'

// Raw /ws individual-ticker frame (what `<symbol>@ticker` delivers).
const raw = parseTicker('{"e":"24hrTicker","s":"BTCUSDT","c":"62606.01","P":"1.23"}')
assert.deepEqual(raw, { s: 'BTCUSDT', price: 62606.01, changePct: 1.23 }, 'parses last price + 24h %')

// Combined /stream wrapper shape.
const wrapped = parseTicker('{"stream":"btcusdt@ticker","data":{"s":"BTCUSDT","c":"100","P":"-2"}}')
assert.deepEqual(wrapped, { s: 'BTCUSDT', price: 100, changePct: -2 }, 'unwraps combined-stream frame')

// SUBSCRIBE/UNSUBSCRIBE acks and junk must be ignored (no s/c) → null.
assert.equal(parseTicker('{"result":null,"id":1}'), null, 'subscribe ack -> null')
assert.equal(parseTicker('{"s":"BTCUSDT","c":"not-a-number"}'), null, 'unparseable price -> null')

console.log('binance parseTicker: all assertions passed')
process.exit(0) // importing ./binance pulls in the BullMQ queue (open Redis handle)
