import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from './db';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

export async function ensureMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return;

  const local = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  let applied: string[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
    );
    applied = rows.map((row) => row.migration_name);
  } catch {
    // Fresh database: the migrations table does not exist yet.
  }

  const unknown = applied.filter((name) => !local.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `Database has migrations newer than this build: ${unknown.join(', ')}. Refusing to start.`,
    );
  }

  if (local.every((name) => applied.includes(name))) return;

  // Release the Prisma connection before the CLI writes to SQLite.
  await prisma.$disconnect();

  const result = Bun.spawnSync(['bunx', 'prisma', 'migrate', 'deploy'], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  });
  if (result.exitCode !== 0) {
    throw new Error('Database migrations failed.');
  }
}
