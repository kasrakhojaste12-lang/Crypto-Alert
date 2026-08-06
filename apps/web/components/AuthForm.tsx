'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'
import { useLang, useT } from '@/lib/i18n'
import { LangToggle } from '@/components/LangToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/Logo'
import { GoogleIcon } from '@/components/BrandIcons'
import { EyeIcon, EyeOffIcon } from '@/components/Icons'
import { WelcomeModal } from '@/components/WelcomeModal'

const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const t = useT()
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null) // set => show welcome modal
  const boxRef = useRef<HTMLDivElement>(null)
  const googleBoxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  const isLogin = mode === 'login'

  // Always call the latest submit handler from the GIS callback (which is bound
  // once at init), so a language switch doesn't leave it on a stale closure.
  const submitGoogleRef = useRef<(credential: string) => void>(() => {})
  submitGoogleRef.current = submitGoogle

  // Cloudflare Turnstile widget; re-rendered when the language changes.
  useEffect(() => {
    if (!SITEKEY) return
    let cancelled = false
    const render = () => {
      if (cancelled || !window.turnstile || !boxRef.current) return
      if (widgetId.current) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
      setToken('')
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: SITEKEY,
        theme: 'dark',
        language: lang,
        callback: (tok: string) => setToken(tok),
        'error-callback': () => setToken(''),
        'expired-callback': () => setToken(''),
      })
    }
    const SCRIPT_ID = 'cf-turnstile'
    if (window.turnstile) {
      render()
    } else {
      let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (!s) {
        s = document.createElement('script')
        s.id = SCRIPT_ID
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener('load', render)
    }
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
    }
  }, [lang])

  // Google Identity Services renders an un-restylable iframe button, so we hide
  // it (opacity-0, overlaid) and drive clicks through our own themed button
  // below — same verified ID-token flow, but it matches the site theme. Load the
  // GIS script once; only re-render the (invisible) button when login/register
  // flips so its accessible label stays correct.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    const render = () => {
      if (cancelled || !window.google || !googleBoxRef.current) return
      googleBoxRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        callback: ({ credential }: { credential: string }) => void submitGoogleRef.current(credential),
      })
      window.google.accounts.id.renderButton(googleBoxRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: isLogin ? 'signin_with' : 'signup_with',
        shape: 'rectangular',
        width: googleBoxRef.current.clientWidth || 360,
      })
    }
    const SCRIPT_ID = 'google-identity-services'
    if (window.google) {
      render()
    } else {
      let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (!s) {
        s = document.createElement('script')
        s.id = SCRIPT_ID
        s.src = 'https://accounts.google.com/gsi/client'
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener('load', render)
    }
    return () => {
      cancelled = true
    }
  }, [isLogin])

  async function submitGoogle(credential: string) {
    setError(null)
    setBusy(true)
    const messages: Record<string, string> = {
      account_exists_use_password: t('این حساب را با رمز عبور وارد شوید.', 'This account must be accessed with its password.'),
      invalid_google_credential: t('ورود با گوگل ناموفق بود. دوباره تلاش کنید.', 'Google sign-in failed. Please try again.'),
      google_auth_unavailable: t('ورود با گوگل موقتاً در دسترس نیست.', 'Google sign-in is temporarily unavailable.'),
    }
    try {
      const resp = await api('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      if (resp?.premium?.until) setPremiumUntil(resp.premium.until)
      else router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      setError(messages[err.message] || t('خطایی رخ داد', 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isLogin && password !== confirmPassword) {
      setError(t('رمزهای عبور مطابقت ندارند', 'Passwords do not match'))
      return
    }
    setBusy(true)
    const messages: Record<string, string> = {
      email_taken: t('این ایمیل قبلاً ذبت شده است.', 'This email is already registered.'),
      invalid_credentials: t('ایمیل یا رمز عبور نادرست است.', 'Invalid email or password.'),
      invalid_input: t('ایمیل معتبر و رمز حداقل ۶ کاراکتر وارد کنید.', 'Enter a valid email and a password of at least 6 characters.'),
      captcha_failed: t('تأیید امنیتی ناموفق بود. دوباره تلاش کنید.', 'Security check failed. Please try again.'),
    }
    try {
      const resp = await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken: token }),
      })
      // New signups during the launch campaign get free Premium — celebrate it
      // with the welcome modal before entering the app.
      if (!isLogin && resp?.premium?.until) setPremiumUntil(resp.premium.until)
      else router.push('/dashboard')
    } catch (e) {
      const err = e as ApiError
      setError(messages[err.message] || t('خطایی رخ داد', 'Something went wrong'))
      if (SITEKEY && widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current)
        setToken('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen grid place-items-center px-4">
      <div className="absolute top-4 end-4 flex items-center gap-2">
        <ThemeToggle />
        <LangToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo className="h-20 w-auto mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-brand">{t('الرت کی', 'Alert Key')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? t('به حساب خود وارد شوید', 'Sign in to your account') : t('یک حساب جدید بسازید', 'Create a new account')}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          {GOOGLE_CLIENT_ID && (
            <>
              <div className="relative h-12">
                {/* Visible, theme-matched button (auto-flips light/dark via slate-*) */}
                <div
                  aria-hidden="true"
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900 font-semibold text-slate-100 transition hover:border-brand hover:bg-slate-800"
                >
                  <GoogleIcon className="h-5 w-5" />
                  {isLogin ? t('ورود با گوگل', 'Sign in with Google') : t('ثبت‌نام با گوگل', 'Sign up with Google')}
                </div>
                {/* Real Google button, invisible, overlaid to capture the click */}
                <div ref={googleBoxRef} className="absolute inset-0 flex items-center justify-center opacity-0" />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-800" />
                {t('یا', 'or')}
                <span className="h-px flex-1 bg-slate-800" />
              </div>
            </>
          )}
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
          <PasswordField
            label={t('رمز عبور', 'Password')}
            value={password}
            onChange={setPassword}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            showLabel={t('نمایش رمز عبور', 'Show password')}
            hideLabel={t('پنهان کردن رمز عبور', 'Hide password')}
          />

          {isLogin && (
            <div className="text-end">
              <Link href="/forgot" className="text-xs text-slate-400 hover:text-brand">
                {t('رمز عبور را فراموش کرده‌اید؟', 'Forgot password?')}
              </Link>
            </div>
          )}

          {!isLogin && (
            <PasswordField
              label={t('تکرار رمز عبور', 'Confirm password')}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              showLabel={t('نمایش رمز عبور', 'Show password')}
              hideLabel={t('پنهان کردن رمز عبور', 'Hide password')}
            />
          )}

          {SITEKEY && <div ref={boxRef} className="flex justify-center" />}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || (!!SITEKEY && !token)}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? '...' : isLogin ? t('ورود', 'Login') : t('ثبت‌نام', 'Sign up')}
          </button>

          <p className="text-center text-sm text-slate-400">
            {isLogin ? t('حساب ندارید؟ ', 'No account? ') : t('حساب دارید؟ ', 'Have an account? ')}
            <Link href={isLogin ? '/register' : '/login'} className="text-brand">
              {isLogin ? t('ثبت‌نام', 'Sign up') : t('ورود', 'Login')}
            </Link>
          </p>
        </form>
      </div>

      {premiumUntil && (
        <WelcomeModal until={premiumUntil} onStart={() => router.push('/dashboard')} />
      )}
    </div>
  )
}

// Password input with a reveal toggle. The wrapper is forced to LTR so the eye
// sits opposite the (always LTR) password text in both languages.
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showLabel,
  hideLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  showLabel: string
  hideLabel: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-2">
      <label className="block text-sm text-slate-400">{label}</label>
      <div className="relative" dir="ltr">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pe-11 outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          title={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-100"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}
