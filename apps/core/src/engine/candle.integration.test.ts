// Integration check for the candle-close engine wiring: routing into the kline
// subscription set + the fire/re-arm/cap state machine driven by onCandleClose.
// No DB/Redis needed — persist() is fire-and-forget (and the test alerts carry
// no channels, so nothing is enqueued); we observe behavior via neededStreams(),
// which shrinks to empty exactly when an alert becomes terminal.
import assert from 'node:assert'
import { engine } from './match'

const base = {
  userId: 'u1',
  symbol: 'BTCUSDT',
  type: 'candle_close' as const,
  direction: 'above' as const,
  target: 100,
  percentBasis: null,
  basePrice: null,
  timeframe: '1m',
  status: 'active',
  fireCount: 0,
  channels: [] as unknown[], // no channels => persist() enqueues nothing
}

// ── routing: candle alerts drive kline subscriptions; price alerts don't ──
engine.upsert({ ...base, id: 'c1', repeat: 'one_time', maxFires: null })
assert.deepEqual(engine.neededStreams(), ['btcusdt@kline_1m'], 'candle alert => one kline stream')

engine.upsert({
  id: 'p1', userId: 'u1', symbol: 'ETHUSDT', type: 'price', direction: 'above',
  target: 5, percentBasis: null, basePrice: null, timeframe: null,
  repeat: 'one_time', maxFires: null, status: 'active', fireCount: 0, channels: [],
})
assert.deepEqual(engine.neededStreams(), ['btcusdt@kline_1m'], 'price alert adds no stream')

// two candle alerts sharing a symbol+tf => still one stream
engine.upsert({ ...base, id: 'c2', repeat: 'one_time', maxFires: null })
assert.deepEqual(engine.neededStreams(), ['btcusdt@kline_1m'], 'shared stream not duplicated')

// ── one-time fires and self-removes on a close past the target ──
engine.onCandleClose('BTCUSDT', '1m', 99) // below target -> no fire
assert.equal(engine.neededStreams().length, 1, 'close below target does not fire')
engine.onCandleClose('BTCUSDT', '1m', 101) // c1 & c2 both close above -> both fire (one_time) & drop
assert.deepEqual(engine.neededStreams(), [], 'both one-time alerts fired and removed')

// ── recurring with a fire cap: fire, no double-fire, re-arm, stop at cap ──
engine.upsert({ ...base, id: 'r1', repeat: 'recurring', maxFires: 2 })
assert.deepEqual(engine.neededStreams(), ['btcusdt@kline_1m'], 'recurring alert subscribes')

engine.onCandleClose('BTCUSDT', '1m', 101) // fire #1 -> disarmed
assert.equal(engine.neededStreams().length, 1, 'still watching after fire #1 (recurring)')
engine.onCandleClose('BTCUSDT', '1m', 105) // disarmed: still above -> no re-fire (anti-spam)
assert.equal(engine.neededStreams().length, 1, 'no double-fire while disarmed')
engine.onCandleClose('BTCUSDT', '1m', 98) // closes back below -> re-arm
engine.onCandleClose('BTCUSDT', '1m', 102) // fire #2 -> cap reached -> terminal -> removed
assert.deepEqual(engine.neededStreams(), [], 'stopped and unsubscribed after hitting the cap')

// wrong-symbol / wrong-interval closes are ignored (no throw, no effect)
engine.upsert({ ...base, id: 'c3', repeat: 'one_time', maxFires: null, timeframe: '4h' })
engine.onCandleClose('BTCUSDT', '1m', 101) // no 1m alert now -> nothing happens
assert.deepEqual(engine.neededStreams(), ['btcusdt@kline_4h'], '4h alert untouched by 1m close')
engine.remove('c3')

// ── immediate-fire: a price alert already met at create-time fires at once ──
const priceAlert = (id: string, symbol: string, target: number, repeat: 'one_time' | 'recurring') => ({
  id, userId: 'u1', symbol, type: 'price' as const, direction: 'above' as const,
  target, percentBasis: null, basePrice: null, timeframe: null,
  repeat, maxFires: null, status: 'active', fireCount: 0, channels: [] as unknown[],
})
engine.onTick('XRPUSDT', 1.5, 0) // seed lastSnap (no alert yet -> no fire)
engine.upsert(priceAlert('m1', 'XRPUSDT', 1.0, 'one_time')) // 1.5 >= 1.0 -> fires now
assert.ok(!engine.watchedSymbols().includes('XRPUSDT'), 'already-met one_time price alert fires immediately and self-removes')

engine.onTick('ADAUSDT', 0.5, 0) // seed below target
engine.upsert(priceAlert('m2', 'ADAUSDT', 1.0, 'one_time')) // 0.5 < 1.0 -> stays armed
assert.ok(engine.watchedSymbols().includes('ADAUSDT'), 'not-yet-met alert stays armed (no immediate fire)')
engine.remove('m2')

console.log('candle.integration.test: all assertions passed ✓')
process.exit(0) // release the (unused) Redis handle created at import
