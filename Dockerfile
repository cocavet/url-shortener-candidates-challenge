FROM node:22.23.2-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.20.0
WORKDIR /app

FROM base AS dependencies
# better-sqlite3 can compile from source when no prebuilt binary is available.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY libs/engine/package.json ./libs/engine/
COPY applications/web/package.json ./applications/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/libs/engine/node_modules ./libs/engine/node_modules
COPY --from=dependencies /app/applications/web/node_modules ./applications/web/node_modules
COPY . .
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PUBLIC_URL=http://localhost:3000 \
    DATABASE_URL=file:/data/links.db

# Prisma's CLI is retained to deploy migrations at startup.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/applications/web/node_modules ./applications/web/node_modules
COPY --from=build /app/libs/engine/node_modules ./libs/engine/node_modules
COPY --from=build /app/applications/web/build ./applications/web/build
COPY --from=build /app/libs/engine/src ./libs/engine/src
COPY libs/engine/prisma ./libs/engine/prisma
COPY libs/engine/prisma.config.ts ./libs/engine/
COPY applications/web/server.ts ./applications/web/
COPY applications/web/app/server ./applications/web/app/server
COPY applications/web/app/contracts ./applications/web/app/contracts
COPY applications/web/package.json ./applications/web/
COPY libs/engine/package.json ./libs/engine/
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/applications/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["sh", "-c", "pnpm --filter @url-shortener/engine db:migrate && exec node --import tsx server.ts"]
