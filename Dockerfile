# Backend image — shared by core (API+engine), worker (BullMQ+telegram bot),
# bridge (Zibal relay) and the one-shot migrate job. Runs the TS sources via tsx
# (no build step); dev deps are needed at runtime (tsx, prisma).
FROM node:20-slim
WORKDIR /app

# openssl + ca-certificates: required by Prisma engines and TLS to Binance/Telegram.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm ci
RUN npx prisma generate --schema apps/core/prisma/schema.prisma

EXPOSE 4000 4100
# command is set per-service in docker-compose.prod.yml
