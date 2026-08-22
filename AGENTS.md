# AGENTS.md

Operating instructions for coding agents (Claude Code and others) working in this repo.

## Project

Grocery delivery platform. pnpm + Turborepo monorepo: one Next.js app serving customer/admin/delivery web UIs, one NestJS API, shared TS packages. Full stack rationale lives in the sibling planning docs one level up (`../grocery-delivery-tech-stack.md`, `../grocery-delivery-authentication-architecture.md`, `../dailybasket-cart-architecture.md`, `../dailybasket-checkout-architecture.md`, `../grocery-delivery-product-catalog-architecture.md`, `../dailybasket-address-location-architecture.md`) — these are outside the git repo but are the source of truth for domain decisions. Read the relevant one before implementing that domain.

## Commands

```bash
pnpm install
docker compose up -d                    # Postgres + Redis for local dev

pnpm dev                                # turbo dev — web (:3000) + api (:3001)
pnpm build                              # turbo build, dependency-ordered (packages before apps)
pnpm lint                               # turbo lint
pnpm type-check                         # turbo type-check
pnpm test                               # turbo test

pnpm --filter api db:generate           # regenerate Prisma client after schema.prisma changes
pnpm --filter api db:migrate            # create/apply a migration
pnpm --filter api db:studio             # Prisma Studio

pnpm --filter web dev                   # single app, e.g. web only
pnpm --filter api test -- path/to.spec.ts   # single test file (jest)
```

Turbo's `outputs` for `build` cover `.next/**` and `dist/**` — shared packages (`packages/*`) must be built (`tsc`) before `apps/*` can type-check or build against them; turbo's `dependsOn: ["^build"]` handles the ordering, don't bypass it by running an app's build in isolation without its package deps already built.

## Monorepo layout

```
apps/web/    Next.js 16, App Router — (customer)/ -> "/", admin/ -> "/admin", delivery/ -> "/delivery"
apps/api/    NestJS (Express adapter), prefix /api/v1, Socket.IO gateway at /socket.io
packages/types/       shared TS interfaces (mirrors Prisma models, not generated from them)
packages/validation/  shared Zod schemas
packages/config/      shared constants (roles, order status, route paths)
packages/utils/       currency/date formatting, snake_case<->camelCase converters
infrastructure/       Dockerfiles + nginx reverse-proxy config
```

Route split is deliberate: one Next.js deployment serves all three surfaces (customer/admin/delivery) behind one domain via nginx path-based routing (`/`, `/admin`, `/delivery` -> web; `/api/v1`, `/socket.io` -> api). There is no `api.` subdomain and no separate admin/delivery deployments — don't introduce one without updating `infrastructure/nginx/nginx.conf` and the auth cookie strategy together (cookie scoping currently assumes one shared origin).

## Backend layering

`apps/api/src/modules/<domain>/` is `Module + Controller + Service`, one per domain (auth, users, products, categories, cart, orders, payments, inventory, delivery, coupons, notifications, admin) — currently stubs. There is no separate Repository layer: `PrismaService` (global, from `src/prisma/`) is injected directly into Services and *is* the repository layer. Don't add a repository abstraction on top of Prisma — it isn't justified here.

Controllers stay thin: parse input, call the Service, return. Business logic, transactions, and all Prisma calls belong in the Service.

Multi-table writes (e.g. checkout: reserve inventory + create payment + create order) must use `prisma.$transaction(...)`, not sequential unguarded calls — see Checkout below for why this specific flow is transaction-critical.

## Known gap: `schema.prisma` vs. domain architecture docs

The current `apps/api/prisma/schema.prisma` is a simplified starter (flat `Product`, no variants, no `Cart`/`CartItem`, no `CheckoutSession`, no reservation fields). The architecture docs listed above specify a richer model:

- **Catalog**: `Product` is conceptual; `ProductVariant` is the actual sellable SKU (price, stock, purchase limits all live on the variant, not the product). `Category` is self-referencing (`parentId`) for arbitrary depth — don't hardcode a fixed category/subcategory table pair. `Brand` and `ProductImage` are separate entities.
- **Cart**: server-authoritative, PostgreSQL-backed (not Redis). Cart items reference `variantId`, not `productId`, with `UNIQUE(cartId, variantId)`. Adding to cart never reserves inventory. Cart-level prices/totals are for UX only — never persist them as authoritative.
- **Checkout**: a dedicated `CheckoutSession` (not a direct cart->order conversion), with its own expiry separate from inventory-reservation expiry. Inventory reservation is short-lived and atomic (`UPDATE ... WHERE available_quantity >= :qty`, check affected-row count), created at checkout — never at add-to-cart.
- **Orders**: immutable snapshots. `OrderItem` stores `productNameSnapshot`, `variantNameSnapshot`, `skuSnapshot`, `unitPrice` at purchase time — never reconstruct historical order value from current catalog/variant rows. Address is also snapshotted onto the order, not just referenced by `addressId` (a saved address can be edited/deleted later).

When implementing any of these domains, extend the schema to match the relevant doc before writing service logic — don't build cart/checkout/catalog logic against the current simplified schema and paper over the mismatch.

## Authentication architecture (once implemented)

- Access token: short-lived JWT (~10–15 min), HTTP-only Secure cookie — never `localStorage`.
- Refresh token: long-lived (~30 days), HTTP-only Secure cookie, rotated on every use (A -> B -> C), tracked as a revocable session in Redis (`refresh_session:<sessionId>`).
- Normal authenticated requests verify the JWT locally (signature + expiry) — no Redis lookup in that path. Redis is only touched on login, refresh, and logout.
- No access-token blacklist for the initial implementation — that would put Redis in the critical path for every request. Logout revokes the refresh session; the outstanding access token simply expires within its short window.
- Reused (already-rotated) refresh tokens must be treated as a possible compromise: revoke the session, don't silently issue a new pair.
- Delivery-partner and admin accounts are never created through public registration — admin is seeded/provisioned, delivery partners are invited by an admin.
- The frontend route (`/admin`, `/delivery`) is never the authorization boundary. Every domain module needs its own NestJS guard checking role/session — a URL segment is not access control.

## Payments (Razorpay)

- The browser's payment-success callback is never the sole source of truth — webhook verification (server-to-server) is mandatory, because the customer can close the tab or lose connection after paying.
- Idempotency is mandatory: webhook handlers and order creation must be safe to run twice (unique constraint on `providerPaymentId`, idempotency keys). Razorpay redelivers webhooks.
- Payment state is an explicit enum (`CREATED -> PENDING -> AUTHORIZED -> CAPTURED`, plus `FAILED`/`REFUNDED`), never a boolean `paymentSuccess`.
- Don't try to make a Razorpay API call and a Postgres write one transaction — external calls can't participate in Postgres ACID transactions. Use DB transactions + explicit state machine + idempotency + reconciliation instead.

## Address/location

- Store `latitude`/`longitude` and a `formattedAddress` snapshot, not just a `postalCode` — pincode alone is too coarse for future serviceability/ETA logic.
- Orders snapshot the address used at purchase time; never resolve historical order address by following `addressId` (the saved address can change or be deleted afterward).
- Google Maps key must be split: browser-restricted key in `apps/web`, server-restricted key in `apps/api`. Never one unrestricted key shared across both.

## Security rules (non-obvious / project-specific)

- CORS: explicit origin allowlist via `CORS_ORIGIN` env, `credentials: true`. Never `origin: true`/`'*'` with credentials — both `main.ts` and the Socket.IO gateway must stay in sync on this.
- Swagger (`/api/docs`) is gated to non-production (`NODE_ENV !== 'production'`) in `main.ts` — don't remove that guard; it's the full API surface.
- Search, and any other free-text query endpoint, is untrusted input: validate length, rate-limit, and rely on Prisma's parameterized queries — never string-build SQL.
- Webhook endpoints (Razorpay) must verify the provider signature before trusting the payload, and must be idempotent (see Payments above).
- Rate-limit auth endpoints (login, register, password reset, refresh) specifically — they're the highest-value target.
- JWT claims carry only `sub`, `role`, `sessionId`, `jti`, `iat`, `exp` — never put email, PII, or anything sensitive in the token payload.

## API JSON convention

DB columns are `snake_case` (via Prisma `@map`), TS/Kotlin-style code is `camelCase`. `apps/web/src/lib/api-client.ts` already assumes the wire format is `snake_case` (it converts both directions with `packages/utils`'s `toSnakeCase`/`toCamelCase`). NestJS does not do this conversion automatically the way Jackson does on a Kotlin stack — when DTOs/serializers are added to `apps/api`, either apply a consistent snake_case naming strategy (global interceptor or per-field `@Expose({ name: '...' })`) or the two ends will silently disagree. Don't leave this half-done — pick the approach and apply it everywhere, not endpoint-by-endpoint.

## Git / commits

Do not add a "Generated by Claude" / "Co-Authored-By: Claude" (or any AI-attribution) trailer to commit messages. Commit messages describe the change only.
