'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api, type ApiError } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { LangToggle } from '@/components/LangToggle'
import { Logo } from '@/components/Logo'
import { Turnstile } from '@/components/Turnstile'

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

export default function ForgotPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, turnstileToken: token }),
      })
      setSent(true)
    } catch (e) {
      const err = e as ApiError
      setError(
        err.message === 'captcha_failed'
          ? t('تأیید امنیتی ناموفق بود. دوباره تلاش کنید.', 'Security check failed. Please try again.')
          : t('خطایی رخ داد', 'Something went wrong'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen grid place-items-center px-4">
      <div className="absolute top-4 end-4">
        <LangToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo className="h-20 w-auto mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-brand">{t('بازیابی رمز عبور', 'Reset password')}</h1>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="text-sm text-slate-300">
              {t(
                'اگر این ایمیل ثبت شده باشد، لینک بازنشانی برایش ارسال شد. صندوق ورودی (و پوشهٔ اسپم) را بررسی کنید.',
                'If that email is registered, a reset link has been sent. Check your inbox (and spam folder).',
              )}
            </p>
            <Link href="/login" className="inline-block text-brand text-sm">
              {t('بازگشت به ورود', 'Back to login')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm text-slate-400">
              {t(
                'ایمیل حساب خود را وارد کنید تا لینک بازنشانی رمز عبور برایتان ارسال شود.',
                "Enter your account email and we'll send you a reset link.",
              )}
            </p>
            <div className="space-y-2">
              <label className="block text-sm text-slate-400">{t('ایمیل', 'Email')}</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
              />
            </div>
            <Turnstile onToken={setToken} />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || (!!SITEKEY && !token)}
              className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? '...' : t('ارسال لینک بازنشانی', 'Send reset link')}
            </button>
            <p className="text-center text-sm text-slate-400">
              <Link href="/login" className="text-brand">
                {t('بازگشت به ورود', 'Back to login')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
