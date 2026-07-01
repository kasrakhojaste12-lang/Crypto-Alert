'use client'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import { LangToggle } from '@/components/LangToggle'
import { Logo } from '@/components/Logo'
import { TelegramBanner } from '@/components/TelegramBanner'

export default function Home() {
  const t = useT()
  const features = [
    {
      icon: '🔔',
      title: t('هشدار قیمت و درصد', 'Price & percent alerts'),
      body: t(
        'برای رسیدن به یک قیمت مشخص یا درصد تغییر ۲۴ ساعته، دقیقاً همان لحظه باخبر شو.',
        'Get notified the instant a pair hits a target price or a 24h percent move.',
      ),
    },
    {
      icon: '🪙',
      title: t('همهٔ جفت‌ارزهای بایننس', 'Every Binance pair'),
      body: t(
        'روی هر جفت‌ارز فعال بایننس هشدار بساز — جفت‌ارزهای جدید هم خودکار اضافه می‌شوند.',
        'Set alerts on any active Binance pair — newly listed pairs are added automatically.',
      ),
    },
    {
      icon: '⚡',
      title: t('اعلان تلگرام و دیسکورد', 'Telegram & Discord'),
      body: t(
        'پیام فوری در تلگرام یا دیسکورد، بدون تأخیر و بدون اسپم؛ هر هشدار فقط یک‌بار.',
        'Instant Telegram or Discord messages — no delay, no spam, each alert fires once.',
      ),
    },
  ]

  return (
    <main className="min-h-screen">
      <TelegramBanner />
      <header className="mx-auto max-w-3xl px-4">
        <div className="h-14 flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-brand whitespace-nowrap">
            <Logo className="h-8 w-auto" />
            {t('الرت کی', 'Alert Key')}
          </span>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition">
              {t('ورود', 'Login')}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
        <Logo className="h-24 w-auto mx-auto mb-4" />
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
          {t('هشدار قیمت ارز دیجیتال،', 'Crypto price alerts,')}
          <br />
          <span className="text-brand">{t('همان لحظه‌ای که مهم است', 'the moment they matter')}</span>
        </h1>
        <p className="text-slate-400 mt-4 max-w-md mx-auto">
          {t(
            'روی هر جفت‌ارز بایننس هشدار قیمت یا درصد تغییر بساز و در تلگرام و دیسکورد فوری باخبر شو — جایگزین ارزان‌تر هشدارهای تریدینگ‌ویو.',
            'Set price or percent-change alerts on any Binance pair and get notified instantly on Telegram and Discord — a cheaper alternative to TradingView alerts.',
          )}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 hover:bg-brand-dark transition"
          >
            {t('رایگان شروع کن', 'Start free')}
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500 transition"
          >
            {t('ورود', 'Login')}
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          {t('۳ هشدار رایگان — بدون نیاز به کارت بانکی', '3 free alerts — no card required')}
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-2">
            <div className="text-2xl">{f.icon}</div>
            <h2 className="font-semibold">{f.title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-8 text-center space-y-4">
          <h2 className="text-xl font-bold">{t('آمادهٔ ساختن اولین هشدار؟', 'Ready to build your first alert?')}</h2>
          <p className="text-sm text-slate-400">
            {t(
              'ثبت‌نام در کمتر از یک دقیقه. تا ۳۰ هشدار با اشتراک ماهانه و پرداخت امن از طریق زیبال.',
              'Sign up in under a minute. Up to 30 alerts with a monthly subscription, paid securely via Zibal.',
            )}
          </p>
          <Link
            href="/register"
            className="inline-block rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 hover:bg-brand-dark transition"
          >
            {t('ساختن حساب رایگان', 'Create a free account')}
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-600">
        <div className="mb-4 flex items-center justify-center gap-2 text-slate-500">
          <Logo className="h-5 w-auto" />
          {t('الرت کی — هشدار قیمت ارز دیجیتال', 'Alert Key — crypto price alerts')}
        </div>
        <div className="mb-6 flex items-center justify-center gap-4">
          {/* Enamad trust seal — referrerPolicy=origin lets Enamad verify the domain */}
          {/* eslint-disable-next-line react/jsx-no-target-blank */}
          <a
            referrerPolicy="origin"
            target="_blank"
            href="https://trustseal.enamad.ir/?id=751293&Code=kh6ufFn09c4PTC0RsilJJjeVt4JfOOHw"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="origin"
              loading="lazy"
              decoding="async"
              src="https://trustseal.enamad.ir/logo.aspx?id=751293&Code=kh6ufFn09c4PTC0RsilJJjeVt4JfOOHw"
              alt="Enamad"
              style={{ cursor: 'pointer', minHeight: 90 }}
              // Enamad blocks foreign IPs; if the live seal fails to load, fall
              // back to the origin-hosted copy so overseas users don't see a
              // broken icon. Iranian users still load it live (verification intact).
              onError={(e) => {
                const el = e.currentTarget
                if (!el.src.endsWith('/enamad-seal.png')) el.src = '/enamad-seal.png'
              }}
              {...({ code: 'kh6ufFn09c4PTC0RsilJJjeVt4JfOOHw' } as any)}
            />
          </a>
          {/* Zibal trust badge — zibal.ir is Iran-hosted, loads fine inside Iran */}
          <a href="https://gateway.zibal.ir/trustMe/alertkey.ir" target="_blank" rel="noopener">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" style={{ maxWidth: 110, height: 'auto' }} src="https://zibal.ir/trust/assets/2.png" alt="Zibal" />
          </a>
        </div>
      </footer>
    </main>
  )
}
