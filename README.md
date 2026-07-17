# الرت کی (Alert Key) — Persian Crypto Price-Alert Service

A localized, lower-cost alternative to TradingView alerts for Iranian users. Set **price** and **percent-change** alerts on any Binance trading pair and get notified the instant the condition is met — via **Telegram or Discord** (email channel temporarily disabled; planned for later). Persian, fully RTL. Free tier of 3 alerts; more via a **Zibal** subscription.

## Why the split architecture

Two hard network realities drive the design:

- **Binance, Telegram, and most email providers block Iranian IPs** → the **core** (price feed, matching engine, queue, dispatchers, API, DB) must run on a **server outside Iran**.
- **Zibal is an Iran-domestic gateway** → a small, stateless **payment bridge** must run on an **Iran-reachable host**. The core never talks to Zibal directly; the bridge relays a signed result back.

```
 Browser ──> web (Next.js)
                 │
                 ▼
        core (outside Iran)  ──WS──>  Binance Spot + Futures (free, no key)
        ├─ API + matching engine        Telegram / Discord / SMTP  (dispatch)
        ├─ BullMQ queue (Redis)
        └─ Postgres
                 ▲  signed HMAC confirm
                 │
        bridge (inside Iran)  ──>  Zibal gateway
```

## Stack

Node.js + TypeScript core (`ws`, BullMQ, Prisma), Postgres + Redis, Next.js + Tailwind (RTL, Vazirmatn) dashboard. Run with `tsx` (no build step).

## Layout

```
apps/core     API + matching engine + dispatch workers + telegram bot + prisma
apps/bridge   stateless Zibal relay (deploy inside Iran)
apps/web      Next.js RTL dashboard
```

## Prerequisites

- Node.js 20+ and npm
- Docker (for local Postgres + Redis)

## Setup

```bash
cp .env.example .env        # then edit secrets (see below)
npm install
npm run infra:up            # start postgres + redis
npm run db:migrate          # create tables
```

### Required secrets in `.env`

| Var | What | Where to get it |
|-----|------|-----------------|
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | Telegram bot | [@BotFather](https://t.me/BotFather) → `/newbot` |
| `SMTP_*` | Email delivery — **disabled for now**, kept for when the email channel is re-added | any transactional SMTP reachable from the core |
| `ZIBAL_MERCHANT` | Payment gateway | `zibal` for sandbox; your real merchant code for production |
| `JWT_SECRET`, `BRIDGE_SHARED_SECRET` | Signing secrets | generate random strings |

Discord needs no global secret — each alert carries its own webhook URL.

## Run (4 processes)

```bash
npm run dev:core      # API + Binance feed   (port 4000)
npm run dev:worker    # notification dispatchers + telegram /start linking
npm run dev:bridge    # Zibal payment bridge (port 4100)
npm run dev:web       # dashboard            (port 3000)
```

Open http://localhost:3000.

## Testing without Binance (developing from Iran)

Binance is unreachable from Iranian IPs, so the live feed won't deliver ticks during local dev. Set `DEV_TICK=1` in `.env` to enable a synthetic-tick endpoint, then push prices manually:

```bash
# fire a "BTCUSDT above 100000" alert: first a tick below, then one above
curl -X POST localhost:4000/api/dev/tick -H "content-type: application/json" -d '{"symbol":"BTCUSDT","price":50000}'
curl -X POST localhost:4000/api/dev/tick -H "content-type: application/json" -d '{"symbol":"BTCUSDT","price":150000}'
```

`DEV_TICK` returns 404 when unset — **keep it off in production**, where the real Binance WS feed drives the engine.

## How it works

- **Feed** — independent Spot and Futures WebSockets subscribe only to watched symbols and deliver last price + 24h % change. Each reconnects with backoff and restores its own subscriptions.
- **Crossing detection** (anti-spam) — fires only on a *crossing* (prev on one side, current on/over the target), never repeatedly while the price sits past the level. `recurring` alerts re-arm after the price returns to the opposite side. See `apps/core/src/engine/crossing.ts`.
- **Queue** — a fired alert enqueues one BullMQ job per channel (deterministic `jobId` → idempotent), decoupling matching from delivery. Workers retry with backoff; exhausted jobs dead-letter.
- **Free tier** — 3 active alerts; the 4th returns `402 upgrade_required` unless an active subscription exists.
- **Billing** — core `/billing/checkout` → signed redirect to the bridge → Zibal request → user pays → Zibal callback → bridge verifies → HMAC-signed confirm to core → subscription activated.

## API summary

```
POST /api/auth/register | /login | /logout      GET /api/auth/me
GET|POST /api/alerts     PATCH|DELETE /api/alerts/:id     POST /api/alerts/:id/reset
POST /api/channels/telegram/link|language        GET /api/channels/status
GET  /api/symbols        GET /api/symbols/price/:symbol?market=spot|futures
POST /api/billing/checkout                        POST /api/billing/zibal/confirm  (bridge only, HMAC)
```

## Verify

```bash
npm test     # crossing-logic self-check (above/below, recurring re-arm, h24 vs since_created)
```

## Production deployment

- **core + web + Postgres + Redis** → a host **outside Iran**. Use `npm run db:deploy` for migrations, run `core` (server) and `core:worker` as separate processes. Put API and web on the same parent domain so the auth cookie (`SameSite=Lax`, `Secure`) is shared; set `NODE_ENV=production`.
- **bridge** → an **Iran-reachable** host with the same `BRIDGE_SHARED_SECRET` and `CORE_BASE_URL` pointing back at the core. Set your real `ZIBAL_MERCHANT`.
- Never set `DEV_TICK` in production.

## Notes / deliberate simplifications

- API + engine share one process and an in-memory alert map (good to tens of thousands of alerts on one instance). Add Redis pub/sub to sync the map when you shard.
- Telegram linking uses a minimal long-poll loop, not a framework.
- The Telegram bot's polling runs in the **worker** process; the core never reaches Telegram itself.
- Confirm Zibal request/verify field names against current [docs.zibal.ir](https://docs.zibal.ir) before going live.
