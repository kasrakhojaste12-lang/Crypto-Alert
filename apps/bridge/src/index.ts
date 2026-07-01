// Payment bridge — the only component that talks to Zibal. Deploy on an
// Iran-reachable host. Stateless: verifies a signed token from core, drives the
// Zibal request/verify flow, relays a signed result back to core.
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()
dotenv.config({ path: path.resolve(here, '../../../.env') })

const PORT = Number(process.env.BRIDGE_PORT || 4100)
const SECRET = process.env.BRIDGE_SHARED_SECRET || 'bridge-secret'
const MERCHANT = process.env.ZIBAL_MERCHANT || 'zibal'
const CORE = process.env.CORE_BASE_URL || 'http://localhost:4000'
const BRIDGE_BASE = process.env.BRIDGE_BASE_URL || 'http://localhost:4100'
const WEB = process.env.WEB_BASE_URL || 'http://localhost:3000'
const ZIBAL = 'https://gateway.zibal.ir' // see docs.zibal.ir — confirm field names

const app = express()

// trackId -> payment context. ponytail: in-memory; pending payments are short
// lived, and Zibal also echoes orderId back on the callback as a fallback.
const pending = new Map<string, { orderId: string; returnUrl: string; amount: number }>()

app.get('/health', (_req, res) => res.json({ ok: true }))

// Start payment: validate token, create a Zibal request, redirect to Zibal.
app.get('/pay', async (req, res) => {
  let claims: { orderId: string; amount: number; returnUrl: string; description?: string }
  try {
    claims = jwt.verify(String(req.query.token), SECRET) as typeof claims
  } catch {
    return res.status(400).send('invalid payment token')
  }
  try {
    const r = await fetch(`${ZIBAL}/v1/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchant: MERCHANT,
        amount: claims.amount, // Rial
        callbackUrl: `${BRIDGE_BASE}/callback`,
        orderId: claims.orderId,
        description: claims.description, // shown in Zibal's merchant reports
      }),
    })
    const data = await r.json()
    if (data.result !== 100) return res.status(502).send(`Zibal request failed: ${data.message || data.result}`)
    pending.set(String(data.trackId), { orderId: claims.orderId, returnUrl: claims.returnUrl, amount: claims.amount })
    res.redirect(`${ZIBAL}/start/${data.trackId}`)
  } catch (e) {
    res.status(502).send('Zibal unreachable')
  }
})

// Zibal callback: verify the payment, tell core, send user back to dashboard.
app.get('/callback', async (req, res) => {
  const trackId = String(req.query.trackId || '')
  const success = String(req.query.success) === '1'
  const ctx = pending.get(trackId)
  const orderId = ctx?.orderId || String(req.query.orderId || '')
  const returnUrl = ctx?.returnUrl || `${WEB}/billing/result`

  let verified = false
  if (success && trackId) {
    try {
      const r = await fetch(`${ZIBAL}/v1/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ merchant: MERCHANT, trackId }),
      })
      const data = await r.json()
      verified = data.result === 100 || data.result === 201 // 201 = already verified
      // Money-path guard: the paid amount must match what we requested. Zibal
      // enforces this server-side, but reject on any mismatch as defence in depth
      // (skip only if we lost ctx to a restart or Zibal omitted the field).
      if (verified && ctx && data.amount != null && Number(data.amount) !== ctx.amount) {
        verified = false
      }
    } catch {
      verified = false
    }
  }

  const sig = crypto.createHmac('sha256', SECRET).update(`${orderId}:${trackId}:${verified}`).digest('hex')
  try {
    await fetch(`${CORE}/api/billing/zibal/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-signature': sig },
      body: JSON.stringify({ orderId, trackId, verified }),
    })
  } catch {
    // core unreachable — the verify still happened; core can reconcile later.
  }
  pending.delete(trackId)
  res.redirect(`${returnUrl}?status=${verified ? 'success' : 'failed'}`)
})

app.listen(PORT, () => console.log(`payment bridge listening on ${PORT}`))
