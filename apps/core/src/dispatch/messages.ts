import type { NotifyJob } from '../queue/notify'

// Persian notification body: symbol, condition met, current price, timestamp.
export function buildMessage(j: NotifyJob): { title: string; body: string } {
  const time = new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })
  const dir = j.direction === 'above' ? 'بالاتر از' : 'پایین‌تر از'

  let condition: string
  let priceLabel = 'قیمت فعلی'
  if (j.type === 'price') {
    condition = `قیمت ${dir} ${j.target} رسید`
  } else if (j.type === 'candle_close') {
    condition = `کندل ${j.timeframe ?? ''} ${dir} ${j.target} بسته شد`
    priceLabel = 'قیمت بسته‌شدن'
  } else {
    const basis = j.percentBasis === 'h24' ? 'در ۲۴ ساعت گذشته' : 'از زمان ایجاد هشدار'
    condition = `تغییر قیمت ${basis} ${dir} ${j.target}٪ شد`
  }

  const body =
    `🔔 الرت کی\n\n` +
    `نماد: ${j.symbol}\n` +
    `شرط: ${condition}\n` +
    `${priceLabel}: ${j.price}\n` +
    `زمان: ${time}`

  return { title: `الرت کی — ${j.symbol}`, body }
}
