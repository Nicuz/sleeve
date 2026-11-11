import { readdir, mkdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from './config';
import { prisma } from './db';

export type BackupFile = {
  name: string;
  bytes: number;
  createdAt: string;
};

function safeName(name: string): string {
  const normalized = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!normalized.endsWith('.db') || normalized !== name) {
    throw new Error('Invalid backup name.');
  }
  return normalized;
}

async function pruneSnapshots(prefix: string, keep: number): Promise<void> {
  const entries = (await readdir(env.backupDir)).filter(
    (name) => name.startsWith(`${prefix}-`) && name.endsWith('.db'),
  );
  const files = await Promise.all(
    entries.map(async (name) => {
      try {
        const info = await stat(join(env.backupDir, name));
        return { name, createdAt: info.mtimeMs };
      } catch {
        return null;
      }
    }),
  );
  const stale = files
    .filter((file): file is { name: string; createdAt: number } => Boolean(file))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(keep);

  await Promise.all(
    stale.map((file) => unlink(join(env.backupDir, file.name)).catch(() => undefined)),
  );
}

export async function createBackup(prefix = 'sleeve'): Promise<BackupFile> {
  await mkdir(env.backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'sleeve';
  const name = `${cleanPrefix}-${stamp}.db`;
  const target = join(env.backupDir, name).replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target}'`);
  const info = await stat(join(env.backupDir, name));

  if (cleanPrefix === 'pre-import') {
    await pruneSnapshots(cleanPrefix, 5).catch(() => undefined);
  }

  return { name, bytes: info.size, createdAt: info.mtime.toISOString() };
}

export function backupPath(name: string): string {
  return join(env.backupDir, safeName(name));
}
