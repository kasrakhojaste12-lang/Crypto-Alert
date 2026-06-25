import { Router } from 'express'
import crypto from 'node:crypto'
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

router.get('/status', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  res.json({ telegram: !!user?.telegramChatId, email: user?.email })
})

export default router
