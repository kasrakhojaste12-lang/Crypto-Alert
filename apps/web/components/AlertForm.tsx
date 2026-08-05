'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'
import { useUser, type ChannelType, type PlanId } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { planName } from '@/lib/plans'
import { SymbolPicker, LivePrice } from './SymbolPicker'

type Type = 'price' | 'percent' | 'candle_close'
type Dir = 'above' | 'below'
type Basis = 'h24' | 'since_created'
type Repeat = 'one_time' | 'recurring'
type TF = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
type Market = 'spot' | 'futures'
const TIMEFRAMES: TF[] = ['1m', '5m', '15m', '1h', '4h', '1d']
// Mirrors NOTE_MAX_LENGTH in apps/core/src/api/alerts.ts
const NOTE_MAX = 500

// What the plan gate refused, so the prompt can name it.
type Blocked = { feature: string; detail?: string }

function LockIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function Seg<T extends string>({
  value,
  onChange,
  options,
  onLocked,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; locked?: boolean }[]
  onLocked?: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-slate-700 bg-slate-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          // Locked options stay clickable on purpose: the click is what explains
          // which plan unlocks them.
          onClick={() => (o.locked ? onLocked?.(o.value) : onChange(o.value))}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition ${
            value === o.value && !o.locked
              ? 'bg-brand text-slate-950 font-semibold'
              : o.locked
                ? 'text-slate-500 hover:text-slate-300'
                : 'text-slate-300 hover:text-white'
          }`}
        >
          {o.label}
          {o.locked && <LockIcon />}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function TradingViewChart({ symbol, market, label }: { symbol: string; market: Market; label: string }) {
  const container = useRef<HTMLDivElement>(null)
  const tvSymbol = `BINANCE:${symbol}${market === 'futures' ? '.P' : ''}`
  const symbolUrl = `{{https://www.tradingview.com/symbols/${symbol}}}${market === 'futures' ? '.P' : ''}/?exchange=BINANCE`

  useEffect(() => {
    const node = container.current
    if (!node) return
    node.replaceChildren()

    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = '100%'
    widget.style.width = '100%'

    const light = document.documentElement.classList.contains('light')
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.text = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '60',
      timezone: 'Asia/Tehran',
      theme: light ? 'light' : 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      save_image: false,
      withdateranges: true,
      backgroundColor: light ? '#f8fafc' : '#0f172a',
      gridColor: light ? 'rgba(71, 85, 105, 0.12)' : 'rgba(148, 163, 184, 0.08)',
    })
    node.append(widget, script)

    return () => node.replaceChildren()
  }, [tvSymbol])

  return (
    <div className="space-y-1.5">
      <div
        role="region"
        aria-label={label}
        className="h-[520px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:h-[620px] lg:h-[720px]"
      >
        <div ref={container} className="tradingview-widget-container h-full w-full" />
      </div>
      <a
        href={symbolUrl}
        target="_blank"
        rel="noopener nofollow"
        dir="ltr"
        className="block text-end text-xs text-slate-500 hover:text-brand"
      >
        {symbol} chart by TradingView ↗
      </a>
    </div>
  )
}

export function AlertForm() {
  const router = useRouter()
  const { user } = useUser()
  const t = useT()
  const { lang } = useLang()

  const [symbol, setSymbol] = useState('')
  const [market, setMarket] = useState<Market>('spot')
  const [showChart, setShowChart] = useState(false)
  const [type, setType] = useState<Type>('price')
  const [basis, setBasis] = useState<Basis>('h24')
  const [timeframe, setTimeframe] = useState<TF>('1h')
  const [direction, setDirection] = useState<Dir>('above')
  const [target, setTarget] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('one_time')
  const [maxFires, setMaxFires] = useState('') // recurring only; blank = plan cap
  const [note, setNote] = useState('')

  const [chTelegram, setChTelegram] = useState(true)
  const [chEmail, setChEmail] = useState(false)
  const [chDiscord, setChDiscord] = useState(false)
  const [discordUrl, setDiscordUrl] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<Blocked | null>(null)
  const [busy, setBusy] = useState(false)

  // Entitlements arrive with the user. While they're loading nothing is locked,
  // so the form never flashes padlocks at a paying customer.
  const ent = user?.entitlements
  const tier: PlanId = user?.tier ?? 'free'
  const nextPlan = user?.nextPlan ?? 'pro'
  const fireCap = ent?.maxFiresPerAlert ?? 1
  const selectedChannels = [chTelegram, chEmail, chDiscord].filter(Boolean).length

  const typeLocked = (v: Type) => !!ent && !ent.alertTypes.includes(v)
  const tfLocked = (v: TF) => !!ent && !ent.timeframes.includes(v)
  const channelLocked = (v: ChannelType) => !!ent && !ent.channels.includes(v)

  function block(feature: string, detail?: string) {
    setError(null)
    setBlocked({ feature, detail })
  }

  // Turning a channel on can fail two ways: the plan doesn't have the channel at
  // all, or it already has as many channels on this alert as it may use.
  function toggleChannel(channel: ChannelType, next: boolean, set: (v: boolean) => void) {
    if (!next) return set(false)
    if (channelLocked(channel)) return block('channel', channel)
    if (ent && selectedChannels >= ent.channelsPerAlert)
      return block('channelsPerAlert', String(ent.channelsPerAlert))
    setBlocked(null)
    set(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBlocked(null)
    if (!symbol) return setError(t('یک نماد انتخاب کنید', 'Select a pair'))
    if (!target || Number.isNaN(Number(target))) return setError(t('مقدار هدف معتبر نیست', 'Target value is invalid'))

    let maxFiresNum: number | null = null
    if (repeat === 'recurring' && maxFires.trim() !== '') {
      maxFiresNum = Number(maxFires)
      if (!Number.isInteger(maxFiresNum) || maxFiresNum < 1)
        return setError(t('حداکثر دفعات تکرار باید عددی صحیح و حداقل ۱ باشد', 'Max repeats must be a whole number of at least 1'))
      if (maxFiresNum > fireCap) return block('maxFires', String(fireCap))
    }

    const channels: { type: string; identifier?: string }[] = []
    if (chTelegram) channels.push({ type: 'telegram' })
    // No identifier for email: the server always uses the account address.
    if (chEmail) channels.push({ type: 'email' })
    if (chDiscord) channels.push({ type: 'discord', identifier: discordUrl })
    if (!channels.length) return setError(t('حداقل یک کانال اعلان انتخاب کنید', 'Select at least one notification channel'))

    setBusy(true)
    try {
      await api('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          market,
          type,
          direction,
          target: Number(target),
          percentBasis: type === 'percent' ? basis : null,
          timeframe: type === 'candle_close' ? timeframe : null,
          repeat,
          maxFires: maxFiresNum,
          note: note.trim() || null,
          channels,
        }),
      })
      router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      const body = (err as unknown as { body?: Record<string, unknown> }).body ?? {}
      if (err.status === 402 && err.message === 'plan_upgrade_required')
        setBlocked({ feature: String(body.feature ?? 'plan'), detail: body.detail as string | undefined })
      else if (err.status === 402 && err.message === 'limit_reached')
        setError(
          t(
            `به سقف ${body.limit ?? ent?.alertLimit} هشدار پلن خود رسیده‌اید. برای ساخت هشدار جدید، یکی را حذف کنید.`,
            `You've reached your plan's ${body.limit ?? ent?.alertLimit}-alert limit. Delete one to create another.`,
          ),
        )
      else if (err.status === 402) setBlocked({ feature: 'alertLimit', detail: String(body.limit ?? '') })
      else if (err.message === 'telegram_not_linked') setError(t('ابتدا تلگرام خود را متصل کنید.', 'Link your Telegram first.'))
      else if (err.message === 'invalid_discord_webhook') setError(t('آدرس وبهوک دیسکورد معتبر نیست.', 'The Discord webhook URL is invalid.'))
      else if (err.message === 'no_price_yet')
        setError(t('قیمت لحظه‌ای این نماد هنوز دریافت نشده؛ چند ثانیه بعد دوباره تلاش کنید.', "This pair's live price isn't available yet; try again in a few seconds."))
      else setError(t('خطا در ساخت هشدار', 'Failed to create the alert'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label={t('نماد جفت‌ارز', 'Trading pair')}>
        <SymbolPicker
          value={symbol}
          market={market}
          onChange={(nextSymbol, nextMarket) => {
            setSymbol(nextSymbol)
            setMarket(nextMarket)
          }}
        />
      </Field>

      {symbol && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm text-slate-400">{t('نمودار تریدینگ‌ویو', 'TradingView chart')}</h2>
            <button
              type="button"
              onClick={() => setShowChart((visible) => !visible)}
              aria-expanded={showChart}
              aria-controls="tradingview-chart"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-50"
            >
              {showChart ? t('پنهان کردن نمودار', 'Hide chart') : t('نمایش نمودار', 'Show chart')}
            </button>
          </div>
          {showChart && (
            <div id="tradingview-chart">
              <TradingViewChart
                symbol={symbol}
                market={market}
                label={t(`نمودار تریدینگ‌ویو ${symbol}`, `${symbol} TradingView chart`)}
              />
            </div>
          )}
        </section>
      )}

      <Field label={t('نوع هشدار', 'Alert type')}>
        <Seg
          value={type}
          onChange={setType}
          onLocked={(v) => block(v)}
          options={[
            { value: 'price', label: t('قیمت', 'Price') },
            { value: 'percent', label: t('درصد تغییر', 'Percent change'), locked: typeLocked('percent') },
            { value: 'candle_close', label: t('بسته‌شدن کندل', 'Candle close'), locked: typeLocked('candle_close') },
          ]}
        />
      </Field>

      {type === 'candle_close' && (
        <Field label={t('تایم‌فریم کندل', 'Candle timeframe')}>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
            {TIMEFRAMES.map((tf) => {
              const locked = tfLocked(tf)
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => (locked ? block('timeframe', tf) : setTimeframe(tf))}
                  dir="ltr"
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                    timeframe === tf && !locked
                      ? 'bg-brand text-slate-950 font-semibold'
                      : locked
                        ? 'text-slate-500 hover:text-slate-300'
                        : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tf}
                  {locked && <LockIcon className="h-3 w-3" />}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-500">
            {t(
              'هشدار فقط پس از بسته‌شدن کامل کندل این تایم‌فریم بررسی می‌شود؛ نوسانات داخل کندل باعث اعلان اشتباه نمی‌شوند.',
              'Evaluated only after this timeframe’s candle fully closes — intrabar swings never cause a false alert.',
            )}
          </p>
        </Field>
      )}

      {type === 'percent' && (
        <Field label={t('مبنای درصد', 'Percent basis')}>
          <Seg
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'h24', label: t('۲۴ ساعت گذشته', 'Last 24h') },
              { value: 'since_created', label: t('از زمان ایجاد', 'Since created') },
            ]}
          />
        </Field>
      )}

      <Field label={t('جهت', 'Direction')}>
        <Seg
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'above', label: t('بالاتر از', 'Above') },
            { value: 'below', label: t('پایین‌تر از', 'Below') },
          ]}
        />
      </Field>

      <Field label={type === 'percent' ? t('درصد هدف', 'Target percent') : t('قیمت هدف', 'Target price')}>
        <input
          type="number"
          step="any"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={type === 'percent' ? t('مثلاً 5', 'e.g. 5') : t('مثلاً 70000', 'e.g. 70000')}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
        />
        {type !== 'percent' && symbol && (
          <div className="text-xs text-slate-500 flex gap-1">
            {t('قیمت فعلی:', 'Current price:')} <LivePrice symbol={symbol} market={market} />
          </div>
        )}
      </Field>

      <Field label={t('حالت تکرار', 'Repeat mode')}>
        <Seg
          value={repeat}
          onChange={setRepeat}
          onLocked={() => block('recurring')}
          options={[
            { value: 'one_time', label: t('یک‌بار', 'One-time') },
            {
              value: 'recurring',
              label: t('تکرارشونده', 'Recurring'),
              locked: !!ent && !ent.recurring,
            },
          ]}
        />
      </Field>

      {repeat === 'recurring' && (
        <Field label={t(`حداکثر دفعات تکرار (تا ${fireCap})`, `Max repeats (up to ${fireCap})`)}>
          <input
            type="number"
            min="1"
            max={fireCap}
            step="1"
            value={maxFires}
            onChange={(e) => setMaxFires(e.target.value)}
            placeholder={String(fireCap)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
          />
          <p className="text-xs text-slate-500">
            {t(
              `پس از این تعداد اعلان، هشدار متوقف می‌شود تا شما را اسپم نکند. خالی بگذارید تا سقف پلن شما (${fireCap}) اعمال شود.`,
              `The alert stops after this many notifications so it never spams you. Leave blank to use your plan's cap (${fireCap}).`,
            )}
          </p>
        </Field>
      )}

      <Field label={t('یادداشت (اختیاری)', 'Note (optional)')}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={t(
            'مثلاً: ۳۰٪ پوزیشن را ببند و حد ضرر را به نقطه ورود بیاور',
            'e.g. Close 30% of the position and move the stop to entry',
          )}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
        />
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">
            {t(
              'این یادداشت همراه اعلان برای شما فرستاده می‌شود؛ پس در لحطهٔ رسیدن قیمت دقیقاً می‌دانید قرار بود چه کاری انجام دهید.',
              'Sent to you with the notification, so the moment the price hits you know exactly what you meant to do.',
            )}
          </p>
          {note.length > 0 && (
            <span dir="ltr" className="shrink-0 text-xs text-slate-600">
              {note.length}/{NOTE_MAX}
            </span>
          )}
        </div>
      </Field>

      <Field label={t('کانال‌های اعلان', 'Notification channels')}>
        <div className="space-y-2">
          <Check
            checked={chTelegram}
            onChange={(v) => toggleChannel('telegram', v, setChTelegram)}
            locked={channelLocked('telegram')}
            label={`${t('تلگرام', 'Telegram')} ${user && !user.telegramLinked ? t('(متصل نشده)', '(not linked)') : ''}`}
          />
          <Check
            checked={chEmail}
            onChange={(v) => toggleChannel('email', v, setChEmail)}
            locked={channelLocked('email')}
            label={t('ایمیل', 'Email')}
          />
          {chEmail && user?.email && (
            <p className="ps-6 text-xs text-slate-500">
              {t('ارسال به ', 'Sent to ')}
              <span dir="ltr">{user.email}</span>
            </p>
          )}
          <Check
            checked={chDiscord}
            onChange={(v) => toggleChannel('discord', v, setChDiscord)}
            locked={channelLocked('discord')}
            label={t('دیسکورد (وبهوک)', 'Discord (webhook)')}
          />
          {chDiscord && (
            <input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
          {/* Announced, not yet deliverable — the API rejects sms on every plan. */}
          <label className="flex cursor-not-allowed items-center gap-2 text-sm text-slate-500">
            <input type="checkbox" disabled className="size-4" />
            <span>{t('پیامک موبایل', 'Mobile SMS')}</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
              {t('به‌زودی', 'Coming soon')}
            </span>
          </label>
          {ent && ent.channelsPerAlert === 1 && (
            <p className="text-xs text-slate-500">
              {t(
                'در پلن رایگان هر هشدار فقط یک کانال دارد؛ برای تغییر، اول کانال فعلی را بردارید.',
                'On the free plan each alert uses one channel — untick the current one to switch.',
              )}
            </p>
          )}
        </div>
      </Field>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {blocked && <UpgradeNotice blocked={blocked} tier={tier} nextPlan={nextPlan} lang={lang} t={t} />}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? t('در حال ساخت…', 'Creating…') : t('ساخت هشدار', 'Create alert')}
      </button>
    </form>
  )
}

// Names the exact thing the plan refused. "Candle close needs Pro" converts; a
// bare "upgrade required" does not.
function UpgradeNotice({
  blocked,
  tier,
  nextPlan,
  lang,
  t,
}: {
  blocked: Blocked
  tier: PlanId
  nextPlan: PlanId | null
  lang: 'fa' | 'en'
  t: (fa: string, en: string) => string
}) {
  const next = planName(nextPlan ?? 'gold', lang)
  const current = planName(tier, lang)
  const reason = (() => {
    switch (blocked.feature) {
      case 'percent':
        return t('هشدار درصد تغییر', 'Percent-change alerts')
      case 'candle_close':
        return t('هشدار بسته‌شدن کندل', 'Candle-close alerts')
      case 'timeframe':
        return t(`تایم‌فریم ${blocked.detail}`, `The ${blocked.detail} timeframe`)
      case 'recurring':
        return t('هشدار تکرارشونده', 'Recurring alerts')
      case 'channel':
        return t(`اعلان از طریق ${blocked.detail}`, `The ${blocked.detail} channel`)
      case 'channelsPerAlert':
        return t(
          `بیش از ${blocked.detail} کانال برای یک هشدار`,
          `More than ${blocked.detail} channel(s) on one alert`,
        )
      case 'maxFires':
        return t(`بیش از ${blocked.detail} بار تکرار اعلان`, `More than ${blocked.detail} notifications per alert`)
      case 'alertLimit':
        return t(
          `ساخت هشدار بیشتر از سقف ${blocked.detail} تایی پلن ${current}`,
          `More than the ${blocked.detail}-alert limit of the ${current} plan`,
        )
      default:
        return t('این قابلیت', 'This feature')
    }
  })()

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm space-y-1">
      <p className="text-amber-300">
        {t(`${reason} در پلن ${current} فعال نیست.`, `${reason} aren't included in the ${current} plan.`)}
      </p>
      <Link href="/billing" className="text-brand underline">
        {t(`ارتقا به پلن ${next} ←`, `Upgrade to ${next} →`)}
      </Link>
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  locked,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  locked?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer text-sm ${locked ? 'text-slate-500' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-emerald-500"
      />
      <span>{label}</span>
      {locked && <LockIcon />}
    </label>
  )
}
