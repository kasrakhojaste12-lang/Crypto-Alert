const TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function sendTelegram(chatId: string, text: string) {
  if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set')
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`)
}
