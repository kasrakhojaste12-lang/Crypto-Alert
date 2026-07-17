import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { requireAuth, type AuthedRequest } from '../lib/auth'

const router = Router()
router.use(requireAuth)

// Issue a one-time code + deep link to connect Telegram.
router.post('/telegram/link', async (req: AuthedRequest, res) => {
  const code = crypto.randomBytes(6).toString('hex')
  await prisma.telegramLink.create({ data: { code, userId: req.userId! } })
  const username = process.env.TELEGRAM_BOT_USERNAME || 'YourBot'
  res.json({ code, url: `https://t.me/${username}?start=${code}` })
})

// Disconnect Telegram so the user can link a different account.
router.post('/telegram/unlink', async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { telegramChatId: null } })
  res.json({ ok: true })
})

router.post('/telegram/language', async (req: AuthedRequest, res) => {
  const p = z.object({ language: z.enum(['fa', 'en']) }).strict().safeParse(req.body)
  if (!p.success) return res.status(400).json({ error: 'invalid_input' })
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { telegramLanguage: p.data.language },
  })
  res.json({ language: user.telegramLanguage })
})

router.get('/status', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  res.json({
    telegram: !!user?.telegramChatId,
    telegramLanguage: user?.telegramLanguage ?? 'fa',
    email: user?.email,
  })
})

export default router
