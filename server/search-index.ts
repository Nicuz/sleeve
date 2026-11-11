import { prisma } from './db';

let available: boolean | null = null;

function toMatchQuery(text: string) {
  const tokens = text
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return null;
  const expression = tokens.map((token) => `"${token}"*`).join(' AND ');
  return `{title artist} : (${expression})`;
}

export async function searchReleaseIds(
  text: string,
  limit: number,
): Promise<string[] | null> {
  if (available === false) return null;
  const match = toMatchQuery(text);
  if (!match) return null;

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ release_id: string }>>(
      `SELECT release_id FROM "ReleaseSearch" WHERE "ReleaseSearch" MATCH ? ORDER BY bm25("ReleaseSearch") LIMIT ${Math.trunc(limit)}`,
      match,
    );
    available = true;
    return rows.map((row) => row.release_id);
  } catch {
    if (available === null) {
      console.warn('[search] FTS index unavailable, using contains fallback');
    }
    available = false;
    return null;
  }
}
