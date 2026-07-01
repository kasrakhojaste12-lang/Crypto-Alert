'use client'
import { useEffect, useRef } from 'react'
import { useLang } from '@/lib/i18n'

// Reusable Cloudflare Turnstile widget. Renders nothing when no sitekey is set
// (local dev). window.turnstile is typed globally in AuthForm.tsx.
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const { lang } = useLang()
  const boxRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!SITEKEY) return
    let cancelled = false
    const render = () => {
      if (cancelled || !window.turnstile || !boxRef.current) return
      if (widgetId.current) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
      onToken('')
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: SITEKEY,
        theme: 'dark',
        language: lang,
        callback: (tok: string) => onToken(tok),
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken(''),
      })
    }
    const SCRIPT_ID = 'cf-turnstile'
    if (window.turnstile) {
      render()
    } else {
      let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (!s) {
        s = document.createElement('script')
        s.id = SCRIPT_ID
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener('load', render)
    }
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
    }
    // onToken is a stable useState setter at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  if (!SITEKEY) return null
  return <div ref={boxRef} className="flex justify-center" />
}
