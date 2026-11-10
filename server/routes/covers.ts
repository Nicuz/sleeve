import { Elysia } from 'elysia';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config';

const CACHE_DIR = env.coverCacheDir;
const ALLOWED_HOST = 'coverartarchive.org';
const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT = env.userAgent;

type CachedCover = {
  data: ArrayBuffer;
  contentType: string;
  hit: boolean;
};

const inflight = new Map<string, Promise<CachedCover>>();
let directoryReady: Promise<void> | null = null;

function ensureDirectory() {
  if (!directoryReady) {
    directoryReady = mkdir(CACHE_DIR, { recursive: true }).then(() => undefined);
  }
  return directoryReady;
}

function cachePaths(url: string) {
  const hash = createHash('sha256').update(url).digest('hex');
  return {
    image: join(CACHE_DIR, `${hash}.bin`),
    meta: join(CACHE_DIR, `${hash}.json`),
  };
}

function validateCoverUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) {
    throw new Error('Only Cover Art Archive URLs are allowed.');
  }
  return url;
}

async function readCached(url: string): Promise<CachedCover | null> {
  await ensureDirectory();
  const paths = cachePaths(url);
  try {
    const meta = JSON.parse(await readFile(paths.meta, 'utf8')) as {
      contentType?: string;
    };
    const data = await readFile(paths.image);
    const image = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    return {
      data: image,
      contentType: meta.contentType ?? 'image/jpeg',
      hit: true,
    };
  } catch {
    return null;
  }
}

async function fetchCover(url: string): Promise<CachedCover> {
  await ensureDirectory();
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'image/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Cover Art Archive returned ${response.status}.`);
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('Cover Art Archive returned a non-image response.');
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Cover image is too large.');
  }
  const data = buffer;
  const paths = cachePaths(url);
  await writeFile(paths.image, new Uint8Array(data));
  await writeFile(
    paths.meta,
    JSON.stringify({ url, contentType, size: data.byteLength }),
  );
  return { data, contentType, hit: false };
}

async function getCover(url: string): Promise<CachedCover> {
  const cached = await readCached(url);
  if (cached) return cached;

  const existing = inflight.get(url);
  if (existing) return existing;

  const request = fetchCover(url).finally(() => inflight.delete(url));
  inflight.set(url, request);
  return request;
}

async function cacheInfo() {
  await ensureDirectory();
  const entries = await readdir(CACHE_DIR).catch(() => [] as string[]);
  const images = entries.filter((name) => name.endsWith('.bin'));
  let bytes = 0;
  for (const name of images) {
    try {
      bytes += (await stat(join(CACHE_DIR, name))).size;
    } catch {
      // Ignore files removed while counting.
    }
  }
  return { count: images.length, bytes };
}

async function clearCache() {
  await ensureDirectory();
  const entries = await readdir(CACHE_DIR).catch(() => [] as string[]);
  await Promise.all(
    entries.map((name) => unlink(join(CACHE_DIR, name)).catch(() => undefined)),
  );
  return entries.length;
}

export async function pruneCoverCache(maxBytes = env.coverCacheMaxBytes) {
  await ensureDirectory();
  const entries = await readdir(CACHE_DIR).catch(() => [] as string[]);
  const images: Array<{ name: string; size: number; mtimeMs: number }> = [];
  for (const name of entries.filter((entry) => entry.endsWith('.bin'))) {
    try {
      const info = await stat(join(CACHE_DIR, name));
      images.push({ name, size: info.size, mtimeMs: info.mtimeMs });
    } catch {
      // Ignore files removed while scanning.
    }
  }
  let total = images.reduce((sum, image) => sum + image.size, 0);
  if (total <= maxBytes) return 0;
  images.sort((a, b) => a.mtimeMs - b.mtimeMs);
  let deleted = 0;
  for (const image of images) {
    if (total <= maxBytes) break;
    await unlink(join(CACHE_DIR, image.name)).catch(() => undefined);
    await unlink(join(CACHE_DIR, image.name.replace(/\.bin$/, '.json'))).catch(
      () => undefined,
    );
    total -= image.size;
    deleted += 1;
  }
  return deleted;
}

export const coverRoutes = new Elysia()
  .get('/api/covers/cache', async () => cacheInfo())
  .delete('/api/covers/cache', async () => ({
    ok: true,
    deleted: await clearCache(),
  }))
  .get('/api/cover', async ({ query, set }) => {
    const raw = typeof query.url === 'string' ? query.url : '';
    if (!raw) {
      set.status = 400;
      return { message: 'Missing cover URL.' };
    }

    let url: string;
    try {
      url = validateCoverUrl(raw).toString();
    } catch (error) {
      set.status = 400;
      return {
        message: error instanceof Error ? error.message : 'Invalid cover URL.',
      };
    }

    try {
      const cover = await getCover(url);
      return new Response(cover.data, {
        headers: {
          'content-type': cover.contentType,
          'cache-control': 'public, max-age=31536000, immutable',
          'x-cover-cache': cover.hit ? 'HIT' : 'MISS',
        },
      });
    } catch (error) {
      set.status = 502;
      return {
        message: error instanceof Error ? error.message : 'Could not fetch cover.',
      };
    }
  });
