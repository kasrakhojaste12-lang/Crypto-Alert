import IORedis from 'ioredis'

const url = process.env.REDIS_URL || 'redis://localhost:6379'

// BullMQ requires maxRetriesPerRequest: null on its connections.
export function newRedis() {
  return new IORedis(url, { maxRetriesPerRequest: null })
}
