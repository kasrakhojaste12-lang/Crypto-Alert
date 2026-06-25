'use client'
import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@/lib/useUser'

function Result() {
  const params = useSearchParams()
  const ok = params.get('status') === 'success'
  const { mutate } = useUser()

  useEffect(() => {
    mutate() // refresh plan after returning from the gateway
  }, [mutate])

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm text-center rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-4">
        <div className="text-5xl">{ok ? '✅' : '❌'}</div>
        <h1 className="text-xl font-bold">{ok ? 'پرداخت موفق' : 'پرداخت ناموفق'}</h1>
        <p className="text-sm text-slate-400">
          {ok ? 'اشتراک شما فعال شد. اکنون می‌توانید هشدار نامحدود بسازید.' : 'پرداخت انجام نشد یا لغو شد.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-slate-950 hover:bg-brand-dark"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  )
}

export default function BillingResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-400">…</div>}>
      <Result />
    </Suspense>
  )
}
