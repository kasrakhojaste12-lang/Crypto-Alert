'use client'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useUser } from '@/lib/useUser'
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

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">تنظیمات حساب</h1>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 divide-y divide-slate-800">
        <Row label="ایمیل" value={<span dir="ltr">{user?.email}</span>} />
        <Row label="پلن" value={user?.plan === 'paid' ? 'اشتراک فعال' : 'رایگان'} />
        <Row label="تلگرام" value={user?.telegramLinked ? 'متصل' : 'متصل نشده'} />
        <Row
          label="هشدارهای فعال"
          value={`${user?.activeAlerts ?? 0} از ${user?.plan === 'paid' ? '∞' : user?.freeLimit ?? 3}`}
        />
      </div>

      <button
        onClick={logout}
        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-rose-500 hover:text-rose-400"
      >
        خروج از حساب
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
