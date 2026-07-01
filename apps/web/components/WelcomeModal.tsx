'use client'
import { useLang, useT } from '@/lib/i18n'

// Celebratory post-signup modal: confirms the free-Premium launch grant and
// pushes the user straight into the product. `until` is the ISO expiry date.
export function WelcomeModal({ until, onStart }: { until: string; onStart: () => void }) {
  const t = useT()
  const { lang } = useLang()
  const date = new Date(until).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onStart}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl"
      >
        {/* emerald celebration glow */}
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-brand/30 blur-3xl" />

        <div className="relative">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-4xl ring-1 ring-brand/30">
            🎉
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand">
            🚀 {t('مزیت افتتاحیهٔ محدود', 'Limited-time launch benefit')}
          </span>

          <h2 className="mt-4 text-2xl font-extrabold">{t('خوش آمدید!', 'Welcome aboard!')}</h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {t('عضویت ', 'Your ')}
            <span className="font-bold text-brand">{t('پریمیوم', 'Premium')}</span>
            {t(' شما به‌صورت ', ' membership has been activated ')}
            <span className="font-bold text-brand">{t('رایگان', 'FREE')}</span>
            {t(' تا ', ' until ')}
            <span dir={lang === 'fa' ? 'rtl' : 'ltr'} className="font-bold">{date}</span>
            {t(
              ' فعال شد. در طول کمپین افتتاحیه از تمام امکانات پریمیوم لذت ببرید.',
              '. Enjoy full access to all premium features during the launch campaign.',
            )}
          </p>

          <button
            onClick={onStart}
            className="mt-6 w-full rounded-xl bg-brand py-3 font-bold text-slate-950 transition hover:bg-brand-dark"
          >
            {t('شروع کن ←', 'Start Exploring →')}
          </button>
        </div>
      </div>
    </div>
  )
}
