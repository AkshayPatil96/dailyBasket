# Grocery Delivery Platform

pnpm + Turborepo monorepo. Stack details: see `grocery-delivery-tech-stack.md`.

## Structure

```
apps/
  web/     Next.js — customer (/), admin (/admin), delivery (/delivery)
  api/     NestJS — REST API (/api/v1) + Socket.IO (/socket.io)
packages/
  types/       shared TS types
  validation/  shared Zod schemas
  config/      shared constants
  utils/       shared helpers (currency, date, case conversion)
infrastructure/
  docker/  Dockerfiles for web + api
  nginx/   reverse proxy config
```

## Prerequisites

- Node >= 20
- pnpm 10 (`corepack enable`)
- Docker (for local Postgres/Redis)

## Setup

```bash
pnpm install
docker compose up -d          # Postgres + Redis
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter api db:migrate  # create tables
pnpm dev                      # runs web (:3000) + api (:3001) via turbo
```

## Common commands

```bash
pnpm build         # turbo build (all apps/packages, dependency-ordered)
pnpm lint          # turbo lint
pnpm type-check    # turbo type-check
pnpm test          # turbo test
pnpm --filter api db:studio   # Prisma Studio
```
