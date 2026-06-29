import type { NotifyJob } from '../queue/notify'

// Persian notification body: symbol, condition met, current price, timestamp.
export function buildMessage(j: NotifyJob): { title: string; body: string } {
  const time = new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })
  const dir = j.direction === 'above' ? 'بالاتر از' : 'پایین‌تر از'

  let condition: string
  if (j.type === 'price') {
    condition = `قیمت ${dir} ${j.target} رسید`
  } else {
    const basis = j.percentBasis === 'h24' ? 'در ۲۴ ساعت گذشته' : 'از زمان ایجاد هشدار'
    condition = `تغییر قیمت ${basis} ${dir} ${j.target}٪ شد`
  }

  const body =
    `🔔 الرت کی\n\n` +
    `نماد: ${j.symbol}\n` +
    `شرط: ${condition}\n` +
    `قیمت فعلی: ${j.price}\n` +
    `زمان: ${time}`

  return { title: `الرت کی — ${j.symbol}`, body }
}
