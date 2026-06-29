'use client'
import { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'fa' | 'en'

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'fa',
  setLang: () => {},
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fa')

  // Hydrate the saved choice after mount (avoids SSR/client mismatch).
  useEffect(() => {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'fa') setLangState(saved)
  }, [])

  // Keep <html lang/dir> in sync so text alignment + RTL/LTR follow the language.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
  }, [lang])

  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l)
    setLangState(l)
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

// Inline translator: t('فارسی', 'English') returns the string for the active language.
export function useT() {
  const { lang } = useLang()
  return (fa: string, en: string) => (lang === 'fa' ? fa : en)
}
