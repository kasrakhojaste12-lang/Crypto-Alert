export function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)
}

export async function sendDiscord(webhookUrl: string, text: string) {
  if (!isDiscordWebhook(webhookUrl)) throw new Error('invalid discord webhook url')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: text }),
  })
  if (!res.ok) throw new Error(`discord ${res.status}: ${await res.text()}`)
}
