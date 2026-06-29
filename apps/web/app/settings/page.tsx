'use client'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
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

      <button
        onClick={logout}
        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-400"
      >
        {t('خروج از حساب', 'Sign out')}
      </button>
    </div>
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
