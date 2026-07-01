'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type ApiError } from '@/lib/api'
import { useUser } from '@/lib/useUser'
import { useLang, useT } from '@/lib/i18n'
import { fmtNum } from '@/lib/format'
import { Shell } from '@/components/Shell'

export default function SettingsPage() {
  return (
    <Shell>
      <Settings />
    </Shell>
  )
}

function Settings() {
  const { user } = useUser()
  const router = useRouter()
  const t = useT()
  const { lang } = useLang()

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  const activeAlerts = fmtNum(user?.activeAlerts ?? 0, lang)
  const cap = user?.plan === 'paid' ? '∞' : fmtNum(user?.freeLimit ?? 3, lang)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('تنظیمات حساب', 'Account settings')}</h1>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800">
        <Row label={t('ایمیل', 'Email')} value={<span dir="ltr">{user?.email}</span>} />
        <Row label={t('پلن', 'Plan')} value={user?.plan === 'paid' ? t('اشتراک فعال', 'Active') : t('رایگان', 'Free')} />
        <Row label={t('تلگرام', 'Telegram')} value={user?.telegramLinked ? t('متصل', 'Connected') : t('متصل نشده', 'Not connected')} />
        <Row
          label={t('هشدارهای فعال', 'Active alerts')}
          value={t(`${activeAlerts} از ${cap}`, `${activeAlerts} of ${cap}`)}
        />
      </div>

      <ChangePassword />

      <button
        onClick={logout}
        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-400"
      >
        {t('خروج از حساب', 'Sign out')}
      </button>
    </div>
  )
}

function ChangePassword() {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) {
      setMsg({ ok: false, text: t('رمزهای عبور جدید مطابقت ندارند', 'New passwords do not match') })
      return
    }
    setBusy(true)
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      setMsg({ ok: true, text: t('رمز عبور تغییر کرد', 'Password changed') })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (e) {
      const err = e as ApiError
      setMsg({
        ok: false,
        text:
          err.message === 'wrong_password'
            ? t('رمز عبور فعلی نادرست است', 'Current password is incorrect')
            : err.message === 'invalid_input'
              ? t('رمز جدید باید حداقل ۶ کاراکتر باشد', 'New password must be at least 6 characters')
              : t('خطایی رخ داد', 'Something went wrong'),
      })
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-2">
      <label className="block text-sm text-slate-400">{label}</label>
      <input
        type="password"
        dir="ltr"
        value={value}
        onChange={(e) => set(e.target.value)}
        required
        minLength={6}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 outline-none focus:border-brand"
      />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="font-semibold">{t('تغییر رمز عبور', 'Change password')}</h2>
      {field(t('رمز عبور فعلی', 'Current password'), current, setCurrent)}
      {field(t('رمز عبور جدید', 'New password'), next, setNext)}
      {field(t('تکرار رمز عبور جدید', 'Confirm new password'), confirm, setConfirm)}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? '...' : t('ذخیره رمز جدید', 'Save new password')}
      </button>
    </form>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}
