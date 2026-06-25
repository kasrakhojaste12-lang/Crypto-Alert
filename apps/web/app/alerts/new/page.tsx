'use client'
import Link from 'next/link'
import { Shell } from '@/components/Shell'
import { AlertForm } from '@/components/AlertForm'

export default function NewAlertPage() {
  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard" className="hover:text-white">
            هشدارها
          </Link>
          <span>/</span>
          <span className="text-white">هشدار جدید</span>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <AlertForm />
        </div>
      </div>
    </Shell>
  )
}
