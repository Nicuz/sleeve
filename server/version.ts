import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBuildInfo, type BuildInfo } from '../shared/build-info';

let cached: BuildInfo | null = null;

function isBuildInfo(value: unknown): value is BuildInfo {
  if (!value || typeof value !== 'object') return false;
  const info = value as Record<string, unknown>;
  return (
    typeof info.version === 'string' &&
    typeof info.commit === 'string' &&
    typeof info.dirty === 'boolean' &&
    typeof info.buildDate === 'string'
  );
}

export function buildInfo(): BuildInfo {
  if (cached) return cached;

  if (process.env.NODE_ENV === 'production') {
    try {
      const parsed: unknown = JSON.parse(
        readFileSync(join(process.cwd(), 'dist', 'build-info.json'), 'utf8'),
      );
      if (isBuildInfo(parsed)) {
        cached = parsed;
        return cached;
      }
    } catch {
      // Fall back to the current checkout when no build stamp exists.
    }
  }

  cached = getBuildInfo();
  return cached;
}
