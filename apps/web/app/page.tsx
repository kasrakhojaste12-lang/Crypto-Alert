import Link from 'next/link'

const features = [
  {
    icon: '🔔',
    title: 'هشدار قیمت و درصد',
    body: 'برای رسیدن به یک قیمت مشخص یا درصد تغییر ۲۴ ساعته، دقیقاً همان لحظه باخبر شو.',
  },
  {
    icon: '🪙',
    title: 'همهٔ جفت‌ارزهای بایننس',
    body: 'روی هر جفت‌ارز فعال بایننس هشدار بساز — جفت‌ارزهای جدید هم خودکار اضافه می‌شوند.',
  },
  {
    icon: '⚡',
    title: 'اعلان تلگرام و دیسکورد',
    body: 'پیام فوری در تلگرام یا دیسکورد، بدون تأخیر و بدون اسپم؛ هر هشدار فقط یک‌بار.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-3xl px-4">
        <div className="h-14 flex items-center justify-between">
          <span className="font-bold text-brand whitespace-nowrap">⚡ هشدار قیمت</span>
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition">
            ورود
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
          هشدار قیمت ارز دیجیتال،
          <br />
          <span className="text-brand">همان لحظه‌ای که مهم است</span>
        </h1>
        <p className="text-slate-400 mt-4 max-w-md mx-auto">
          روی هر جفت‌ارز بایننس هشدار قیمت یا درصد تغییر بساز و در تلگرام و دیسکورد فوری باخبر شو — جایگزین ارزان‌تر هشدارهای
          تریدینگ‌ویو.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 hover:bg-brand-dark transition"
          >
            رایگان شروع کن
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:border-slate-500 transition"
          >
            ورود
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-4">۳ هشدار رایگان — بدون نیاز به کارت بانکی</p>
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
          <h2 className="text-xl font-bold">آمادهٔ ساختن اولین هشدار؟</h2>
          <p className="text-sm text-slate-400">
            ثبت‌نام در کمتر از یک دقیقه. هشدار نامحدود با اشتراک ماهانه و پرداخت امن از طریق زیبال.
          </p>
          <Link
            href="/register"
            className="inline-block rounded-xl bg-brand px-6 py-3 font-semibold text-slate-950 hover:bg-brand-dark transition"
          >
            ساختن حساب رایگان
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-600">
        ⚡ هشدار قیمت ارز دیجیتال
      </footer>
    </main>
  )
}
