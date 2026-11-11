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

  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = Bun.spawnSync(['bunx', 'prisma', 'migrate', 'deploy'], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    if (stdout) process.stdout.write(stdout);
    if (result.exitCode === 0) return;

    const locked = /database is locked|SQLITE_BUSY/i.test(`${stdout}${stderr}`);
    if (!locked || attempt === attempts) {
      if (stderr) process.stderr.write(stderr);
      throw new Error(
        locked
          ? 'Database is locked by another process. Stop the running dev server (`bun run dev`) or run `bun run db:deploy` once, then restart.'
          : 'Database migrations failed.',
      );
    }
    console.warn(
      `[server] database is locked, retrying migrations (${attempt}/${attempts})…`,
    );
    await Bun.sleep(750 * attempt);
  }
}
