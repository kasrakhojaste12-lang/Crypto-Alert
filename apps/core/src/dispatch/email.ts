import nodemailer from 'nodemailer'

const port = Number(process.env.SMTP_PORT || 587)

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
})

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST not set')
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@example.com',
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  })
}
