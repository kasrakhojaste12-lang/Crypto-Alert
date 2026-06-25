// Common Binance quote assets, longest-first, to derive the base coin from a
// symbol (e.g. ETHBTC -> ETH) for the coin logo.
const QUOTES = ['FDUSD', 'USDC', 'USDT', 'TUSD', 'USD1', 'DAI', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'TRY', 'BRL', 'JPY', 'IDR']
export function baseOf(symbol: string): string {
  for (const q of QUOTES) if (symbol.endsWith(q) && symbol.length > q.length) return symbol.slice(0, -q.length)
  return symbol
}

export const faNum = (n: number | string, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('fa-IR', opts).format(Number(n))

export const faPrice = (n: number | string) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 8 }).format(Number(n))

// Rial -> Toman, formatted
export const toman = (rial: number) => faNum(Math.round(rial / 10))

export interface AlertShape {
  symbol: string
  type: 'price' | 'percent'
  direction: 'above' | 'below'
  target: number
  percentBasis: 'h24' | 'since_created' | null
  repeat: 'one_time' | 'recurring'
  status: string
}

// Persian, human-readable description of an alert condition.
export function describeAlert(a: AlertShape): string {
  const dir = a.direction === 'above' ? 'بالاتر از' : 'پایین‌تر از'
  if (a.type === 'price') return `قیمت ${dir} ${faPrice(a.target)}`
  const basis = a.percentBasis === 'h24' ? 'تغییر ۲۴ ساعته' : 'تغییر از زمان ایجاد'
  return `${basis} ${dir} ${faNum(a.target)}٪`
}

export const STATUS_FA: Record<string, { label: string; cls: string }> = {
  active: { label: 'فعال', cls: 'bg-brand/15 text-brand' },
  disarmed: { label: 'در انتظار بازگشت', cls: 'bg-amber-500/15 text-amber-400' },
  triggered: { label: 'اجرا شده', cls: 'bg-slate-700 text-slate-300' },
  paused: { label: 'متوقف', cls: 'bg-slate-700 text-slate-400' },
}

export const REPEAT_FA: Record<string, string> = {
  one_time: 'یک‌بار',
  recurring: 'تکرارشونده',
}
