FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter=api...

FROM base AS build
COPY --from=deps /repo /repo
COPY apps/api apps/api
RUN pnpm --filter=@grocery-delivery/types --filter=@grocery-delivery/validation --filter=@grocery-delivery/config --filter=@grocery-delivery/utils build
RUN pnpm --filter=api exec prisma generate
RUN pnpm --filter=api build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo /repo
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
