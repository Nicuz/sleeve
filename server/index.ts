import { Elysia } from 'elysia';
import { join, normalize, sep } from 'node:path';
import { releaseRoutes } from './routes/releases';
import { musicbrainzRoutes } from './routes/musicbrainz';
import { statsRoutes } from './routes/stats';
import { metaRoutes } from './routes/meta';
import { exportRoutes } from './routes/export';
import { wishlistRoutes } from './routes/wishlist';
import { discoverRoutes } from './routes/discover';
import { importRoutes } from './routes/import';

const app = new Elysia()
  .get('/api/health', () => ({ ok: true, name: 'Sleeve', time: new Date() }))
  .use(releaseRoutes)
  .use(musicbrainzRoutes)
  .use(statsRoutes)
  .use(metaRoutes)
  .use(exportRoutes)
  .use(wishlistRoutes)
  .use(discoverRoutes)
  .use(importRoutes);

const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? (isProduction ? 3000 : 3001));

if (isProduction) {
  const dist = join(process.cwd(), 'dist');
  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname.startsWith('/api')) {
        return app.handle(request);
      }

      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const candidate = normalize(join(dist, relative));

      if (candidate.startsWith(dist + sep)) {
        const file = Bun.file(candidate);
        if (await file.exists()) return new Response(file);
      }

      return new Response(Bun.file(join(dist, 'index.html')), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
  console.log(`Sleeve running at http://localhost:${port}`);
} else {
  app.listen(port);
  console.log(`Sleeve API running at http://localhost:${port}`);
}

export type App = typeof app;
