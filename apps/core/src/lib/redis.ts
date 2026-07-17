import IORedis from 'ioredis'
import type { ConnectionOptions } from 'bullmq'

const url = process.env.REDIS_URL || 'redis://localhost:6379'

// BullMQ requires maxRetriesPerRequest: null on its connections.
export function newRedis(): ConnectionOptions {
  // npm may install BullMQ's exact ioredis version beside the app's compatible version.
  return new IORedis(url, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions
}
