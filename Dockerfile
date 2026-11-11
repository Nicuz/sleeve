# syntax=docker/dockerfile:1
FROM oven/bun:1.4.4-debian AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev /temp/prod
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/build.db
RUN bun run build

FROM prerelease AS test
ENV NODE_ENV=test
RUN DATABASE_URL=file:/app/build.db \
    bunx prisma generate --schema prisma/schema.prisma
RUN bun test

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/dist ./dist
COPY --from=prerelease /app/server ./server
COPY --from=prerelease /app/shared ./shared
COPY --from=prerelease /app/scripts/backup.ts ./scripts/backup.ts
COPY --from=prerelease /app/scripts/restore.ts ./scripts/restore.ts
COPY --from=prerelease /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=prerelease /app/prisma/migrations ./prisma/migrations
COPY --from=prerelease /app/package.json ./package.json
COPY --from=prerelease /app/docker/entrypoint.sh ./docker/entrypoint.sh

RUN DATABASE_URL=file:/app/build.db \
    bunx prisma generate --schema prisma/schema.prisma

RUN chmod +x docker/entrypoint.sh \
    && mkdir -p /data \
    && chown bun:bun /data

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3001

USER bun
EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker/entrypoint.sh"]
