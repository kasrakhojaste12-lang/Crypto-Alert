import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/700.css'
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'الرت کی — هشدار قیمت ارز دیجیتال',
  description: 'هشدارهای قیمت و درصد تغییر برای هر جفت‌ارز، با اعلان تلگرام، دیسکورد و ایمیل',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  )
}
