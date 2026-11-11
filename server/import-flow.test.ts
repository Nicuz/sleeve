import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('import, export, backup and settings integration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sleeve-flow-'));
  try {
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: `file:${join(directory, 'test.db')}`,
      DATA_DIR: join(directory, 'data'),
      BACKUP_DIR: join(directory, 'data', 'backups'),
    };
    const result = Bun.spawnSync(['bun', 'run', 'scripts/test-import-flow.ts'], {
      cwd: process.cwd(),
      env,
    });
    if (result.exitCode !== 0) {
      console.error(result.stdout.toString());
      console.error(result.stderr.toString());
    }
    expect(result.exitCode).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
