'use client'
import { useLang } from '@/lib/i18n'

// Toggles between Persian and English. Shows the language you'd switch TO.
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
      aria-label="Switch language"
      className={`text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition whitespace-nowrap ${className}`}
    >
      {lang === 'fa' ? 'EN' : 'فا'}
    </button>
  )
}
