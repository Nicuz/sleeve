import { Elysia } from 'elysia';
import { join, normalize, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { configureDatabase, prisma } from './db';
import { env } from './config';
import { releaseRoutes } from './routes/releases';
import { musicbrainzRoutes } from './routes/musicbrainz';
import { statsRoutes } from './routes/stats';
import { metaRoutes } from './routes/meta';
import { exportRoutes } from './routes/export';
import { wishlistRoutes } from './routes/wishlist';
import { savedRoutes } from './routes/saved';
import { discoverRoutes } from './routes/discover';
import { importRoutes } from './routes/import';
import { maintenanceRoutes } from './routes/maintenance';
import { coverRoutes, pruneCoverCache } from './routes/covers';
import { ensureMigrations } from './migrate';
import { backupRoutes } from './routes/backups';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const requestStarted = new WeakMap<Request, number>();

const app = new Elysia()
  .onRequest(({ request }) => {
    requestStarted.set(request, performance.now());
  })
  .onAfterResponse(({ request, set }) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      set.headers[name] = value;
    }
    const started = requestStarted.get(request);
    if (started === undefined) return;
    const status = typeof set.status === 'number' ? set.status : 200;
    console.log(
      `${request.method} ${new URL(request.url).pathname} ${status} ${Math.round(performance.now() - started)}ms`,
    );
  })
  .onError(({ code, error, request }) => {
    console.error(
      `${request.method} ${new URL(request.url).pathname} failed (${code})`,
      error,
    );
  })
  .get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, name: 'Sleeve', time: new Date() };
  })
  .get('/api/ready', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ready: true };
  })
  .use(releaseRoutes)
  .use(musicbrainzRoutes)
  .use(statsRoutes)
  .use(metaRoutes)
  .use(exportRoutes)
  .use(wishlistRoutes)
  .use(savedRoutes)
  .use(discoverRoutes)
  .use(importRoutes)
  .use(maintenanceRoutes)
  .use(coverRoutes)
  .use(backupRoutes);

function isAuthorized(request: Request): boolean {
  if (!env.auth) return true;
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const expected = `${env.auth.username}:${env.auth.password}`;
  const actual = `${username}:${password}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function unauthorized(): Response {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      ...SECURITY_HEADERS,
      'www-authenticate': 'Basic realm="Sleeve", charset="UTF-8"',
      'cache-control': 'no-store',
    },
  });
}

function withHeaders(response: Response, cacheControl: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  headers.set('cache-control', cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function installShutdown(close: () => void | Promise<void>) {
  let closing = false;
  async function shutdown(signal: string) {
    if (closing) return;
    closing = true;
    console.log(`[server] ${signal} received, shutting down…`);
    try {
      await close();
    } catch (error) {
      console.error('[server] shutdown failed', error);
    }
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

if (env.isProduction && env.autoMigrate) {
  await ensureMigrations();
}
await configureDatabase();
await pruneCoverCache().catch((error) => {
  console.warn('[server] cover cache prune failed', error);
});

if (env.isProduction) {
  const dist = join(process.cwd(), 'dist');
  const server = Bun.serve({
    port: env.port,
    async fetch(request) {
      const url = new URL(request.url);
      const publicPath = url.pathname === '/api/health' || url.pathname === '/api/ready';

      if (!publicPath && !isAuthorized(request)) {
        return unauthorized();
      }

      if (url.pathname.startsWith('/api')) {
        return app.handle(request);
      }

      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const candidate = normalize(join(dist, relative));

      if (candidate.startsWith(dist + sep)) {
        const file = Bun.file(candidate);
        if (await file.exists()) {
          const immutable = url.pathname.startsWith('/assets/');
          return withHeaders(
            new Response(file),
            immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
          );
        }
      }

      return withHeaders(
        new Response(Bun.file(join(dist, 'index.html')), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
        'no-cache',
      );
    },
  });
  installShutdown(() => server.stop());
  console.log(`Sleeve running at http://localhost:${env.port}`);
} else {
  app.listen(env.port);
  installShutdown(async () => {
    await app.stop();
  });
  console.log(`Sleeve API running at http://localhost:${env.port}`);
}

export type App = typeof app;
