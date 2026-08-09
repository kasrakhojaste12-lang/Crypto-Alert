'use client'
import Link from 'next/link'
import { useLang, useT } from '@/lib/i18n'
import { useUser } from '@/lib/useUser'
import { fmtNum } from '@/lib/format'
import { LangToggle } from '@/components/LangToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Logo } from '@/components/Logo'
import { CoinTicker } from '@/components/CoinTicker'
import { MobileMenu } from '@/components/MobileMenu'
import { TelegramBanner } from '@/components/TelegramBanner'
import { CampaignBanner } from '@/components/CampaignBanner'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export default function Home() {
  const t = useT()
  const { lang } = useLang()
  const { user, isLoading } = useUser()
  // The session is unknown until /api/auth/me answers. Rendering the guest
  // buttons in the meantime is what made a signed-in visit look signed-out, so
  // the CTAs hold their space and stay invisible until the answer arrives.
  const authPending = isLoading && !user
  const hidden = authPending ? 'invisible' : ''

  const navItems = [
    { href: '#features', label: t('امکانات', 'Features') },
    { href: '#how', label: t('روش کار', 'How it works') },
    { href: '/billing', label: t('قیمت‌گذاری', 'Pricing') },
  ]

  const features = [
    {
      icon: (
        <Icon>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Icon>
      ),
      title: t('هشدار قیمت و درصد', 'Price & percent alerts'),
      body: t(
        'برای رسیدن به یک قیمت مشخص یا درصد تغییر ۲۴ ساعته، دقیقاً همان لحظه باخبر شو.',
        'Get notified the instant a pair hits a target price or a 24h percent move.',
      ),
    },
    {
      icon: (
        <Icon>
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </Icon>
      ),
      title: t('همهٔ جفت‌ارزهای بایننس', 'Every Binance pair'),
      body: t(
        'روی هر جفت‌ارز فعال بایننس هشدار بساز — جفت‌ارزهای جدید هم خودکار اضافه می‌شوند.',
        'Set alerts on any active Binance pair — newly listed pairs are added automatically.',
      ),
    },
    {
      icon: (
        <Icon>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </Icon>
      ),
      title: t('اعلان تلگرام، ایمیل و دیسکورد', 'Telegram, email & Discord'),
      body: t(
        'پیام فوری در تلگرام، ایمیل یا دیسکورد، بدون تأخیر و بدون اسپم؛ هر هشدار فقط یک‌بار.',
        'Instant Telegram, email, or Discord messages — no delay, no spam, each alert fires once.',
      ),
    },
    {
      icon: (
        <Icon>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-5 3 3 5-7" />
        </Icon>
      ),
      title: t('کندل و روند بازار', 'Candle & trend aware'),
      body: t(
        'هشدار بسته‌شدن کندل روی هر تایم‌فریم، برای معامله‌گرانی که با روند کار می‌کنند.',
        'Candle-close alerts on any timeframe, for traders who follow the chart, not just a number.',
      ),
    },
    {
      icon: (
        <Icon>
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </Icon>
      ),
      title: t('دادهٔ امن، بدون واسطه', 'Secure, no middlemen'),
      body: t(
        'داده مستقیم از بایننس؛ هیچ کلید یا دسترسی به صرافی‌ات لازم نیست.',
        'Data straight from Binance — no exchange API key or account access required.',
      ),
    },
    {
      icon: (
        <Icon>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </Icon>
      ),
      title: t('تکرارشونده یا یک‌بار', 'Recurring or one-shot'),
      body: t(
        'یا فقط یک‌بار فایر شود، یا هر بار که شرط دوباره برقرار شد دوباره باخبرت کند.',
        'Fire once and disarm, or keep firing every time the condition happens again.',
      ),
    },
  ]

  const steps = [
    {
      n: '۱',
      title: t('نماد و شرط را انتخاب کن', 'Pick a pair and a condition'),
      body: t('از بین هزاران جفت‌ارز بایننس، هدف قیمتی یا درصدی‌ات را بگذار.', 'Choose any Binance pair and set a price or percent target.'),
    },
    {
      n: '۲',
      title: t('کانال اعلان را وصل کن', 'Connect a notification channel'),
      body: t('تلگرام، ایمیل یا وبهوک دیسکورد — هر کدام را خواستی روشن کن.', 'Telegram, email, or a Discord webhook — turn on whichever you like.'),
    },
    {
      n: '۳',
      title: t('برو سراغ زندگی‌ات', 'Get on with your day'),
      body: t('موتور ما بازار را زیر نظر دارد و دقیقاً همان لحظه پیام می‌فرستد.', 'Our engine watches the market and pings you the instant it matters.'),
    },
  ]

  return (
    <main className="min-h-screen">
      <TelegramBanner />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold whitespace-nowrap shrink-0">
              <Logo className="h-8 w-auto" />
              <span className="gradient-text">{t('الرت کی', 'Alert Key')}</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <LangToggle />
              {user ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-brand px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-brand-dark transition"
                >
                  {t('داشبورد', 'Dashboard')}
                </Link>
              ) : (
                <>
                  <Link href="/login" className={`text-sm text-slate-400 hover:text-white transition ${hidden}`}>
                    {t('ورود', 'Login')}
                  </Link>
                  <Link
                    href="/register"
                    className={`rounded-xl bg-brand px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-brand-dark transition ${hidden}`}
                  >
                    {t('رایگان شروع کن', 'Start free')}
                  </Link>
                </>
              )}
            </div>

            <MobileMenu items={navItems} authed={!!user} />
          </div>
        </div>
      </header>

      <CoinTicker />
      <CampaignBanner />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="crypto-grid absolute inset-0 -z-10 h-[32rem]" />
        <div className="mx-auto max-w-3xl px-4 pt-20 pb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            {t('زنده و متصل به بایننس', 'Live, connected to Binance')}
          </span>

          <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.15] tracking-tight">
            {t('هشدار قیمت ارز دیجیتال،', 'Crypto price alerts,')}
            <br />
            <span className="gradient-text">{t('همان لحظه‌ای که مهم است', 'the moment they matter')}</span>
          </h1>
          <p className="text-slate-400 mt-5 max-w-lg mx-auto leading-relaxed">
            {t(
              'روی هر جفت‌ارز بایننس هشدار قیمت یا درصد تغییر بساز و در تلگرام، ایمیل و دیسکورد فوری باخبر شو — جایگزین ارزان‌تر هشدارهای تریدینگ‌ویو.',
              'Set price or percent-change alerts on any Binance pair and get notified instantly on Telegram, email, or Discord — a cheaper alternative to TradingView alerts.',
            )}
          </p>
          <div className={`mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 ${hidden}`}>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-brand/20 hover:bg-brand-dark transition"
                >
                  {t('داشبورد من', 'My dashboard')}
                </Link>
                <Link
                  href="/alerts/new"
                  className="w-full sm:w-auto rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500 transition"
                >
                  {t('ساخت هشدار', 'New alert')}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full sm:w-auto rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-brand/20 hover:bg-brand-dark transition"
                >
                  {t('رایگان شروع کن', 'Start free')}
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500 transition"
                >
                  {t('ورود', 'Login')}
                </Link>
              </>
            )}
          </div>
          <p className={`text-xs text-slate-500 mt-4 ${hidden}`}>
            {user
              ? t(
                  `${fmtNum(user.activeAlerts, lang)} هشدار فعال از ${fmtNum(user.alertLimit, lang)}`,
                  `${fmtNum(user.activeAlerts, lang)} of ${fmtNum(user.alertLimit, lang)} alerts in use`,
                )
              : t('۳ هشدار رایگان — بدون نیاز به کارت بانکی', '3 free alerts — no card required')}
          </p>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-5xl px-4 py-20">
        <div className="text-center max-w-lg mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">{t('هرچی برای رصد بازار لازم داری', 'Everything you need to watch the market')}</h2>
          <p className="text-slate-400 mt-3">
            {t('یک ابزار، همهٔ کانال‌ها، بدون هزینهٔ گزاف اشتراک‌های تریدینگ‌ویو.', 'One tool, every channel, without TradingView-sized subscription fees.')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="hover-lift glass rounded-2xl p-6 space-y-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">{f.icon}</div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-4xl px-4 pb-20">
        <div className="text-center max-w-lg mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">{t('در سه قدم آمادهٔ کار', 'Ready to go in three steps')}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute top-6 start-[calc(50%+1.75rem)] w-[calc(100%-3.5rem)] h-px bg-gradient-to-r from-brand/40 to-transparent" />
              )}
              <div className="relative flex flex-col items-center text-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand text-slate-950 font-bold text-lg shadow-lg shadow-brand/20">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed max-w-[16rem]">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/10 via-transparent to-cyan-500/5 p-8 sm:p-10 text-center space-y-4">
          <div className="pointer-events-none absolute -top-20 -end-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
          <h2 className="relative text-xl sm:text-2xl font-bold">
            {user
              ? t('هشدار بعدی‌ات را بساز', 'Build your next alert')
              : t('آمادهٔ ساختن اولین هشدار؟', 'Ready to build your first alert?')}
          </h2>
          <p className="relative text-sm text-slate-400 max-w-md mx-auto">
            {user
              ? t(
                  'قیمت هدف را بگذار، کانال اعلان را انتخاب کن و یک یادداشت برای خودت بنویس تا لحظهٔ رسیدن قیمت بدانی چه کاری قرار بود انجام دهی.',
                  'Set the target, pick a channel, and leave yourself a note so you know what to do the moment it fires.',
                )
              : t(
                  'ثبت‌نام در کمتر از یک دقیقه. تا ۳۰ هشدار با اشتراک ماهانه و پرداخت امن از طریق زیبال.',
                  'Sign up in under a minute. Up to 30 alerts with a monthly subscription, paid securely via Zibal.',
                )}
          </p>
          <Link
            href={user ? '/alerts/new' : '/register'}
            className={`relative inline-block rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-brand/20 hover:bg-brand-dark transition ${hidden}`}
          >
            {user ? t('ساخت هشدار جدید', 'Create a new alert') : t('ساختن حساب رایگان', 'Create a free account')}
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-600">
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
        <p>{t('کلیه حقوق مادی و معنوی این وب‌سایت متعلق به الرت کی است.', 'All intellectual property rights are reserved by AlertKey.')}</p>
      </footer>
    </main>
  )
}
