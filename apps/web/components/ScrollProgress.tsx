'use client'
import { useEffect, useState } from 'react'

// Fixed 2px bar at the very top of the viewport, above the header, that
// fills as the page is scrolled. Reading-direction aware: it grows from the
// left in LTR (English) and from the right in RTL (Persian), matching
// whichever edge the eye actually starts from.
export function ScrollProgress() {
  const [progress, setProgress] = useState(0)
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')

  useEffect(() => {
    setDir(document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')
    // The lang/dir toggle (lib/i18n.tsx) sets this attribute directly on
    // <html> without a React re-render elsewhere in the tree, so watch it.
    const observer = new MutationObserver(() => {
      setDir(document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let ticking = false

    function update() {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - doc.clientHeight
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0
      setProgress(Math.min(100, Math.max(0, pct)))
      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent pointer-events-none">
      <div
        className="h-full w-full bg-gradient-to-r from-brand to-cyan-400 transition-transform duration-100 ease-out"
        style={{
          transform: `scaleX(${progress / 100})`,
          transformOrigin: dir === 'rtl' ? 'right' : 'left',
        }}
      />
    </div>
  )
}
