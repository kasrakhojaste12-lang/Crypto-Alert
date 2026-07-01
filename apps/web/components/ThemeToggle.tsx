'use client'
import { useEffect, useState } from 'react'

// Flips the `.light` class on <html> and persists the choice. First visit with
// no saved choice follows the OS preference (set pre-paint by the script in
// layout.tsx). Shows the icon of the theme you'd switch TO, like LangToggle.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [light, setLight] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    document.documentElement.classList.toggle('light', next)
    try {
      localStorage.setItem('theme', next ? 'light' : 'dark')
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={`grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-slate-50 transition ${className}`}
    >
      {/* placeholder keeps SSR/first-paint markup stable until we read the class */}
      {!mounted ? (
        <span className="block h-5 w-5" />
      ) : light ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  )
}
