import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/700.css'
import './globals.css'
import type { Metadata } from 'next'
import { LangProvider } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'الرت کی — Alert Key',
  description: 'هشدار قیمت و درصد تغییر برای هر جفت‌ارز بایننس، با اعلان تلگرام و دیسکورد',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Default to fa/rtl on the server; LangProvider flips it client-side per choice.
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans min-h-screen">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  )
}
