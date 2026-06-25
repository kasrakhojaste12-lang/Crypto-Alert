import { prisma } from '../lib/db'
import { log } from '../lib/log'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Long-poll getUpdates to handle "/start <code>" deep links that link a
// Telegram chat to a user account.
// ponytail: raw fetch + minimal offset loop, not a framework. Upgrade to grammy
// if the bot grows real commands.
export function startBot() {
  if (!TOKEN) {
    log.warn('TELEGRAM_BOT_TOKEN not set; telegram linking disabled')
    return
  }
  poll(0)
  log.info('telegram bot polling started')
}

async function poll(offset: number) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=30&offset=${offset}`)
    const data = await res.json()
    if (data.ok) {
      for (const u of data.result) {
        offset = u.update_id + 1
        const text: string | undefined = u.message?.text
        if (text?.startsWith('/start')) {
          await handleStart(text.split(/\s+/)[1]?.trim(), String(u.message.chat.id))
        }
      }
    }
  } catch (e) {
    log.error({ err: String(e) }, 'bot poll error')
    await new Promise((r) => setTimeout(r, 3000))
  }
  setImmediate(() => poll(offset))
}

async function handleStart(code: string | undefined, chatId: string) {
  if (!code) {
    await reply(chatId, 'برای اتصال حساب، از داشبورد روی «اتصال تلگرام» بزنید.')
    return
  }
  const link = await prisma.telegramLink.findUnique({ where: { code } })
  if (!link || link.usedAt) {
    await reply(chatId, 'این کد نامعتبر یا منقضی شده است.')
    return
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: link.userId }, data: { telegramChatId: chatId } }),
    prisma.telegramLink.update({ where: { code }, data: { usedAt: new Date() } }),
  ])
  await reply(chatId, '✅ حساب شما با موفقیت متصل شد. از این پس هشدارها را همین‌جا دریافت می‌کنید.')
}

async function reply(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
