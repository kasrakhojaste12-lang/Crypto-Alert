'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { LangToggle } from '@/components/LangToggle'
import { Logo } from '@/components/Logo'

function Reset() {
  const t = useT()
  const router = useRouter()
  const token = useSearchParams().get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError(t('رمزهای عبور مطابقت ندارند', 'Passwords do not match'))
      return
    }
    setBusy(true)
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      })
      setDone(true)
      setTimeout(() => router.replace('/login'), 2000)
    } catch (e) {
      const err = e as ApiError
      setError(
        err.message === 'invalid_token'
          ? t('این لینک نامعتبر یا منقضی شده است. دوباره درخواست دهید.', 'This link is invalid or has expired. Request a new one.')
          : err.message === 'invalid_input'
            ? t('رمز عبور باید حداقل ۶ کاراکتر باشد.', 'Password must be at least 6 characters.')
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
          <h1 className="text-2xl font-bold text-brand">{t('تعیین رمز عبور جدید', 'Set a new password')}</h1>
        </div>

        {done ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-sm text-slate-300">{t('رمز عبور شما تغییر کرد. در حال انتقال به ورود…', 'Your password has been changed. Redirecting to login…')}</p>
          </div>
        ) : !token ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-4">
            <p className="text-sm text-rose-400">{t('لینک نامعتبر است.', 'Invalid link.')}</p>
            <Link href="/forgot" className="inline-block text-brand text-sm">{t('درخواست لینک جدید', 'Request a new link')}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="space-y-2">
              <label className="block text-sm text-slate-400">{t('رمز عبور جدید', 'New password')}</label>
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
            <div className="space-y-2">
              <label className="block text-sm text-slate-400">{t('تکرار رمز عبور جدید', 'Confirm new password')}</label>
              <input
                type="password"
                dir="ltr"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? '...' : t('تغییر رمز عبور', 'Change password')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-400">…</div>}>
      <Reset />
    </Suspense>
  )
}
