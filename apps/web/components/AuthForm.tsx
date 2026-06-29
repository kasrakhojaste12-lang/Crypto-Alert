'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'

const MESSAGES: Record<string, string> = {
  email_taken: 'این ایمیل قبلاً ثبت شده است.',
  invalid_credentials: 'ایمیل یا رمز عبور نادرست است.',
  invalid_input: 'ایمیل معتبر و رمز حداقل ۶ کاراکتر وارد کنید.',
  captcha_failed: 'تأیید امنیتی ناموفق بود. دوباره تلاش کنید.',
}

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
  }
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  const isLogin = mode === 'login'

  // Cloudflare Turnstile widget (only when a sitekey is configured).
  useEffect(() => {
    if (!SITEKEY) return
    const render = () => {
      if (!window.turnstile || !boxRef.current || widgetId.current) return
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: SITEKEY,
        callback: (t: string) => setToken(t),
        'error-callback': () => setToken(''),
        'expired-callback': () => setToken(''),
      })
    }
    const SCRIPT_ID = 'cf-turnstile'
    if (document.getElementById(SCRIPT_ID)) {
      render()
    } else {
      const s = document.createElement('script')
      s.id = SCRIPT_ID
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = undefined
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken: token }),
      })
      router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      setError(MESSAGES[err.message] || 'خطایی رخ داد')
      // let the user solve a fresh challenge after a failed attempt
      if (SITEKEY && widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current)
        setToken('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-brand">الرت کی</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? 'به حساب خود وارد شوید' : 'یک حساب جدید بسازید'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">ایمیل</label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-slate-400">رمز عبور</label>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>

          {SITEKEY && <div ref={boxRef} className="flex justify-center" />}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || (!!SITEKEY && !token)}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? '...' : isLogin ? 'ورود' : 'ثبت‌نام'}
          </button>

          <p className="text-center text-sm text-slate-400">
            {isLogin ? 'حساب ندارید؟ ' : 'حساب دارید؟ '}
            <Link href={isLogin ? '/register' : '/login'} className="text-brand">
              {isLogin ? 'ثبت‌نام' : 'ورود'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
