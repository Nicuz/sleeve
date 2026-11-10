import { copyFile, mkdir, stat, unlink } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { env } from '../server/config';
import { backupPath } from '../server/backup';

const input = process.argv[2];
if (!input) {
  console.error('Usage: bun run restore -- <backup-name-or-path>');
  process.exit(1);
}

const source = input.includes('/') ? resolve(input) : backupPath(input);
const url = process.env.DATABASE_URL ?? '';
if (!url.startsWith('file:')) {
  console.error('Only file: SQLite DATABASE_URL values can be restored.');
  process.exit(1);
}
const rawPath = url.slice('file:'.length);
const databasePath = isAbsolute(rawPath)
  ? rawPath
  : resolve(process.cwd(), 'prisma', rawPath);

const safetyDir = env.backupDir;
await mkdir(safetyDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const safetyCopy = resolve(safetyDir, `pre-restore-${stamp}.db`);

try {
  await stat(source);
} catch {
  console.error(`Backup not found: ${source}`);
  process.exit(1);
}

try {
  await copyFile(databasePath, safetyCopy);
  console.log(`Current database saved to ${safetyCopy}`);
} catch {
  console.log('No existing database to preserve.');
}

await copyFile(source, databasePath);
await unlink(`${databasePath}-wal`).catch(() => undefined);
await unlink(`${databasePath}-shm`).catch(() => undefined);
console.log(`Restored ${source} → ${databasePath}`);
console.log('Start Sleeve again to use the restored database.');
