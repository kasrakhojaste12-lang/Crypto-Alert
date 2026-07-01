'use client'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { useCampaign } from '@/lib/useCampaign'
import { Countdown } from '@/components/Countdown'

// Landing-page launch-offer banner: free Premium for every new signup until the
// campaign ends. Self-contained — renders nothing once the campaign is over.
export function CampaignBanner() {
  const t = useT()
  const campaign = useCampaign()
  if (!campaign?.active) return null

  const benefits = [
    t('تا ۳۰ هشدار فعال', 'Up to 30 active alerts'),
    t('هشدار قیمت، درصد و بسته‌شدن کندل', 'Price, percent & candle-close alerts'),
    t('اعلان تلگرام و دیسکورد', 'Telegram & Discord notifications'),
    t('هشدارهای تکرارشونده', 'Recurring alerts'),
  ]

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-emerald-500 to-brand-dark p-6 text-slate-950 shadow-xl shadow-brand/20 sm:p-8">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -top-16 -end-10 h-48 w-48 rounded-full bg-white/20 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950/15 px-3 py-1 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-950/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-950" />
            </span>
            🎉 {t('پیشنهاد ویژهٔ افتتاحیه', 'Limited-Time Launch Offer')}
          </span>

          <div>
            <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {t('دسترسی رایگان به پریمیوم', 'Free Premium Access')}
            </h2>
            <p className="mt-2 max-w-xl text-sm font-medium text-slate-950/80">
              {t(
                'هر کاربری که همین حالا ثبت‌نام کند، تا پایان کمپین اشتراک پریمیوم را کاملاً رایگان دریافت می‌کند. فقط برای مدت محدود!',
                'Sign up now and every new account gets full Premium — completely free until the campaign ends. Available for a limited time only!',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {benefits.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/10 px-3 py-1 text-xs font-semibold">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
                {b}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-950/70">
                {t('پایان پیشنهاد تا', 'Offer ends in')}
              </p>
              <Countdown endsAt={campaign.endsAt} />
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-900"
            >
              {t('رایگان پریمیوم را فعال کن ←', 'Claim Free Premium →')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
