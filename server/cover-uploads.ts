import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from './config';

const UPLOAD_PREFIX = 'upload:';
const MAX_BYTES = 8 * 1024 * 1024;
const NAME_PATTERN = /^[a-f0-9]{64}\.(jpg|png|webp|gif)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

let directoryReady: Promise<void> | null = null;

function ensureDirectory() {
  if (!directoryReady) {
    directoryReady = mkdir(env.coverUploadDir, { recursive: true }).then(() => undefined);
  }
  return directoryReady;
}

export function isUploadCover(coverUrl: string | null | undefined): boolean {
  return Boolean(coverUrl?.startsWith(UPLOAD_PREFIX));
}

export function uploadCoverName(coverUrl: string): string | null {
  if (!coverUrl.startsWith(UPLOAD_PREFIX)) return null;
  const name = coverUrl.slice(UPLOAD_PREFIX.length);
  return NAME_PATTERN.test(name) ? name : null;
}

export function detectCoverImageType(
  data: Uint8Array,
): { ext: string; contentType: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38
  ) {
    return { ext: 'gif', contentType: 'image/gif' };
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export type SavedCoverUpload = {
  coverUrl: string;
  contentType: string;
  bytes: number;
};

export async function saveCoverUpload(data: Uint8Array): Promise<SavedCoverUpload> {
  if (data.byteLength === 0) {
    throw new Error('The image is empty.');
  }
  if (data.byteLength > MAX_BYTES) {
    throw new Error('Cover images must be 8 MB or smaller.');
  }
  const image = detectCoverImageType(data);
  if (!image) {
    throw new Error('Covers must be JPEG, PNG, WebP or GIF images.');
  }
  await ensureDirectory();
  const hash = createHash('sha256').update(data).digest('hex');
  const name = `${hash}.${image.ext}`;
  const path = join(env.coverUploadDir, name);
  try {
    await stat(path);
  } catch {
    await writeFile(path, data);
  }
  return {
    coverUrl: `${UPLOAD_PREFIX}${name}`,
    contentType: image.contentType,
    bytes: data.byteLength,
  };
}

export async function readCoverUpload(name: string): Promise<{
  data: Uint8Array;
  contentType: string;
} | null> {
  if (!NAME_PATTERN.test(name)) return null;
  const ext = name.split('.').pop() as keyof typeof CONTENT_TYPES;
  try {
    const data = await readFile(join(env.coverUploadDir, name));
    return { data, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

export async function listCoverUploads(): Promise<string[]> {
  await ensureDirectory();
  const entries = await readdir(env.coverUploadDir).catch(() => [] as string[]);
  return entries.filter((name) => NAME_PATTERN.test(name));
}

export async function deleteCoverUpload(name: string): Promise<void> {
  if (!NAME_PATTERN.test(name)) return;
  await unlink(join(env.coverUploadDir, name)).catch(() => undefined);
}

export async function pruneUnusedCoverUploads(
  referenced: Set<string>,
  minAgeMs = 60 * 60 * 1000,
): Promise<number> {
  const names = await listCoverUploads();
  const stale = names.filter((name) => !referenced.has(name));
  let deleted = 0;
  for (const name of stale) {
    try {
      const info = await stat(join(env.coverUploadDir, name));
      if (Date.now() - info.mtimeMs < minAgeMs) continue;
    } catch {
      continue;
    }
    await deleteCoverUpload(name);
    deleted += 1;
  }
  return deleted;
}
