// Common Binance quote assets, longest-first, to derive the base coin from a
// symbol (e.g. ETHBTC -> ETH) for the coin logo.
const QUOTES = ['FDUSD', 'USDC', 'USDT', 'TUSD', 'USD1', 'DAI', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'JPY', 'IDR']
export function baseOf(symbol: string): string {
  for (const q of QUOTES) if (symbol.endsWith(q) && symbol.length > q.length) return symbol.slice(0, -q.length)
  return symbol
}

export type Lang = 'fa' | 'en'
const LOCALE: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US' }

// fa -> Persian digits, en -> Latin digits.
export const fmtNum = (n: number | string, lang: Lang, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(LOCALE[lang], opts).format(Number(n))

export const fmtPrice = (n: number | string, lang: Lang) =>
  new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 8 }).format(Number(n))

// Rial -> Toman, formatted
export const toman = (rial: number, lang: Lang) => fmtNum(Math.round(rial / 10), lang)

export interface AlertShape {
  symbol: string
  market: 'spot' | 'futures'
  type: 'price' | 'percent' | 'candle_close'
  direction: 'above' | 'below'
  target: number
  percentBasis: 'h24' | 'since_created' | null
  timeframe?: string | null
  repeat: 'one_time' | 'recurring'
  maxFires?: number | null
  status: string
}

// Human-readable description of an alert condition, in the active language.
export function describeAlert(a: AlertShape, lang: Lang): string {
  if (lang === 'en') {
    const dir = a.direction === 'above' ? 'above' : 'below'
    if (a.type === 'price') return `Price ${dir} ${fmtPrice(a.target, lang)}`
    if (a.type === 'candle_close') return `${a.timeframe} candle closes ${dir} ${fmtPrice(a.target, lang)}`
    const basis = a.percentBasis === 'h24' ? '24h change' : 'change since created'
    return `${basis} ${dir} ${fmtNum(a.target, lang)}%`
  }
  const dir = a.direction === 'above' ? 'بالاتر از' : 'پایین‌تر از'
  if (a.type === 'price') return `قیمت ${dir} ${fmtPrice(a.target, lang)}`
  if (a.type === 'candle_close') return `بسته‌شدن کندل ${a.timeframe} ${dir} ${fmtPrice(a.target, lang)}`
  const basis = a.percentBasis === 'h24' ? 'تغییر ۲۴ ساعته' : 'تغییر از زمان ایجاد'
  return `${basis} ${dir} ${fmtNum(a.target, lang)}٪`
}

const STATUS_CLS: Record<string, string> = {
  active: 'bg-brand/15 text-brand',
  disarmed: 'bg-amber-500/15 text-amber-400',
  triggered: 'bg-slate-700 text-slate-300',
  paused: 'bg-slate-700 text-slate-400',
}
const STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  active: { fa: 'فعال', en: 'Active' },
  disarmed: { fa: 'در انتظار بازگشت', en: 'Waiting to re-arm' },
  triggered: { fa: 'اجرا شده', en: 'Triggered' },
  paused: { fa: 'متوقف', en: 'Paused' },
}
export function statusInfo(status: string, lang: Lang): { label: string; cls: string } {
  return { label: STATUS_LABEL[status]?.[lang] ?? status, cls: STATUS_CLS[status] ?? 'bg-slate-700 text-slate-300' }
}

const REPEAT_LABEL: Record<string, { fa: string; en: string }> = {
  one_time: { fa: 'یک‌بار', en: 'One-time' },
  recurring: { fa: 'تکرارشونده', en: 'Recurring' },
}
export function repeatLabel(repeat: string, lang: Lang, maxFires?: number | null): string {
  const base = REPEAT_LABEL[repeat]?.[lang] ?? repeat
  if (repeat === 'recurring' && maxFires != null)
    return lang === 'fa' ? `${base} (تا ${fmtNum(maxFires, lang)} بار)` : `${base} (up to ${fmtNum(maxFires, lang)}×)`
  return base
}
