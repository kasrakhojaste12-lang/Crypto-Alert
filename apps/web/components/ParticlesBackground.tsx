'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Particles spawned by a click start with full opacity and fade in naturally */
  alpha: number
  /** click-spawned particles get a short burst velocity that decays */
  burst: number
}

const BASE_COUNT = 70
const MAX_DIST   = 130
const MAX_CLICK_PARTICLES = 60   // cap so the page never gets sluggish

function getColors(): { pc: string; lc: string } {
  const isLight = document.documentElement.classList.contains('light')
  return isLight
    ? { pc: 'rgba(5,150,105,',   lc: 'rgba(5,150,105,' }
    : { pc: 'rgba(52,211,153,',  lc: 'rgba(52,211,153,' }
}

export default function ParticlesBackground() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  // Store particles in a ref so the click handler can mutate them without
  // triggering a re-render.
  const stateRef = useRef<{
    particles: Particle[]
    raf: number
    ripples: { x: number; y: number; r: number; alpha: number }[]
  }>({
    particles: [],
    raf: 0,
    ripples: [],
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = stateRef.current

    // ── helpers ────────────────────────────────────────────────────────────
    function makeParticle(x: number, y: number, burst = 0): Particle {
      const angle = Math.random() * Math.PI * 2
      const speed = burst > 0
        ? burst * (0.6 + Math.random() * 0.8)   // click burst
        : 0.55                                     // ambient drift
      return {
        x,
        y,
        vx: Math.cos(angle) * (burst > 0 ? speed : (Math.random() - 0.5) * speed),
        vy: Math.sin(angle) * (burst > 0 ? speed : (Math.random() - 0.5) * speed),
        r: Math.random() * 1.8 + 0.8,
        alpha: burst > 0 ? 0.3 : 0.7,  // click particles fade in
        burst,
      }
    }

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }

    function init() {
      resize()
      state.particles = []
      for (let i = 0; i < BASE_COUNT; i++) {
        state.particles.push(
          makeParticle(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
          ),
        )
      }
    }

    // ── click handler ──────────────────────────────────────────────────────
    function onClick(e: MouseEvent) {
      const { clientX: x, clientY: y } = e

      // ripple effect
      state.ripples.push({ x, y, r: 0, alpha: 0.6 })

      // spawn a cluster of dots around the click
      const toSpawn = Math.min(
        5 + Math.floor(Math.random() * 4),           // 5-8 per click
        BASE_COUNT + MAX_CLICK_PARTICLES - state.particles.length,
      )
      for (let i = 0; i < toSpawn; i++) {
        const spread = 18
        state.particles.push(
          makeParticle(
            x + (Math.random() - 0.5) * spread,
            y + (Math.random() - 0.5) * spread,
            2.5,
          ),
        )
      }
    }

    // ── animation loop ─────────────────────────────────────────────────────
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { pc, lc } = getColors()
      const pts = state.particles

      // update + draw particles
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]

        // burst decay — click-spawned dots decelerate to ambient speed
        if (p.burst > 0) {
          p.burst = Math.max(0, p.burst - 0.04)
          p.vx *= 0.97
          p.vy *= 0.97
          // if nearly stopped, give ambient drift
          if (p.burst < 0.1) {
            const ambient = 0.55
            if (Math.abs(p.vx) < 0.1) p.vx = (Math.random() - 0.5) * ambient
            if (Math.abs(p.vy) < 0.1) p.vy = (Math.random() - 0.5) * ambient
          }
        }

        // fade click particles up to full alpha
        if (p.alpha < 0.7) p.alpha = Math.min(0.7, p.alpha + 0.015)

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        // draw dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${pc}${p.alpha.toFixed(2)})`
        ctx.fill()
      }

      // draw connecting lines
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < MAX_DIST) {
            const alpha = ((1 - d / MAX_DIST) * 0.28).toFixed(3)
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `${lc}${alpha})`
            ctx.lineWidth   = 0.7
            ctx.stroke()
          }
        }
      }

      // draw + update ripples
      for (let i = state.ripples.length - 1; i >= 0; i--) {
        const rp = state.ripples[i]
        rp.r     += 3.5
        rp.alpha -= 0.025
        if (rp.alpha <= 0) {
          state.ripples.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `${lc}${rp.alpha.toFixed(3)})`
        ctx.lineWidth   = 1.2
        ctx.stroke()
      }

      state.raf = requestAnimationFrame(tick)
    }

    // ── bootstrap ──────────────────────────────────────────────────────────
    init()
    tick()

    window.addEventListener('resize', resize)
    window.addEventListener('click',  onClick)

    return () => {
      cancelAnimationFrame(state.raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('click',  onClick)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  )
}
