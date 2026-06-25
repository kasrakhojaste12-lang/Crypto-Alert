import { Router, type Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { signToken } from '../lib/jwt'
import { requireAuth, type AuthedRequest } from '../lib/auth'
import { FREE_ALERT_LIMIT, activeAlertCount } from '../lib/limits'

const router = Router()
const cred = z.object({ email: z.string().email(), password: z.string().min(6) })

function setCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
  })
}

router.post('/register', async (req, res) => {
  const p = cred.safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })
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
