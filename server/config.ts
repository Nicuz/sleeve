const DEFAULT_USER_AGENT = 'Sleeve/0.1 ( https://github.com/local/sleeve )';

function readPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${value}".`);
  }
  return port;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
}

const userAgent = process.env.MUSICBRAINZ_USER_AGENT ?? DEFAULT_USER_AGENT;
if (userAgent === DEFAULT_USER_AGENT) {
  console.warn(
    '[config] MUSICBRAINZ_USER_AGENT is using the placeholder. Set a real contact before heavy use.',
  );
}

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: readPort(process.env.PORT, process.env.NODE_ENV === 'production' ? 3000 : 3001),
  userAgent,
} as const;
