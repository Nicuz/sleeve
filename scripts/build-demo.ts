import { rename } from 'node:fs/promises';
import { join } from 'node:path';

const result = Bun.spawnSync(
  ['bunx', 'vite', 'build', '--config', 'vite.demo.config.ts'],
  { stdout: 'inherit', stderr: 'inherit' },
);

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}

const output = join('docs', 'public', 'demo');
await rename(join(output, 'demo.html'), join(output, 'index.html'));
console.log('Demo built in docs/public/demo');
