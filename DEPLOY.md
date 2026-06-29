# Deploy (single VPS, Docker Compose + Caddy auto-HTTPS)

The whole stack runs on one outside-Iran VPS: Postgres, Redis, core (API+engine),
worker (BullMQ + Telegram bot), bridge (Zibal relay), web (Next.js), and Caddy as
the HTTPS reverse proxy. One domain, path-based: `/` → web, `/api/*` → core,
`/bridge/*` → bridge.

## Prerequisites
- A domain with an `A` record pointing at the VPS IP (needed for Let's Encrypt).
- Ports 80 and 443 open on the VPS firewall.
- Docker Engine + Compose plugin on the VPS.

## Steps
1. Get the code onto the VPS (e.g. rsync the working tree, or `git clone`), into `/opt/alert-key`.
2. Create the production env:
   ```bash
   cp .env.production.example .env
   # fill DOMAIN + secrets; generate with: openssl rand -hex 32
   ```
   Keep `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` identical.
3. Build and start:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   The one-shot `migrate` service applies Prisma migrations before core/worker start.
4. Watch it come up:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs -f caddy core web
   ```
5. Visit `https://<DOMAIN>` — register, link Telegram, create an alert.

## Updating
```bash
git pull   # or rsync again
docker compose -f docker-compose.prod.yml up -d --build
```

## Notes
- The bridge calls `gateway.zibal.ir` server-to-server. If Zibal blocks the VPS's
  non-Iran IP, move only the bridge to an Iran host and set this VPS's
  `BRIDGE_BASE_URL` / the bridge's `CORE_BASE_URL` accordingly.
- `FEED_MODE=ws` uses the live Binance feed (works outside Iran). Inside Iran, use
  `FEED_MODE=rest`.
