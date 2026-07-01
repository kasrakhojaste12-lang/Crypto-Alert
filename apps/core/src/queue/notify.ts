import { Queue } from 'bullmq'
import { newRedis } from '../lib/redis'

export const NOTIFY_QUEUE = 'notifications'

export interface NotifyJob {
  alertId: string
  fireSeq: number
  channel: 'telegram' | 'discord'
  identifier: string
  symbol: string
  price: number
  direction: 'above' | 'below'
  type: 'price' | 'percent' | 'candle_close'
  target: number
  percentBasis: 'h24' | 'since_created' | null
  timeframe?: string | null // candle_close only
}

export const notifyQueue = new Queue<NotifyJob>(NOTIFY_QUEUE, { connection: newRedis() })

export async function enqueueNotification(job: NotifyJob) {
  await notifyQueue.add('notify', job, {
    // Deterministic id => idempotent: a given (alert, fire, channel) enqueues once.
    jobId: `${job.alertId}:${job.fireSeq}:${job.channel}`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  })
}
