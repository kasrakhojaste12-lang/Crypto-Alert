import { prisma } from '../lib/db'
import { log } from '../lib/log'
import { enqueueNotification } from '../queue/notify'
import { crosses, rearmed, reachedFireCap, metricValue, type Direction } from './crossing'

type Snap = { price: number; changePct: number }

type Channel = { type: 'telegram' | 'discord' | 'email'; identifier: string }

interface AlertState {
  id: string
  userId: string
  symbol: string
  type: 'price' | 'percent'
  direction: Direction
  target: number
  percentBasis: 'h24' | 'since_created' | null
  basePrice: number | null
  repeat: 'one_time' | 'recurring'
  maxFires: number | null // recurring cap; null = unlimited
  status: string // only 'active' | 'disarmed' alerts live in the map
  fireCount: number
  channels: Channel[]
}

function toState(r: any): AlertState {
  return {
    id: r.id,
    userId: r.userId,
    symbol: r.symbol,
    type: r.type,
    direction: r.direction,
    target: Number(r.target),
    percentBasis: r.percentBasis ?? null,
    basePrice: r.basePrice == null ? null : Number(r.basePrice),
    repeat: r.repeat,
    maxFires: r.maxFires ?? null,
    status: r.status,
    fireCount: r.fireCount,
    channels: (r.channels as Channel[]) ?? [],
  }
}

// In-memory matcher. ponytail: single-instance map mutated directly by the API
// in the same process; add Redis pub/sub to sync when sharding across instances.
class Engine {
  private bySymbol = new Map<string, Map<string, AlertState>>()
  private lastSnap = new Map<string, Snap>()

  async loadActive() {
    const rows = await prisma.alert.findMany({ where: { status: { in: ['active', 'disarmed'] } } })
    for (const r of rows) this.put(toState(r))
    log.info({ count: rows.length }, 'engine loaded active alerts')
  }

  upsert(alert: any) {
    this.put(toState(alert))
  }

  private put(s: AlertState) {
    let m = this.bySymbol.get(s.symbol)
    if (!m) {
      m = new Map()
      this.bySymbol.set(s.symbol, m)
    }
    m.set(s.id, s)
  }

  remove(id: string, symbol: string) {
    this.bySymbol.get(symbol)?.delete(id)
  }

  lastPrice(symbol: string): number | null {
    return this.lastSnap.get(symbol)?.price ?? null
  }

  // Symbols that currently have at least one alert (used by the REST fallback
  // feed to poll only what's needed).
  watchedSymbols(): string[] {
    const out: string[] = []
    for (const [sym, m] of this.bySymbol) if (m.size) out.push(sym)
    return out
  }

  // Called for every symbol on every ticker tick. Looks up only this symbol's
  // alerts — never iterates the whole alert set.
  onTick(symbol: string, price: number, changePct: number) {
    const bucket = this.bySymbol.get(symbol)
    const prev = this.lastSnap.get(symbol)
    if (bucket && prev && bucket.size) {
      for (const a of bucket.values()) {
        const prevVal = metricValue(a, prev.price, prev.changePct)
        const currVal = metricValue(a, price, changePct)
        if (a.status === 'active') {
          if (crosses(prevVal, currVal, a.target, a.direction)) this.fire(a, price)
        } else if (a.status === 'disarmed') {
          if (rearmed(currVal, a.target, a.direction)) {
            a.status = 'active'
            void prisma.alert.update({ where: { id: a.id }, data: { status: 'active' } }).catch(() => {})
          }
        }
      }
    }
    this.lastSnap.set(symbol, { price, changePct })
  }

  // Sync state changes happen here (so the next tick can't double-fire);
  // DB write + enqueue are deferred to persist().
  private fire(a: AlertState, price: number) {
    a.fireCount += 1
    const seq = a.fireCount
    // Recurring alerts re-arm (disarmed) unless they've hit their fire cap.
    const next = reachedFireCap(a.repeat, a.fireCount, a.maxFires) ? 'triggered' : 'disarmed'
    a.status = next
    if (next === 'triggered') this.remove(a.id, a.symbol)
    void this.persist(a, seq, price, next)
  }

  private async persist(a: AlertState, seq: number, price: number, next: string) {
    try {
      await prisma.alert.update({
        where: { id: a.id },
        data: { status: next, fireCount: seq, lastFiredAt: new Date() },
      })
    } catch (e) {
      log.error({ err: String(e), alert: a.id }, 'failed to persist fired alert')
    }
    for (const ch of a.channels) {
      await enqueueNotification({
        alertId: a.id,
        fireSeq: seq,
        channel: ch.type,
        identifier: ch.identifier,
        symbol: a.symbol,
        price,
        direction: a.direction,
        type: a.type,
        target: a.target,
        percentBasis: a.percentBasis,
      })
    }
    log.info({ alert: a.id, symbol: a.symbol, price, seq }, 'alert fired')
  }
}

export const engine = new Engine()
