import { readdir, mkdir, stat } from 'node:fs/promises';
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

export async function listBackups(): Promise<BackupFile[]> {
  await mkdir(env.backupDir, { recursive: true });
  const entries = (await readdir(env.backupDir)).filter((name) => name.endsWith('.db'));
  const files = await Promise.all(
    entries.map(async (name) => {
      try {
        const info = await stat(join(env.backupDir, name));
        return { name, bytes: info.size, createdAt: info.mtime.toISOString() };
      } catch {
        return null;
      }
    }),
  );
  return files
    .filter((file): file is BackupFile => Boolean(file))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createBackup(): Promise<BackupFile> {
  await mkdir(env.backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `sleeve-${stamp}.db`;
  const target = join(env.backupDir, name).replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target}'`);
  const info = await stat(join(env.backupDir, name));
  return { name, bytes: info.size, createdAt: info.mtime.toISOString() };
}

export function backupPath(name: string): string {
  return join(env.backupDir, safeName(name));
}
