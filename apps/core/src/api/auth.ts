import { Router, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { signToken } from '../lib/jwt'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { FREE_ALERT_LIMIT, activeAlertCount } from '../lib/limits'

const router = Router()
const cred = z.object({ email: z.string().email(), password: z.string().min(6) })

// Cloudflare Turnstile. If no secret is configured (e.g. local dev), captcha is
// skipped so the flow still works; set TURNSTILE_SECRET in prod to enforce it.
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET
async function captchaOk(token: unknown, ip?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true
  if (typeof token !== 'string' || !token) return false
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    })
    const data = (await r.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

// Secure cookie is on in production by default, but COOKIE_SECURE=0 forces it
// off for an http-only deploy (e.g. a bare IP before the HTTPS domain is set).
const COOKIE_SECURE =
  process.env.COOKIE_SECURE != null
    ? process.env.COOKIE_SECURE === '1'
    : process.env.NODE_ENV === 'production'

function setCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: 7 * 24 * 3600 * 1000,
  })
}

router.post('/register', async (req, res) => {
  const p = cred.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })
  if (!(await captchaOk(req.body?.turnstileToken, req.ip)))
    return res.status(400).json({ error: 'captcha_failed' })
  if (await prisma.user.findUnique({ where: { email: p.data.email } }))
    return res.status(409).json({ error: 'email_taken' })
  const passwordHash = await bcrypt.hash(p.data.password, 10)
  const user = await prisma.user.create({ data: { email: p.data.email, passwordHash } })
  setCookie(res, signToken({ sub: user.id }))
  res.json({ id: user.id, email: user.email, plan: user.plan })
})

router.post('/login', async (req, res) => {
  const p = cred.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })
  if (!(await captchaOk(req.body?.turnstileToken, req.ip)))
    return res.status(400).json({ error: 'captcha_failed' })
  const user = await prisma.user.findUnique({ where: { email: p.data.email } })
  if (!user || !(await bcrypt.compare(p.data.password, user.passwordHash)))
    return res.status(401).json({ error: 'invalid_credentials' })
  setCookie(res, signToken({ sub: user.id }))
  res.json({ id: user.id, email: user.email, plan: user.plan })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ error: 'not_found' })
  const [activeAlerts, sub] = await Promise.all([
    activeAlertCount(user.id),
    prisma.subscription.findFirst({
      where: { userId: user.id, status: 'active', periodEnd: { gt: new Date() } },
      orderBy: { periodEnd: 'desc' },
    }),
  ])
  res.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    telegramLinked: !!user.telegramChatId,
    activeAlerts,
    freeLimit: FREE_ALERT_LIMIT,
    subscription: sub,
  })
})

export default router
