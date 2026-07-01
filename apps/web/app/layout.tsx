import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/700.css'
import './globals.css'
import type { Metadata } from 'next'
import { LangProvider } from '@/lib/i18n'
import { SupportBubble } from '@/components/SupportBubble'

export const metadata: Metadata = {
  title: 'الرت کی — Alert Key',
  description: 'هشدار قیمت و درصد تغییر برای هر جفت‌ارز بایننس، با اعلان تلگرام و دیسکورد',
  other: { enamad: '26970244' }, // Enamad trust-badge verification
}

// Applies the saved (or OS-preferred) theme before first paint to avoid a flash.
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light'||(t!=='dark'&&matchMedia('(prefers-color-scheme: light)').matches)){document.documentElement.classList.add('light')}}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Default to fa/rtl on the server; LangProvider flips it client-side per choice.
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="font-sans min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <LangProvider>
          {children}
          <SupportBubble />
        </LangProvider>
      </body>
    </html>
  )
}
