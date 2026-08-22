FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter=web...

FROM base AS build
COPY --from=deps /repo /repo
COPY apps/web apps/web
RUN pnpm --filter=@grocery-delivery/types --filter=@grocery-delivery/validation --filter=@grocery-delivery/config --filter=@grocery-delivery/utils build
RUN pnpm --filter=web build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 3000
CMD ["pnpm", "--filter=web", "start"]
