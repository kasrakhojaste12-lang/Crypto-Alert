'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'

const MESSAGES: Record<string, string> = {
  email_taken: 'این ایمیل قبلاً ثبت شده است.',
  invalid_credentials: 'ایمیل یا رمز عبور نادرست است.',
  invalid_input: 'ایمیل معتبر و رمز حداقل ۶ کاراکتر وارد کنید.',
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isLogin = mode === 'login'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password }) })
      router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      setError(MESSAGES[err.message] || 'خطایی رخ داد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-brand">هشدار قیمت ارز دیجیتال</h1>
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

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
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
