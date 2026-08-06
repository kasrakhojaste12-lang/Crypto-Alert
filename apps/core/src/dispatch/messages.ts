import type { NotifyJob } from '../queue/notify'

export function buildMessage(
  j: NotifyJob,
  language: 'fa' | 'en' = 'fa',
  note?: string | null,
): { title: string; body: string } {
  const time = new Date().toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', {
    timeZone: 'Asia/Tehran',
  })

  // The user's own reminder, last so it reads as the takeaway. Blank notes add
  // nothing rather than an empty heading.
  const trimmedNote = note?.trim()
  const noteBlock = trimmedNote
    ? `\n\n\u{1F4DD} ${language === 'en' ? 'Note' : 'یادداشت'}: ${trimmedNote}`
    : ''

  if (language === 'en') {
    const dir = j.direction === 'above' ? 'above' : 'below'
    let condition: string
    let priceLabel = 'Current price'
    if (j.type === 'price') {
      condition = `Price is ${dir} ${j.target}`
    } else if (j.type === 'candle_close') {
      condition = `${j.timeframe ?? ''} candle closed ${dir} ${j.target}`
      priceLabel = 'Close price'
    } else {
      const basis = j.percentBasis === 'h24' ? 'over the last 24 hours' : 'since alert creation'
      condition = `Price change ${basis} is ${dir} ${j.target}%`
    }

    return {
      title: `Alert Key — ${j.symbol}`,
      body:
        `🔔 Alert Key\n\n` +
        `Symbol: ${j.symbol}\n` +
        `Condition: ${condition}\n` +
        `${priceLabel}: ${j.price}\n` +
        `Time: ${time}` +
        noteBlock,
    }
  }

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
    `زمان: ${time}` +
    noteBlock

  return { title: `الرت کی — ${j.symbol}`, body }
}
