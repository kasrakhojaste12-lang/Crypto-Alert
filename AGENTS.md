# Repository Guidelines

## Project Structure & Module Organization

This npm-workspace monorepo contains three TypeScript applications under `apps/`:

- `apps/core`: Express API, Binance price engine, BullMQ workers, dispatchers, and Prisma schema/migrations. Tests live beside implementation files as `*.test.ts`.
- `apps/web`: Next.js App Router frontend. Routes are in `app/`, shared UI in `components/`, browser helpers in `lib/`, and static assets in `public/`.
- `apps/bridge`: Small Zibal payment relay for an Iran-reachable host.

Root Docker Compose files provide PostgreSQL and Redis. Keep service-specific code within its workspace; share code only when duplication is real.

## Build, Test, and Development Commands

- `npm install`: install all workspace dependencies.
- `npm run infra:up`: start local PostgreSQL and Redis; use `infra:down` to stop them.
- `npm run db:migrate`: apply development Prisma migrations.
- `npm run dev:core`, `dev:worker`, `dev:bridge`, `dev:web`: run the four development processes (ports 4000, worker-only, 4100, and 3000).
- `npm test`: run the core executable test scripts.
- `npm run build -w web`: create the production Next.js build.

Copy `.env.example` to `.env` before local development. Use `DEV_TICK=1` and the documented `/api/dev/tick` endpoint when Binance is unreachable.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, two-space indentation, semicolons, and double quotes, matching nearby code. Name React components in `PascalCase`, functions and variables in `camelCase`, and files descriptively (`SymbolPicker.tsx`, `crossing.test.ts`). Prefer small modules and existing platform or dependency features. No repository-wide formatter or linter is configured, so preserve local style and ensure TypeScript/build checks pass.

## Testing Guidelines

Tests are standalone TypeScript scripts run with `tsx`, using assertions rather than a test framework. Add focused `*.test.ts` files beside core logic and append new scripts to `apps/core/package.json`. Run `npm test` before submitting. For database, queue, or feed changes, also exercise the relevant local service flow.

## Commit & Pull Request Guidelines

History uses short, imperative, sentence-case subjects such as `Add Telegram disconnect...` and `Fix dead price feed...`. Keep each commit focused. Pull requests should explain behavior and deployment/configuration impact, link relevant issues, list verification commands, and include screenshots for visible web changes. Never commit `.env`, credentials, logs, or generated build output.
