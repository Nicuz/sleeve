import { join, resolve } from 'node:path';
import pkg from '../package.json';

const DEFAULT_USER_AGENT = `${pkg.name}/${pkg.version} ( ${pkg.homepage} )`;

function readPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${value}".`);
  }
  return port;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, got "${value}".`);
  }
  return parsed;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
}

const userAgent = process.env.MUSICBRAINZ_USER_AGENT?.trim() || DEFAULT_USER_AGENT;

const dataDir = resolve(process.env.DATA_DIR ?? join(process.cwd(), 'data'));

const authUser = process.env.SLEEVE_AUTH_USER;
const authPassword = process.env.SLEEVE_AUTH_PASSWORD;
if (Boolean(authUser) !== Boolean(authPassword)) {
  throw new Error('SLEEVE_AUTH_USER and SLEEVE_AUTH_PASSWORD must be set together.');
}

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: readPort(process.env.PORT, process.env.NODE_ENV === 'production' ? 3000 : 3001),
  userAgent,
  dataDir,
  coverCacheDir: process.env.COVER_CACHE_DIR ?? join(dataDir, 'covers'),
  backupDir: process.env.BACKUP_DIR ?? join(dataDir, 'backups'),
  coverCacheMaxBytes: readPositiveInt(process.env.COVER_CACHE_MAX_MB, 500) * 1024 * 1024,
  autoMigrate: process.env.AUTO_MIGRATE !== 'false',
  auth: authUser && authPassword ? { username: authUser, password: authPassword } : null,
} as const;
