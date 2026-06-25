'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { SymbolPicker, LivePrice } from './SymbolPicker'

type Type = 'price' | 'percent'
type Dir = 'above' | 'below'
type Basis = 'h24' | 'since_created'
type Repeat = 'one_time' | 'recurring'

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-lg text-sm transition ${
            value === o.value ? 'bg-brand text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
          }`}
        >
          {o.label}
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

export function AlertForm() {
  const router = useRouter()
  const { user } = useUser()

  const [symbol, setSymbol] = useState('')
  const [type, setType] = useState<Type>('price')
  const [basis, setBasis] = useState<Basis>('h24')
  const [direction, setDirection] = useState<Dir>('above')
  const [target, setTarget] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('one_time')

  const [chTelegram, setChTelegram] = useState(true)
  const [chDiscord, setChDiscord] = useState(false)
  const [discordUrl, setDiscordUrl] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [upgrade, setUpgrade] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUpgrade(false)
    if (!symbol) return setError('یک نماد انتخاب کنید')
    if (!target || Number.isNaN(Number(target))) return setError('مقدار هدف معتبر نیست')

    const channels: { type: string; identifier?: string }[] = []
    if (chTelegram) channels.push({ type: 'telegram' })
    if (chDiscord) channels.push({ type: 'discord', identifier: discordUrl })
    if (!channels.length) return setError('حداقل یک کانال اعلان انتخاب کنید')

    setBusy(true)
    try {
      await api('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          type,
          direction,
          target: Number(target),
          percentBasis: type === 'percent' ? basis : null,
          repeat,
          channels,
        }),
      })
      router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      if (err.status === 402) setUpgrade(true)
      else if (err.message === 'telegram_not_linked') setError('ابتدا تلگرام خود را متصل کنید.')
      else if (err.message === 'invalid_discord_webhook') setError('آدرس وبهوک دیسکورد معتبر نیست.')
      else if (err.message === 'no_price_yet') setError('قیمت لحظه‌ای این نماد هنوز دریافت نشده؛ چند ثانیه بعد دوباره تلاش کنید.')
      else setError('خطا در ساخت هشدار')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="نماد جفت‌ارز">
        <SymbolPicker value={symbol} onChange={setSymbol} />
      </Field>

      <Field label="نوع هشدار">
        <Seg
          value={type}
          onChange={setType}
          options={[
            { value: 'price', label: 'قیمت' },
            { value: 'percent', label: 'درصد تغییر' },
          ]}
        />
      </Field>

      {type === 'percent' && (
        <Field label="مبنای درصد">
          <Seg
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'h24', label: '۲۴ ساعت گذشته' },
              { value: 'since_created', label: 'از زمان ایجاد' },
            ]}
          />
        </Field>
      )}

      <Field label="جهت">
        <Seg
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'above', label: 'بالاتر از' },
            { value: 'below', label: 'پایین‌تر از' },
          ]}
        />
      </Field>

      <Field label={type === 'price' ? 'قیمت هدف' : 'درصد هدف'}>
        <input
          type="number"
          step="any"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={type === 'price' ? 'مثلاً 70000' : 'مثلاً 5'}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
        />
        {type === 'price' && symbol && (
          <div className="text-xs text-slate-500 flex gap-1">
            قیمت فعلی: <LivePrice symbol={symbol} />
          </div>
        )}
      </Field>

      <Field label="حالت تکرار">
        <Seg
          value={repeat}
          onChange={setRepeat}
          options={[
            { value: 'one_time', label: 'یک‌بار' },
            { value: 'recurring', label: 'تکرارشونده' },
          ]}
        />
      </Field>

      <Field label="کانال‌های اعلان">
        <div className="space-y-2">
          <Check
            checked={chTelegram}
            onChange={setChTelegram}
            label={`تلگرام ${user && !user.telegramLinked ? '(متصل نشده)' : ''}`}
          />
          <Check checked={chDiscord} onChange={setChDiscord} label="دیسکورد (وبهوک)" />
          {chDiscord && (
            <input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              dir="ltr"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
        </div>
      </Field>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {upgrade && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="text-amber-300">به سقف ۳ هشدار رایگان رسیده‌اید.</p>
          <Link href="/billing" className="text-brand underline">
            ارتقا به اشتراک ←
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? 'در حال ساخت…' : 'ساخت هشدار'}
      </button>
    </form>
  )
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-emerald-500"
      />
      <span>{label}</span>
    </label>
  )
}
