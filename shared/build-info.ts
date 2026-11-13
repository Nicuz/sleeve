import { execFileSync } from 'node:child_process';
import packageJson from '../package.json' with { type: 'json' };

export type BuildInfo = {
  version: string;
  commit: string;
  dirty: boolean;
  buildDate: string;
};

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
  } catch {
    return null;
  }
}

export function getBuildInfo(
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): BuildInfo {
  const commit =
    env.SLEEVE_COMMIT?.trim() || git(['rev-parse', '--short', 'HEAD']) || 'unknown';
  const dirtyValue = env.SLEEVE_DIRTY?.trim().toLowerCase();
  let dirty = false;
  if (dirtyValue === 'true' || dirtyValue === '1') {
    dirty = true;
  } else if (dirtyValue !== 'false' && dirtyValue !== '0') {
    dirty = commit !== 'unknown' && Boolean(git(['status', '--porcelain']));
  }

  return {
    version: packageJson.version,
    commit,
    dirty,
    buildDate: env.SLEEVE_BUILD_DATE?.trim() || now.toISOString(),
  };
}
