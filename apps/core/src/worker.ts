import './lib/env'
import { Worker } from 'bullmq'
import { Prisma } from '@prisma/client'
import { newRedis } from './lib/redis'
import { prisma } from './lib/db'
import { log } from './lib/log'
import { NOTIFY_QUEUE, type NotifyJob } from './queue/notify'
import { buildMessage } from './dispatch/messages'
import { sendTelegram } from './dispatch/telegram'
import { sendDiscord } from './dispatch/discord'
import { sendEmail } from './dispatch/email'
import { startBot } from './dispatch/bot'

const worker = new Worker<NotifyJob>(
  NOTIFY_QUEUE,
  async (job) => {
    const j = job.data
    const where = {
      alertId_fireSeq_channel: { alertId: j.alertId, fireSeq: j.fireSeq, channel: j.channel },
    }

    // Idempotency: never re-send a notification already marked sent.
    const existing = await prisma.notification.findUnique({ where })
    if (existing?.status === 'sent') {
      log.info({ job: job.id }, 'notification already sent; skipping')
      return
    }

    // The note is read here rather than carried in the job payload, so an edited
    // note still reaches deliveries that were queued before the edit.
    const alert = await prisma.alert.findUnique({
      where: { id: j.alertId },
      select: { note: true, user: { select: { telegramLanguage: true } } },
    })
    if (!alert) {
      log.info({ alert: j.alertId, job: job.id }, 'alert deleted; skipping notification')
      return
    }

    // The language preference applies to EVERY channel, not just Telegram. The
    // column keeps its legacy `telegramLanguage` name to avoid a migration.
    const language = alert.user.telegramLanguage === 'en' ? 'en' : 'fa'
    const { title, body } = buildMessage(j, language, alert.note)
    try {
      if (j.channel === 'telegram') await sendTelegram(j.identifier, body)
      else if (j.channel === 'discord') await sendDiscord(j.identifier, body)
      else if (j.channel === 'email') await sendEmail(j.identifier, title, body)

      await prisma.notification.upsert({
        where,
        create: { alertId: j.alertId, fireSeq: j.fireSeq, channel: j.channel, status: 'sent', sentAt: new Date() },
        update: { status: 'sent', sentAt: new Date(), error: null },
      })
      log.info({ alert: j.alertId, channel: j.channel }, 'notification sent')
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        log.info({ alert: j.alertId, job: job.id }, 'alert deleted during delivery; skipping retry')
        return
      }
      const msg = String(e instanceof Error ? e.message : e)
      await prisma.notification.upsert({
        where,
        create: { alertId: j.alertId, fireSeq: j.fireSeq, channel: j.channel, status: 'failed', error: msg },
        update: { status: 'failed', error: msg },
      })
      log.error({ alert: j.alertId, channel: j.channel, err: msg }, 'notification delivery failed')
      throw e // let BullMQ retry; exhausted attempts land in the failed (dead-letter) set
    }
  },
  { connection: newRedis(), concurrency: 10 },
)

worker.on('failed', (job, err) =>
  log.warn({ job: job?.id, err: err.message }, 'job failed (will retry or dead-letter)'),
)

startBot() // telegram /start linking

log.info('notification worker started')
