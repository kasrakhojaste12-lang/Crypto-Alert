import assert from 'node:assert'
import type { NotifyJob } from '../queue/notify'
import { buildMessage } from './messages'

const job: NotifyJob = {
  alertId: 'alert-1',
  fireSeq: 1,
  channel: 'telegram',
  identifier: 'chat-1',
  symbol: 'BTCUSDT',
  price: 101,
  direction: 'above',
  type: 'price',
  target: 100,
  percentBasis: null,
}

assert.match(buildMessage(job, 'fa').body, /نماد: BTCUSDT[\s\S]*قیمت بالاتر از 100 رسید/)
assert.match(buildMessage(job, 'en').body, /Symbol: BTCUSDT[\s\S]*Price is above 100/)

const percent = { ...job, type: 'percent' as const, percentBasis: 'h24' as const, target: 5 }
assert.match(buildMessage(percent, 'fa').body, /در ۲۴ ساعت گذشته بالاتر از 5٪/)
assert.match(buildMessage(percent, 'en').body, /over the last 24 hours is above 5%/)

const candle = { ...job, type: 'candle_close' as const, timeframe: '4h' }
assert.match(buildMessage(candle, 'fa').body, /کندل 4h بالاتر از 100 بسته شد[\s\S]*قیمت بسته‌شدن: 101/)
assert.match(buildMessage(candle, 'en').body, /4h candle closed above 100[\s\S]*Close price: 101/)

// The note is appended last, trimmed, and skipped entirely when blank.
assert.match(buildMessage(job, 'fa', '  ۳۰٪ پوزیشن را ببند  ').body, /یادداشت: ۳۰٪ پوزیشن را ببند$/)
assert.match(buildMessage(job, 'en', 'Close 30% of the position').body, /Note: Close 30% of the position$/)
assert.ok(!buildMessage(job, 'en', '   ').body.includes('Note:'))
assert.ok(!buildMessage(job, 'fa', null).body.includes('یادداشت'))

console.log('messages.test: all assertions passed ✓')
