FROM oven/bun:1.4.4-debian AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV DATABASE_URL=file:/app/build.db
RUN bunx prisma generate && bun run build

FROM oven/bun:1.4.4-debian
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3001
COPY --from=build /app /app
RUN mkdir -p /data && chown -R bun:bun /app /data
USER bun
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker/entrypoint.sh"]
