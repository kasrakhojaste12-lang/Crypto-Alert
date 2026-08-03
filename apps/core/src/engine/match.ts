import { prisma } from '../lib/db'
import { log } from '../lib/log'
import { enqueueNotification, type NotifyChannel } from '../queue/notify'
import { crosses, rearmed, closedPast, reachedFireCap, metricValue, type Direction } from './crossing'

type Snap = { price: number; changePct: number }

export type Market = 'spot' | 'futures'

type Channel = { type: NotifyChannel; identifier: string }

interface AlertState {
  id: string
  userId: string
  symbol: string
  market: Market
  type: 'price' | 'percent' | 'candle_close'
  direction: Direction
  target: number
  percentBasis: 'h24' | 'since_created' | null
  basePrice: number | null
  timeframe: string | null // candle_close only (e.g. '4h')
  repeat: 'one_time' | 'recurring'
  maxFires: number | null // recurring per-cycle cap; null = unlimited
  status: string // only 'active' | 'disarmed' alerts live in the map
  fireCount: number
  cycleFireCount: number
  channels: Channel[]
}

function toState(r: any): AlertState {
  return {
    id: r.id,
    userId: r.userId,
    symbol: r.symbol,
    market: r.market ?? 'spot',
    type: r.type,
    direction: r.direction,
    target: Number(r.target),
    percentBasis: r.percentBasis ?? null,
    basePrice: r.basePrice == null ? null : Number(r.basePrice),
    timeframe: r.timeframe ?? null,
    repeat: r.repeat,
    maxFires: r.maxFires ?? null,
    status: r.status,
    fireCount: r.fireCount,
    cycleFireCount: r.cycleFireCount ?? r.fireCount ?? 0,
    channels: (r.channels as Channel[]) ?? [],
  }
}

const isCandle = (s: AlertState) => s.type === 'candle_close' && !!s.timeframe
const symbolKey = (market: Market, symbol: string) => `${market}|${symbol}`
const candleKey = (market: Market, symbol: string, timeframe: string) => `${market}|${symbol}|${timeframe}`

// In-memory matcher. ponytail: single-instance map mutated directly by the API
// in the same process; add Redis pub/sub to sync when sharding across instances.
class Engine {
  private bySymbol = new Map<string, Map<string, AlertState>>() // tick alerts (price/percent)
  private candles = new Map<string, Map<string, AlertState>>() // candle_close, key `${symbol}|${tf}`
  private byId = new Map<string, AlertState>() // index so remove(id) finds the right bucket
  private lastSnap = new Map<string, Snap>()

  async loadActive() {
    const rows = await prisma.alert.findMany({ where: { status: { in: ['active', 'disarmed'] } } })
    for (const r of rows) this.put(toState(r))
    log.info({ count: rows.length }, 'engine loaded active alerts')
  }

  upsert(alert: any) {
    const s = toState(alert)
    this.put(s)
    this.fireIfMet(s.id)
  }

  upsertIfPresent(alert: any) {
    if (!this.byId.has(alert.id)) return
    this.upsert(alert)
  }

  reactivate(alert: any) {
    this.put(toState(alert))
  }

  // Creation / ordinary activation convenience: if a just-armed PRICE alert's condition
  // is ALREADY true at the latest tick, fire once now — users expect "above X" to
  // notify when the price is already above X, not only on a future up-cross.
  // Called only from upsert() (the API create/patch path), never from
  // loadActive(), so a restart never re-fires already-met alerts. Percent/candle
  // alerts keep pure crossing/close semantics.
  fireIfMet(id: string) {
    const a = this.byId.get(id)
    if (!a || a.status !== 'active' || a.type !== 'price') return
    const price = this.lastSnap.get(symbolKey(a.market, a.symbol))?.price
    if (price != null && closedPast(price, a.target, a.direction)) this.fire(a, price)
  }

  private put(s: AlertState) {
    const prev = this.byId.get(s.id)
    if (prev) this.detach(prev) // upsert: drop the old copy (symbol/type may have changed)
    this.byId.set(s.id, s)
    const [map, key] = isCandle(s)
      ? [this.candles, candleKey(s.market, s.symbol, s.timeframe!)]
      : [this.bySymbol, symbolKey(s.market, s.symbol)]
    let m = map.get(key)
    if (!m) {
      m = new Map()
      map.set(key, m)
    }
    m.set(s.id, s)
  }

  private detach(s: AlertState) {
    if (isCandle(s)) this.candles.get(candleKey(s.market, s.symbol, s.timeframe!))?.delete(s.id)
    else this.bySymbol.get(symbolKey(s.market, s.symbol))?.delete(s.id)
    this.byId.delete(s.id)
  }

  remove(id: string) {
    const s = this.byId.get(id)
    if (s) this.detach(s)
  }

  // Kline streams the candle feed should subscribe to (one per live symbol+tf).
  neededStreams(market: Market = 'spot'): string[] {
    const out: string[] = []
    for (const [key, m] of this.candles) {
      if (!m.size) continue
      const [keyMarket, symbol, tf] = key.split('|')
      if (keyMarket !== market) continue
      out.push(`${symbol.toLowerCase()}@kline_${tf}`)
    }
    return out
  }

  lastPrice(symbol: string, market: Market = 'spot'): number | null {
    return this.lastSnap.get(symbolKey(market, symbol))?.price ?? null
  }

  // Symbols that currently have at least one alert (used by the REST fallback
  // feed to poll only what's needed).
  watchedSymbols(market: Market = 'spot'): string[] {
    const out: string[] = []
    for (const [key, m] of this.bySymbol) {
      const [keyMarket, symbol] = key.split('|')
      if (keyMarket === market && m.size) out.push(symbol)
    }
    return out
  }

  // Called for every symbol on every ticker tick. Looks up only this symbol's
  // alerts — never iterates the whole alert set.
  onTick(symbol: string, price: number, changePct: number, market: Market = 'spot') {
    const key = symbolKey(market, symbol)
    const bucket = this.bySymbol.get(key)
    const prev = this.lastSnap.get(key)
    if (bucket && prev && bucket.size) {
      for (const a of bucket.values()) {
        if (a.type === 'candle_close') continue
        const tickAlert = a as AlertState & { type: 'price' | 'percent' }
        const prevVal = metricValue(tickAlert, prev.price, prev.changePct)
        const currVal = metricValue(tickAlert, price, changePct)
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
    this.lastSnap.set(key, { price, changePct })
  }

  // Called by the candle feed for each FULLY-CLOSED candle (never intrabar), so
  // there's no false-trigger risk from mid-candle price movement.
  onCandleClose(symbol: string, interval: string, close: number, market: Market = 'spot') {
    const bucket = this.candles.get(candleKey(market, symbol, interval))
    if (!bucket || !bucket.size) return
    for (const a of bucket.values()) {
      if (a.status === 'active') {
        if (closedPast(close, a.target, a.direction)) this.fire(a, close)
      } else if (a.status === 'disarmed') {
        if (rearmed(close, a.target, a.direction)) {
          a.status = 'active'
          void prisma.alert.update({ where: { id: a.id }, data: { status: 'active' } }).catch(() => {})
        }
      }
    }
  }

  // Sync state changes happen here (so the next tick/close can't double-fire);
  // DB write + enqueue are deferred to persist().
  private fire(a: AlertState, price: number) {
    a.fireCount += 1
    a.cycleFireCount += 1
    const seq = a.fireCount
    // Recurring alerts re-arm (disarmed) unless they've hit their fire cap.
    const next = reachedFireCap(a.repeat, a.cycleFireCount, a.maxFires) ? 'triggered' : 'disarmed'
    a.status = next
    if (next === 'triggered') this.remove(a.id)
    void this.persist(a, seq, price, next)
  }

  private async persist(a: AlertState, seq: number, price: number, next: string) {
    try {
      await prisma.alert.update({
        where: { id: a.id },
        data: { status: next, fireCount: seq, cycleFireCount: a.cycleFireCount, lastFiredAt: new Date() },
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
        timeframe: a.timeframe,
      })
    }
    log.info({ alert: a.id, symbol: a.symbol, price, seq }, 'alert fired')
  }
}

export const engine = new Engine()
